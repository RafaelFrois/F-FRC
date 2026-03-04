import Score from "../models/score.js";
import { getEventTeams, getEventMatchStats } from "./tba.service.js";
import { getEventEPAByTeam, getTeamEventStats } from "./statbotics.service.js";

const AUTO_EPA_STEP = 5;
const TELEOP_EPA_STEP = 5;
const ENDGAME_EPA_STEP = 3;

const AUTO_POINTS_PER_STEP = 2;
const TELEOP_POINTS_PER_STEP = 0.5;
const ENDGAME_POINTS_PER_STEP = 3;

const WIN_POINTS = 2;
const TIE_POINTS = 1;
const LOSS_POINTS = -2;

const PENALTY_PER_OCCURRENCE = -3;
const YELLOW_CARD_POINTS = -6;
const RED_CARD_POINTS = -15;

const BONUS_EVENT_EPA = 6;
const BONUS_AUTO_EPA = 4;
const BONUS_TELEOP_EPA = 4;
const BONUS_ENDGAME_EPA = 4;

const SCORE_CACHE_TTL_MS = Number(process.env.SCORING_EVENT_CACHE_TTL_MS || 5 * 60 * 1000);
const eventRuntimeCache = new Map();

class ScoringServiceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ScoringServiceError";
    this.details = details;
  }
}

function normalizeTeamKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("frc")) return raw;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `frc${digits}` : null;
}

function floorStepPoints(value, step, pointsPerStep) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }
  return Math.floor(numericValue / step) * pointsPerStep;
}

function getTopTeamKey(rows, fieldName) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => Number(b?.[fieldName] || 0) - Number(a?.[fieldName] || 0));
  return normalizeTeamKey(sorted[0]?.team_key);
}

function buildDefaultMatchStats(teamKey) {
  return {
    team_key: teamKey,
    wins: 0,
    losses: 0,
    ties: 0,
    foulCount: 0,
    techFoulCount: 0,
    yellowCards: 0,
    redCards: 0
  };
}

async function getEventDataset(eventKey) {
  const normalizedEventKey = String(eventKey || "").trim().toLowerCase();
  if (!normalizedEventKey) {
    throw new ScoringServiceError("event_key inválido");
  }

  const now = Date.now();
  const cached = eventRuntimeCache.get(normalizedEventKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  // Função auxiliar para adicionar timeout
  const withTimeout = (promise, timeoutMs, label) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout ao buscar ${label} após ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  };

  const [teams, matchStatsByTeam, eventEpaResult] = await Promise.allSettled([
    withTimeout(getEventTeams(normalizedEventKey), 8000, "teams").catch(err => {
      console.warn(`⚠️ Falha ao puxar teams para ${normalizedEventKey}: ${err.message}`);
      return [];
    }),
    withTimeout(getEventMatchStats(normalizedEventKey), 8000, "match stats").catch(err => {
      console.warn(`⚠️ Falha ao puxar match stats para ${normalizedEventKey}: ${err.message}`);
      return new Map();
    }),
    withTimeout(getEventEPAByTeam(normalizedEventKey), 8000, "EPA").catch(err => {
      console.warn(`⚠️ Falha ao puxar EPA de Statbotics para ${normalizedEventKey}: ${err.message}. Continuando sem EPA.`);
      return new Map();
    })
  ]).then(results => {
    const values = [null, null, null];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled") {
        values[i] = results[i].value;
      } else {
        console.warn(`⚠️ Promise ${i} rejeitada: ${results[i].reason.message}`);
        values[i] = i === 2 ? new Map() : (i === 1 ? new Map() : []);
      }
    }
    return values;
  });

  const eventEpaMap = eventEpaResult instanceof Map ? eventEpaResult : new Map();

  const value = {
    teams: teams || [],
    matchStatsByTeam: matchStatsByTeam || new Map(),
    eventEpaMap
  };

  eventRuntimeCache.set(normalizedEventKey, {
    value,
    expiresAt: now + SCORE_CACHE_TTL_MS
  });

  return value;
}

async function ensureTeamEventEpa(teamKey, eventKey, eventEpaMap) {
  const normalizedTeamKey = normalizeTeamKey(teamKey);
  if (!normalizedTeamKey) {
    return {
      team_key: teamKey,
      event_epa: 0,
      auto_epa: 0,
      teleop_epa: 0,
      endgame_epa: 0
    };
  }

  if (eventEpaMap.has(normalizedTeamKey)) {
    return eventEpaMap.get(normalizedTeamKey);
  }

  try {
    const teamNumber = Number(normalizedTeamKey.replace("frc", ""));
    const fallback = await getTeamEventStats(teamNumber, eventKey);
    const data = {
      team_key: normalizedTeamKey,
      event_epa: Number(fallback?.totalEPA || 0),
      auto_epa: Number(fallback?.autoEPA || 0),
      teleop_epa: Number(fallback?.teleopEPA || 0),
      endgame_epa: Number(fallback?.endgameEPA || 0)
    };

    eventEpaMap.set(normalizedTeamKey, data);
    return data;
  } catch {
    const data = {
      team_key: normalizedTeamKey,
      event_epa: 0,
      auto_epa: 0,
      teleop_epa: 0,
      endgame_epa: 0
    };
    eventEpaMap.set(normalizedTeamKey, data);
    return data;
  }
}

