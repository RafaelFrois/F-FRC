import {
  getCountryAverageEPA,
  getCurrentSeasonYear,
  getLastOfficialTeamEvents,
  getTeamCountry,
  getTeamInfo,
  getTeamSeasonEPA,
  StatboticsServiceError
} from "./statbotics.service.js";

const EVENT_DIVISORS = {
  regional: 1.0,
  district: 1.05,
  district_championship: 1.1,
  world_championship: 1.25
};

const EVENT_WEIGHTS = [0.65, 0.35];
const BASE_PRICE_MULTIPLIER = 1;
const TREND_UP_FACTOR = 1.1;
const TREND_DOWN_FACTOR = 0.9;
const TREND_NEUTRAL_FACTOR = 1.0;
const MAX_REGIONAL_BONUS = 0.1;
const MIN_PRICE = 1;
const ROOKIE_START_PRICE = 5;
const MAX_PRICE = 180;

const TIER_LOW_MAX_RAW = 18;
const TIER_MID_MAX_RAW = 30;
const TIER_TOP_MAX_PRICE = 40;

class PricingServiceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PricingServiceError";
    this.details = details;
  }
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calibratePriceByTier(rawPrice) {
  const safeRaw = toSafeNumber(rawPrice, 0);

  if (safeRaw <= TIER_LOW_MAX_RAW) {
    const scaled = 6 + (safeRaw / TIER_LOW_MAX_RAW) * 8;
    return Math.round(scaled);
  }

  if (safeRaw <= TIER_MID_MAX_RAW) {
    const ratio = (safeRaw - TIER_LOW_MAX_RAW) / (TIER_MID_MAX_RAW - TIER_LOW_MAX_RAW);
    const scaled = 15 + ratio * 11;
    return Math.round(scaled);
  }

  const ratio = Math.min((safeRaw - TIER_MID_MAX_RAW) / 20, 1);
  const scaled = 27 + ratio * (TIER_TOP_MAX_PRICE - 27);
  return Math.round(scaled);
}

export function getEventDivisor(eventType) {
  return EVENT_DIVISORS[eventType] || EVENT_DIVISORS.regional;
}

export function normalizeEventEPA(totalEPA, eventType) {
  const divisor = getEventDivisor(eventType);
  return toSafeNumber(totalEPA, 0) / divisor;
}

