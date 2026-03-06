import Score from "../models/score.js";
import { getEventTeams, getEventMatchStats } from "./tba.service.js";
import { getEventEPAByTeam, getTeamEventStats } from "./statbotics.service.js";

const AUTO_EPA_STEP = 5;
const TELEOP_EPA_STEP = 5;
const ENDGAME_EPA_STEP = 3;

const AUTO_POINTS_PER_STEP = 2;
const TELEOP_POINTS_PER_STEP = 1.5;
const ENDGAME_POINTS_PER_STEP = 3;

const WIN_POINTS = 2;
const TIE_POINTS = 1;
const LOSS_POINTS = -2;

const PENALTY_PER_OCCURRENCE = -3;
const YELLOW_CARD_POINTS = -6;
const RED_CARD_POINTS = -15;

const BONUS_AUTO_EPA = 4;
const BONUS_TELEOP_EPA = 4;
const BONUS_ENDGAME_EPA = 4;

const EVENT_TEAMS_TIMEOUT_MS = Number(process.env.SCORING_TEAMS_TIMEOUT_MS || 10000);
const EVENT_MATCH_STATS_TIMEOUT_MS = Number(process.env.SCORING_MATCH_TIMEOUT_MS || 10000);
const EVENT_EPA_TIMEOUT_MS = Number(process.env.SCORING_EPA_TIMEOUT_MS || 30000);

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
    qualificationMatches: 0,
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
    withTimeout(getEventTeams(normalizedEventKey), EVENT_TEAMS_TIMEOUT_MS, "teams").catch(err => {
      console.warn(`⚠️ Falha ao puxar teams para ${normalizedEventKey}: ${err.message}`);
      return [];
    }),
    withTimeout(getEventMatchStats(normalizedEventKey), EVENT_MATCH_STATS_TIMEOUT_MS, "match stats").catch(err => {
      console.warn(`⚠️ Falha ao puxar match stats para ${normalizedEventKey}: ${err.message}`);
      return new Map();
    }),
    withTimeout(getEventEPAByTeam(normalizedEventKey), EVENT_EPA_TIMEOUT_MS, "EPA").catch(err => {
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

  const eligibleTeamKeys = uniqueTeamKeys.filter((teamKey) => {
    const matchStats = matchStatsByTeam.get(teamKey) || buildDefaultMatchStats(teamKey);
    return Number(matchStats.qualificationMatches || 0) > 0;
  });

  if (eligibleTeamKeys.length === 0) {
    await Score.deleteMany({ event_key: normalizedEventKey });
    return {
      event_key: normalizedEventKey,
      teamsCount: 0,
      ranking: []
    };
  }

  const eligibleEpaRows = epaRows.filter((row) => eligibleTeamKeys.includes(normalizeTeamKey(row?.team_key)));

  const bonusByTeam = new Map();

  const addBonus = (teamKey, amount) => {
    if (!teamKey) return;
    bonusByTeam.set(teamKey, Number(bonusByTeam.get(teamKey) || 0) + amount);
  };

  const topAutoEligibleTeam = getTopTeamKey(eligibleEpaRows, "auto_epa");
  const topTeleopEligibleTeam = getTopTeamKey(eligibleEpaRows, "teleop_epa");
  const topEndgameEligibleTeam = getTopTeamKey(eligibleEpaRows, "endgame_epa");

  addBonus(topAutoEligibleTeam, BONUS_AUTO_EPA);
  addBonus(topTeleopEligibleTeam, BONUS_TELEOP_EPA);
  addBonus(topEndgameEligibleTeam, BONUS_ENDGAME_EPA);

  const scoreDocs = [];

  for (const teamKey of eligibleTeamKeys) {
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

    const bonusAutoPoints = teamKey === topAutoEligibleTeam ? BONUS_AUTO_EPA : 0;
    const bonusTeleopPoints = teamKey === topTeleopEligibleTeam ? BONUS_TELEOP_EPA : 0;
    const bonusEndgamePoints = teamKey === topEndgameEligibleTeam ? BONUS_ENDGAME_EPA : 0;
    const bonusPoints = Number(bonusByTeam.get(teamKey) || 0);
    const totalPoints = autoPoints + teleopPoints + endgamePoints + winPoints + penaltyPoints + bonusPoints;

    scoreDocs.push({
      team_key: teamKey,
      event_key: normalizedEventKey,
      qualificationMatches: Number(matchStats.qualificationMatches || 0),
      wins: Number(matchStats.wins || 0),
      losses: Number(matchStats.losses || 0),
      ties: Number(matchStats.ties || 0),
      foulCount: Number(matchStats.foulCount || 0),
      techFoulCount: Number(matchStats.techFoulCount || 0),
      yellowCards: Number(matchStats.yellowCards || 0),
      redCards: Number(matchStats.redCards || 0),
      autoEPA: Number(epa.auto_epa || 0),
      teleopEPA: Number(epa.teleop_epa || 0),
      endgameEPA: Number(epa.endgame_epa || 0),
      autoPoints,
      teleopPoints,
      endgamePoints,
      bonusAutoPoints,
      bonusTeleopPoints,
      bonusEndgamePoints,
      winPoints,
      penaltyPoints,
      bonusPoints,
      totalPoints,
      createdAt: new Date()
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

  await Score.deleteMany({
    event_key: normalizedEventKey,
    team_key: { $nin: scoreDocs.map((doc) => doc.team_key) }
  });

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