export async function calculateEventScores(eventKey) {
  const normalizedEventKey = String(eventKey || "").trim().toLowerCase();
  if (!normalizedEventKey) {
    throw new ScoringServiceError("event_key inválido");
  }

  const { teams, matchStatsByTeam, eventEpaMap } = await getEventDataset(normalizedEventKey);

  if (!Array.isArray(teams) || teams.length === 0) {
    throw new ScoringServiceError("Nenhuma equipe encontrada para o evento", {
      event_key: normalizedEventKey
    });
  }

  const teamKeys = teams
    .map((team) => normalizeTeamKey(team?.key || team?.team_key || team?.teamNumber || team?.team_number))
    .filter(Boolean);

  const uniqueTeamKeys = [...new Set(teamKeys)];

  const epaRows = await Promise.all(
    uniqueTeamKeys.map((teamKey) => ensureTeamEventEpa(teamKey, normalizedEventKey, eventEpaMap))
  );

  const bonusByTeam = new Map();
  const topEventTeam = getTopTeamKey(epaRows, "event_epa");
  const topAutoTeam = getTopTeamKey(epaRows, "auto_epa");
  const topTeleopTeam = getTopTeamKey(epaRows, "teleop_epa");
  const topEndgameTeam = getTopTeamKey(epaRows, "endgame_epa");

  const addBonus = (teamKey, amount) => {
    if (!teamKey) return;
    bonusByTeam.set(teamKey, Number(bonusByTeam.get(teamKey) || 0) + amount);
  };

  addBonus(topEventTeam, BONUS_EVENT_EPA);
  addBonus(topAutoTeam, BONUS_AUTO_EPA);
  addBonus(topTeleopTeam, BONUS_TELEOP_EPA);
  addBonus(topEndgameTeam, BONUS_ENDGAME_EPA);

  const scoreDocs = [];

  for (const teamKey of uniqueTeamKeys) {
    const epa = eventEpaMap.get(teamKey) || {
      event_epa: 0,
      auto_epa: 0,
      teleop_epa: 0,
      endgame_epa: 0
    };

    const matchStats = matchStatsByTeam.get(teamKey) || buildDefaultMatchStats(teamKey);

    const autoPoints = floorStepPoints(epa.auto_epa, AUTO_EPA_STEP, AUTO_POINTS_PER_STEP);
    const teleopPoints = floorStepPoints(epa.teleop_epa, TELEOP_EPA_STEP, TELEOP_POINTS_PER_STEP);
    const endgamePoints = floorStepPoints(epa.endgame_epa, ENDGAME_EPA_STEP, ENDGAME_POINTS_PER_STEP);

    const winPoints =
      Number(matchStats.wins || 0) * WIN_POINTS +
      Number(matchStats.ties || 0) * TIE_POINTS +
      Number(matchStats.losses || 0) * LOSS_POINTS;

    const penaltyOccurrences = Number(matchStats.foulCount || 0) + Number(matchStats.techFoulCount || 0);
    const penaltyPoints =
      penaltyOccurrences * PENALTY_PER_OCCURRENCE +
      Number(matchStats.yellowCards || 0) * YELLOW_CARD_POINTS +
      Number(matchStats.redCards || 0) * RED_CARD_POINTS;

    const bonusPoints = Number(bonusByTeam.get(teamKey) || 0);
    const totalPoints = autoPoints + teleopPoints + endgamePoints + winPoints + penaltyPoints + bonusPoints;

    scoreDocs.push({
      team_key: teamKey,
      event_key: normalizedEventKey,
      autoPoints,
      teleopPoints,
      endgamePoints,
      winPoints,
      penaltyPoints,
      bonusPoints,
      totalPoints,
      createdAt: new Date()
    });
  }

  if (scoreDocs.length === 0) {
    throw new ScoringServiceError("Nenhuma pontuação foi calculada para o evento", {
      event_key: normalizedEventKey
    });
  }

  await Score.bulkWrite(
    scoreDocs.map((doc) => ({
      updateOne: {
        filter: {
          event_key: doc.event_key,
          team_key: doc.team_key
        },
        update: { $set: doc },
        upsert: true
      }
    }))
  );

  const ranking = await Score.find({ event_key: normalizedEventKey })
    .sort({ totalPoints: -1, bonusPoints: -1, winPoints: -1, team_key: 1 })
    .lean();

  return {
    event_key: normalizedEventKey,
    teamsCount: ranking.length,
    ranking
  };
}

export function clearScoringEventCache() {
  eventRuntimeCache.clear();
}
