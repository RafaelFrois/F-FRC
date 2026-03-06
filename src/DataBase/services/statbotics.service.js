import axios from "axios";
import { getEventOprs, getTeamEventsByYear } from "./tba.services.js";

const STATBOTICS_BASE_URL = process.env.STATBOTICS_BASE_URL || "https://api.statbotics.io/v3";
const REQUEST_TIMEOUT_MS = Number(process.env.STATBOTICS_TIMEOUT_MS || 12000);

const client = axios.create({
  baseURL: STATBOTICS_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS
});

class StatboticsServiceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "StatboticsServiceError";
    this.details = details;
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEPAValue(value, fallback = 0) {
  const parsed = toNumber(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;

  // Statbotics can return EPA values scaled in centi-units (e.g. 1866 => 18.66).
  // Scale down iteratively to keep values in the expected EPA range.
  let normalized = parsed;
  while (Math.abs(normalized) > 200) {
    normalized /= 100;
  }

  return normalized;
}

function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

function buildTeamKeyVariants(teamNumber) {
  const numeric = String(teamNumber || "").replace(/[^0-9]/g, "");
  if (!numeric) return [];
  return [numeric, `frc${numeric}`];
}

function parseEventType(rawEvent = {}) {
  const explicitType = normalizeString(rawEvent.event_type_string || rawEvent.type || rawEvent.event_type_label);
  if (explicitType.includes("district championship")) return "district_championship";
  if (explicitType.includes("world") || explicitType.includes("championship")) return "world_championship";
  if (explicitType.includes("district")) return "district";
  if (explicitType.includes("regional")) return "regional";

  const numericType = toNumber(rawEvent.event_type, -1);
  if (numericType === 1) return "district";
  if (numericType === 2) return "district_championship";
  if (numericType === 3 || numericType === 4) return "world_championship";
  return "regional";
}

function extractTeamEventEPA(payload = {}) {
  const epa = payload.epa || payload.team_epa || {};
  const totalEPA = normalizeEPAValue(
    payload.total_epa ?? epa.total ?? epa.norm ?? epa.end ?? payload.epa_total,
    0
  );
  const autoEPA = normalizeEPAValue(payload.auto_epa ?? epa.auto ?? 0, 0);
  const teleopEPA = normalizeEPAValue(payload.teleop_epa ?? epa.teleop ?? 0, 0);
  const endgameEPA = normalizeEPAValue(payload.endgame_epa ?? epa.endgame ?? epa.end_game ?? 0, 0);

  return { totalEPA, autoEPA, teleopEPA, endgameEPA };
}

function parseDateValue(event = {}) {
  const dateCandidate = event.end_date || event.start_date || event.date;
  const parsed = new Date(dateCandidate);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

const eventOprCache = new Map();
const eventEpaCache = new Map();
const EVENT_EPA_CACHE_TTL_MS = Number(process.env.STATBOTICS_EVENT_CACHE_TTL_MS || 5 * 60 * 1000);

function mapTbaEventTypeToPricingType(eventType) {
  if (eventType === 1) return "district";
  if (eventType === 2) return "district_championship";
  if (eventType === 3 || eventType === 4) return "world_championship";
  return "regional";
}

async function getCachedEventOprs(eventKey) {
  if (eventOprCache.has(eventKey)) {
    return eventOprCache.get(eventKey);
  }

  const oprs = await getEventOprs(eventKey);
  eventOprCache.set(eventKey, oprs);
  return oprs;
}

async function request(endpoint, params = {}) {
  try {
    const response = await client.get(endpoint, { params });
    return response.data;
  } catch (error) {
    throw new StatboticsServiceError("Erro ao consultar Statbotics API", {
      endpoint,
      params,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
  }
}

async function requestWithFallback(endpoints = [], params = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await request(endpoint, params);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new StatboticsServiceError("Falha ao consultar endpoints alternativos da Statbotics API");
}

export function getCurrentSeasonYear() {
  return Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
}

export async function getTeamInfo(teamNumber) {
  const variants = buildTeamKeyVariants(teamNumber);
  const endpoints = variants.flatMap((teamKey) => [
    `/team/${teamKey}`,
    `/teams/${teamKey}`
  ]);
  return requestWithFallback(endpoints);
}

export async function getTeamYearProfile(teamNumber, year = getCurrentSeasonYear()) {
  const variants = buildTeamKeyVariants(teamNumber);
  const endpoints = variants.flatMap((teamKey) => [
    `/team_year/${teamKey}/${year}`,
    `/team_year/${year}/${teamKey}`,
    `/team/${teamKey}/year/${year}`
  ]);
  try {
    return await requestWithFallback(endpoints);
  } catch {
    return getTeamInfo(teamNumber);
  }
}

export async function getTeamEventStats(teamNumber, eventKey) {
  const variants = buildTeamKeyVariants(teamNumber);
  const endpoints = variants.flatMap((teamKey) => [
    `/team_event/${teamKey}/${eventKey}`,
    `/team_event/${eventKey}/${teamKey}`,
    `/team/${teamKey}/event/${eventKey}`
  ]);
  const data = await requestWithFallback(endpoints);
  const epaBreakdown = extractTeamEventEPA(data);
  return {
    eventKey,
    eventType: parseEventType(data),
    ...epaBreakdown
  };
}

function isOfficialEvent(event = {}) {
  const name = normalizeString(event.name);
  const type = parseEventType(event);
  const isOfficialByType = ["regional", "district", "district_championship", "world_championship"].includes(type);

  if (!isOfficialByType) return false;
  if (name.includes("offseason") || name.includes("preseason") || name.includes("scrimmage")) return false;
  return true;
}

export async function getLastOfficialTeamEvents(teamNumber, year = getCurrentSeasonYear(), limit = 3) {
  const safeLimit = Math.max(1, limit);
  const today = new Date();

  try {
    const candidateYears = [year, year - 1];
    const allTeamEvents = [];

    for (const candidateYear of candidateYears) {
      try {
        const yearEvents = await getTeamEventsByYear(teamNumber, candidateYear);
        if (Array.isArray(yearEvents) && yearEvents.length > 0) {
          allTeamEvents.push(...yearEvents);
        }
      } catch {
        // Continua para o próximo ano.
      }
    }

    const dedupedByKey = new Map();
    for (const event of allTeamEvents) {
      if (event?.key && !dedupedByKey.has(event.key)) {
        dedupedByKey.set(event.key, event);
      }
    }

    const officialEvents = [...dedupedByKey.values()]
      .filter((event) => [0, 1, 2, 3, 4].includes(Number(event.event_type)))
      .filter((event) => {
        const endDate = new Date(event.end_date || event.start_date);
        return Number.isFinite(endDate.getTime()) && endDate < today;
      })
      .sort((a, b) => parseDateValue(b) - parseDateValue(a))
      .slice(0, Math.max(safeLimit * 6, safeLimit));

    const teamKey = `frc${Number(teamNumber)}`;
    const resolved = await Promise.all(
      officialEvents.map(async (event) => {
        let totalEPA = 0;
        try {
          const oprPayload = await getCachedEventOprs(event.key);
          totalEPA = toNumber(oprPayload?.oprs?.[teamKey], 0);
        } catch {
          totalEPA = 0;
        }

        return {
          eventKey: event.key,
          eventName: event.name,
          eventType: mapTbaEventTypeToPricingType(Number(event.event_type)),
          totalEPA,
          autoEPA: 0,
          teleopEPA: 0,
          endgameEPA: 0
        };
      })
    );

    const withEpa = resolved.filter((event) => Number(event.totalEPA) > 0);
    if (withEpa.length > 0) {
      return withEpa.slice(0, safeLimit);
    }
  } catch {
    // fallback abaixo
  }

  let teamInfo = null;
  try {
    teamInfo = await getTeamInfo(teamNumber);
  } catch {
    teamInfo = null;
  }

  if (!teamInfo) {
    return [];
  }

  const norm = teamInfo?.norm_epa || {};
  const recent = normalizeEPAValue(norm.recent ?? norm.current ?? norm.mean, 0);
  const current = normalizeEPAValue(norm.current ?? norm.mean ?? norm.recent, recent);
  const mean = normalizeEPAValue(norm.mean ?? norm.current ?? norm.recent, current);

  const toOprLike = (value) => value > 0 ? value * 1.7 : 0;

  const bestSignal = recent || current || mean;
  if (bestSignal <= 0) {
    return [];
  }

  return [{
    eventKey: null,
    eventName: "Profile Fallback",
    eventType: "regional",
    totalEPA: toOprLike(bestSignal),
    autoEPA: 0,
    teleopEPA: 0,
    endgameEPA: 0
  }].slice(0, safeLimit);
}

function extractCountryTeamEPA(entry = {}) {
  const epa = entry.epa || {};
  const norm = entry.norm_epa || {};
  return normalizeEPAValue(entry.team_epa ?? entry.total_epa ?? epa.total ?? epa.norm ?? epa.end ?? norm.current ?? norm.mean ?? 0, 0);
}

async function getCountryTeamsFromTeamsEndpoint(country, year, pageSize = 200, maxPages = 20) {
  const allRows = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const rows = await request("/teams", {
      country,
      year,
      limit: pageSize,
      offset
    });

    if (!Array.isArray(rows) || rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  return allRows;
}

async function getCountryTeamsFromTeamYearsEndpoint(country, year, pageSize = 200, maxPages = 20) {
  const allRows = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const rows = await request("/team_years", {
      country,
      year,
      limit: pageSize,
      offset
    });

    if (!Array.isArray(rows) || rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  return allRows;
}

export async function getCountryAverageEPA(country, year = getCurrentSeasonYear()) {
  if (!country) {
    throw new StatboticsServiceError("País não informado para cálculo de média regional");
  }

  let rows = [];
  try {
    rows = await getCountryTeamsFromTeamsEndpoint(country, year);
  } catch {
    rows = await getCountryTeamsFromTeamYearsEndpoint(country, year);
  }

  const epas = rows
    .map(extractCountryTeamEPA)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (epas.length === 0) {
    throw new StatboticsServiceError("Não foi possível calcular média EPA do país", {
      country,
      year
    });
  }

  const total = epas.reduce((sum, value) => sum + value, 0);
  return total / epas.length;
}

export async function getTeamSeasonEPA(teamNumber, year = getCurrentSeasonYear()) {
  const profile = await getTeamYearProfile(teamNumber, year);
  const epa = profile?.epa || {};
  const norm = profile?.norm_epa || {};

  return normalizeEPAValue(profile?.total_epa ?? profile?.team_epa ?? epa.total ?? epa.norm ?? epa.end ?? norm.current ?? norm.mean ?? 0, 0);
}

export async function getTeamCountry(teamNumber, year = getCurrentSeasonYear()) {
  try {
    const profile = await getTeamYearProfile(teamNumber, year);
    const countryFromProfile = profile?.country || profile?.team?.country;
    if (countryFromProfile) return countryFromProfile;
  } catch {
    // Fallback para endpoint de time.
  }

  const team = await getTeamInfo(teamNumber);
  const country = team?.country || team?.address?.country || team?.location?.country;

  if (!country) {
    throw new StatboticsServiceError("Não foi possível identificar o país do time", {
      teamNumber,
      year
    });
  }

  return country;
}

function normalizeTeamKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("frc")) return raw;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `frc${digits}` : null;
}

function extractTeamKeyFromEventEntry(entry = {}) {
  return (
    normalizeTeamKey(entry.team_key) ||
    normalizeTeamKey(entry.team) ||
    normalizeTeamKey(entry.teamNumber) ||
    normalizeTeamKey(entry.team_number) ||
    normalizeTeamKey(entry?.team?.key) ||
    normalizeTeamKey(entry?.team?.team_key) ||
    normalizeTeamKey(entry?.team?.team_number)
  );
}

function extractEventTeamEPA(entry = {}) {
  const epa = entry.epa || entry.team_epa || {};
  const norm = entry.norm_epa || {};

  const event_epa = normalizeEPAValue(
    entry.event_epa ?? entry.total_epa ?? entry.team_epa ?? epa.total ?? epa.norm ?? epa.end ?? norm.current ?? norm.mean ?? 0,
    0
  );

  const auto_epa = normalizeEPAValue(entry.auto_epa ?? epa.auto ?? 0, 0);
  const teleop_epa = normalizeEPAValue(entry.teleop_epa ?? epa.teleop ?? 0, 0);
  const endgame_epa = normalizeEPAValue(entry.endgame_epa ?? epa.endgame ?? epa.end_game ?? 0, 0);

  return {
    event_epa,
    auto_epa,
    teleop_epa,
    endgame_epa
  };
}

async function fetchEventEpaRows(eventKey) {
  const endpoints = [
    `/event/${eventKey}/teams`,
    `/event_teams/${eventKey}`,
    `/event/${eventKey}/team_epas`
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const payload = await request(endpoint);
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.teams)) return payload.teams;
      if (Array.isArray(payload?.data)) return payload.data;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

export async function getEventEPAByTeam(eventKey) {
  const normalizedEventKey = String(eventKey || "").trim().toLowerCase();
  if (!normalizedEventKey) {
    throw new StatboticsServiceError("event_key inválido para buscar EPAs do evento");
  }

  const now = Date.now();
  const cached = eventEpaCache.get(normalizedEventKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const rows = await fetchEventEpaRows(normalizedEventKey);
  const map = new Map();

  for (const entry of rows) {
    const teamKey = extractTeamKeyFromEventEntry(entry);
    if (!teamKey) continue;

    map.set(teamKey, {
      team_key: teamKey,
      ...extractEventTeamEPA(entry)
    });
  }

  eventEpaCache.set(normalizedEventKey, {
    value: map,
    expiresAt: now + EVENT_EPA_CACHE_TTL_MS
  });

  return map;
}

export function clearStatboticsEventCache() {
  eventEpaCache.clear();
}

export { StatboticsServiceError };