export function calculateWeightedEPA(normalizedEventEPAs) {
  if (!Array.isArray(normalizedEventEPAs) || normalizedEventEPAs.length === 0) {
    throw new PricingServiceError("Não há eventos suficientes para calcular weightedEPA");
  }

  const weights = EVENT_WEIGHTS.slice(0, normalizedEventEPAs.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const weightedTotal = normalizedEventEPAs.reduce((sum, eventEPA, index) => {
    const weight = weights[index] || 0;
    return sum + eventEPA * weight;
  }, 0);

  return weightSum > 0 ? weightedTotal / weightSum : 0;
}

export function calculateTrendFactor(normalizedEventEPAs) {
  if (!Array.isArray(normalizedEventEPAs) || normalizedEventEPAs.length < 2) {
    return TREND_NEUTRAL_FACTOR;
  }

  const mostRecentEPA = normalizedEventEPAs[0];
  const previousEPA = normalizedEventEPAs[1];

  if (mostRecentEPA > previousEPA) return TREND_UP_FACTOR;
  if (mostRecentEPA < previousEPA) return TREND_DOWN_FACTOR;
  return TREND_NEUTRAL_FACTOR;
}

export function calculateRegionalFactor(teamEPA, countryAverageEPA) {
  const safeTeamEPA = toSafeNumber(teamEPA, 0);
  const safeCountryAverage = toSafeNumber(countryAverageEPA, 0);

  if (safeCountryAverage <= 0 || safeTeamEPA <= safeCountryAverage) {
    return 1;
  }

  const rawBonus = (safeTeamEPA - safeCountryAverage) / safeCountryAverage;
  const boundedBonus = Math.min(rawBonus, MAX_REGIONAL_BONUS);

  return 1 + boundedBonus;
}

export function calculateFinalPrice(weightedEPA, trendFactor, regionalFactor) {
  const safeWeightedEPA = toSafeNumber(weightedEPA, 0);
  const basePrice = Math.pow(safeWeightedEPA, 1.18) * 0.62 * BASE_PRICE_MULTIPLIER;
  const rawPrice = basePrice * toSafeNumber(trendFactor, 1) * toSafeNumber(regionalFactor, 1);
  const tierCalibrated = calibratePriceByTier(rawPrice);
  const clamped = clamp(tierCalibrated, MIN_PRICE, MAX_PRICE);

  return Math.round(clamped);
}

export async function calculateTeamMarketPrice(teamNumber, seasonYear = getCurrentSeasonYear(), options = {}) {
  try {
    const includeDiagnostics = Boolean(options?.includeDiagnostics);
    let teamInfo = null;
    const diagnostics = {
      source: null,
      classification: null,
      reason: null,
      eventsUsed: [],
      normalizedEPAs: [],
      seasonEPA: null,
      enableRegionalFactor: String(process.env.ENABLE_REGIONAL_FACTOR || "false").toLowerCase() === "true"
    };

    // STEP 1: Coleta os últimos 2 eventos oficiais jogados (ano atual ou anterior).
    let recentEvents = await getLastOfficialTeamEvents(teamNumber, seasonYear, 2);
    diagnostics.source = "official_events";

    if (recentEvents.length === 0) {
      let seasonEPAFallback = 0;
      try {
        seasonEPAFallback = await getTeamSeasonEPA(teamNumber, seasonYear);
      } catch {
        seasonEPAFallback = 0;
      }

      if (seasonEPAFallback > 0) {
        diagnostics.source = "season_epa_fallback";
        recentEvents = [
          { eventType: "regional", totalEPA: seasonEPAFallback, autoEPA: 0, teleopEPA: 0, endgameEPA: 0 }
        ];
      }
    }

    const normalizedEvents = recentEvents.map((event) => ({
      ...event,
      normalizedEPA: normalizeEventEPA(event.totalEPA, event.eventType)
    }));

    const normalizedValues = normalizedEvents.map((event) => event.normalizedEPA);
    diagnostics.eventsUsed = normalizedEvents.map((event) => ({
      eventKey: event.eventKey || null,
      eventName: event.eventName || null,
      eventType: event.eventType,
      totalEPA: Number(event.totalEPA || 0),
      normalizedEPA: Number(event.normalizedEPA || 0)
    }));
    diagnostics.normalizedEPAs = normalizedValues;

    const hasCompetitionHistory = normalizedValues.some((value) => Number(value) > 0);
    if (!hasCompetitionHistory) {
      try {
        teamInfo = await getTeamInfo(teamNumber);
      } catch {
        teamInfo = null;
      }

      if (!teamInfo) {
        const result = {
          teamNumber: Number(teamNumber),
          weightedEPA: 0,
          trendFactor: 1,
          regionalFactor: 1,
          finalPrice: MIN_PRICE
        };
        if (includeDiagnostics) {
          diagnostics.classification = "no_data_available";
          diagnostics.reason = "Sem histórico de eventos com EPA e sem dados de teamInfo no momento da consulta.";
          result.diagnostics = diagnostics;
        }
        return result;
      }

      const recordCount = Number(teamInfo?.record?.count || 0);
      const rookieYear = Number(teamInfo?.rookie_year || 0);
      const normEPA = teamInfo?.norm_epa || {};
      const hasEpaSignals = [normEPA.current, normEPA.recent, normEPA.mean].some((value) => Number(value) > 0);
      const isRookieWithoutHistory = rookieYear >= Number(seasonYear) && recordCount === 0;

      const isRookieCase = (isRookieWithoutHistory || !hasEpaSignals);
      const result = {
        teamNumber: Number(teamNumber),
        weightedEPA: 0,
        trendFactor: 1,
        regionalFactor: 1,
        finalPrice: isRookieCase ? ROOKIE_START_PRICE : MIN_PRICE
      };
      if (includeDiagnostics) {
        diagnostics.classification = isRookieCase ? "rookie_or_no_signal" : "no_recent_events";
        diagnostics.reason = isRookieCase
          ? "Time sem histórico competitivo válido (rookie/sem sinal de EPA)."
          : "Sem eventos com EPA utilizável nos últimos dois eventos considerados.";
        diagnostics.source = diagnostics.source || "none";
        result.diagnostics = diagnostics;
      }
      return result;
    }

    // STEP 2: Média ponderada considerando recência dos eventos.
    const weightedEPA = calculateWeightedEPA(normalizedValues);

    // STEP 3: Fator de tendência baseado no evento mais recente vs média dos dois anteriores.
    const trendFactor = calculateTrendFactor(normalizedValues);

    // STEP 4: Fator regional com base na média EPA do país na temporada atual.
    const teamEPA = await getTeamSeasonEPA(teamNumber, seasonYear);
    let teamCountry = null;

    try {
      teamCountry = await getTeamCountry(teamNumber, seasonYear);
    } catch {
      teamCountry = null;
    }

    let regionalFactor = 1;
    const enableRegionalFactor = diagnostics.enableRegionalFactor;
    if (enableRegionalFactor) {
      try {
        if (!teamCountry) {
          throw new Error("country-unavailable");
        }
        const countryAverageEPA = await getCountryAverageEPA(teamCountry, seasonYear);
        regionalFactor = calculateRegionalFactor(teamEPA || weightedEPA, countryAverageEPA);
      } catch {
        regionalFactor = 1;
      }
    }

    // STEP 5: Preço final = basePrice * trendFactor * regionalFactor, com limites de mercado.
    const finalPrice = calculateFinalPrice(weightedEPA, trendFactor, regionalFactor);

    const result = {
      teamNumber: Number(teamNumber),
      weightedEPA,
      trendFactor,
      regionalFactor,
      finalPrice
    };
    if (includeDiagnostics) {
      diagnostics.classification = "calculated";
      diagnostics.reason = diagnostics.source === "season_epa_fallback"
        ? "Preço calculado com fallback de EPA da temporada por ausência de eventos recentes com OPR."
        : "Preço calculado pelos últimos dois eventos oficiais com OPR disponível.";
      diagnostics.seasonEPA = Number(teamEPA || 0);
      result.diagnostics = diagnostics;
    }

    return result;
  } catch (error) {
    if (error instanceof PricingServiceError || error instanceof StatboticsServiceError) {
      throw error;
    }

    throw new PricingServiceError("Falha ao calcular preço de mercado do time", {
      teamNumber,
      seasonYear,
      message: error.message
    });
  }
}

export { PricingServiceError };