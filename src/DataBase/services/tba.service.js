import axios from "axios";

const BASE_URL = process.env.TBA_BASE_URL || "https://www.thebluealliance.com/api/v3";
const REQUEST_TIMEOUT_MS = Number(process.env.TBA_TIMEOUT_MS || 12000);
const CACHE_TTL_MS = Number(process.env.TBA_CACHE_TTL_MS || 5 * 60 * 1000);

const client = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS
});

class TbaServiceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "TbaServiceError";
    this.details = details;
  }
}

const cache = new Map();

function withCache(key, resolver) {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = resolver();
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

function getHeaders() {
  if (!process.env.TBA_KEY) {
    throw new TbaServiceError("TBA_KEY não configurada no ambiente");
  }

  return {
    "X-TBA-Auth-Key": process.env.TBA_KEY
  };
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTeamKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("frc")) return raw;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `frc${digits}` : null;
}

function extractTeamKeyFromCard(card = {}) {
  return (
    normalizeTeamKey(card.team_key) ||
    normalizeTeamKey(card.teamKey) ||
    normalizeTeamKey(card.team) ||
    normalizeTeamKey(card.team_number) ||
    normalizeTeamKey(card.teamNumber)
  );
}

function extractCardType(card = {}) {
  return String(card.card_type || card.cardType || card.type || "").trim().toLowerCase();
}

function toTeamKeys(rawTeamKeys = []) {
  if (!Array.isArray(rawTeamKeys)) return [];
  return rawTeamKeys.map(normalizeTeamKey).filter(Boolean);
}

async function request(pathname, params = {}) {
  try {
    const response = await client.get(pathname, {
      headers: getHeaders(),
      params
    });
    return response.data;
  } catch (error) {
    throw new TbaServiceError("Erro ao consultar TBA API", {
      pathname,
      params,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
  }
}

export async function getEventTeams(eventKey) {
  const normalizedEventKey = String(eventKey || "").trim().toLowerCase();
  if (!normalizedEventKey) {
    throw new TbaServiceError("event_key inválido para buscar equipes");
  }

  const teams = await withCache(`event-teams:${normalizedEventKey}`, async () => {
    return request(`/event/${normalizedEventKey}/teams/simple`);
  });

  return Array.isArray(teams) ? teams : [];
}

export async function getEventMatches(eventKey) {
  const normalizedEventKey = String(eventKey || "").trim().toLowerCase();
  if (!normalizedEventKey) {
    throw new TbaServiceError("event_key inválido para buscar partidas");
  }

  const matches = await withCache(`event-matches:${normalizedEventKey}`, async () => {
    return request(`/event/${normalizedEventKey}/matches`);
  });

  return Array.isArray(matches) ? matches : [];
}

export async function getEventMatchStats(eventKey) {
  const matches = await getEventMatches(eventKey);
  const statsByTeam = new Map();

  for (const match of matches) {
    const isQualificationMatch = String(match?.comp_level || "").toLowerCase() === "qm";
    const redTeams = toTeamKeys(match?.alliances?.red?.team_keys);
    const blueTeams = toTeamKeys(match?.alliances?.blue?.team_keys);

    const redScore = toNumber(match?.alliances?.red?.score, -1);
    const blueScore = toNumber(match?.alliances?.blue?.score, -1);
    const hasValidScores = redScore >= 0 && blueScore >= 0;

    const breakdown = match?.score_breakdown || {};
    const redBreakdown = breakdown?.red || {};
    const blueBreakdown = breakdown?.blue || {};

    const redFoulCount = toNumber(redBreakdown?.foulCount, 0);
    const redTechFoulCount = toNumber(redBreakdown?.techFoulCount, 0);
    const blueFoulCount = toNumber(blueBreakdown?.foulCount, 0);
    const blueTechFoulCount = toNumber(blueBreakdown?.techFoulCount, 0);

    const ensureTeam = (teamKey) => {
      if (!teamKey) return null;
      if (!statsByTeam.has(teamKey)) {
        statsByTeam.set(teamKey, {
          team_key: teamKey,
          qualificationMatches: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          foulCount: 0,
          techFoulCount: 0,
          yellowCards: 0,
          redCards: 0
        });
      }
      return statsByTeam.get(teamKey);
    };

    const applyResult = (teamKeys, resultType) => {
      for (const teamKey of teamKeys) {
        const team = ensureTeam(teamKey);
        if (!team) continue;
        if (resultType === "win") team.wins += 1;
        if (resultType === "loss") team.losses += 1;
        if (resultType === "tie") team.ties += 1;
      }
    };

    const applyFouls = (teamKeys, foulCount, techFoulCount) => {
      for (const teamKey of teamKeys) {
        const team = ensureTeam(teamKey);
        if (!team) continue;
        team.foulCount += foulCount;
        team.techFoulCount += techFoulCount;
      }
    };

    const applyQualificationMatchPlayed = (teamKeys) => {
      for (const teamKey of teamKeys) {
        const team = ensureTeam(teamKey);
        if (!team) continue;
        team.qualificationMatches += 1;
      }
    };

    if (isQualificationMatch && hasValidScores) {
      applyQualificationMatchPlayed(redTeams);
      applyQualificationMatchPlayed(blueTeams);

      if (redScore > blueScore) {
        applyResult(redTeams, "win");
        applyResult(blueTeams, "loss");
      } else if (redScore < blueScore) {
        applyResult(redTeams, "loss");
        applyResult(blueTeams, "win");
      } else {
        applyResult(redTeams, "tie");
        applyResult(blueTeams, "tie");
      }

      applyFouls(redTeams, redFoulCount, redTechFoulCount);
      applyFouls(blueTeams, blueFoulCount, blueTechFoulCount);

      const cards = Array.isArray(match?.cards) ? match.cards : [];
      for (const card of cards) {
        const cardTeamKey = extractTeamKeyFromCard(card);
        const cardType = extractCardType(card);
        const team = ensureTeam(cardTeamKey);
        if (!team) continue;

        if (cardType.includes("yellow")) {
          team.yellowCards += 1;
        } else if (cardType.includes("red")) {
          team.redCards += 1;
        }
      }
    }
  }

  return statsByTeam;
}

export function clearTbaCache() {
  cache.clear();
}
