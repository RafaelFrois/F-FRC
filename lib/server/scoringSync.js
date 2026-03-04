import User from "../../src/DataBase/models/Users.js";
import Score from "../../src/DataBase/models/score.js";
import RegionalTeam from "../../src/DataBase/models/regionalTeam.js";
import { calculateEventScores } from "../../src/DataBase/services/scoring.service.js";
import { getEventsByYear, getTeamsByEvent } from "../../src/DataBase/services/tba.services.js";

const weekRefreshState = new Map();
const weekEventsCache = new Map();
const weekEventsInFlight = new Map();
const WEEK_EVENTS_CACHE_TTL_MS = Math.max(0, Number(process.env.WEEK_EVENTS_CACHE_TTL_MS || 10 * 60 * 1000));

function normalizeEventKey(eventKey) {
  return String(eventKey || "").trim().toLowerCase();
}

function parseTeamNumberFromTeamKey(teamKey) {
  const digits = String(teamKey || "").replace(/[^0-9]/g, "");
  const number = Number(digits);
  return Number.isFinite(number) ? number : null;
}

function getWeekNumberFromDate(dateInput, seasonYear) {
  const week1Start = new Date(seasonYear, 2, 1);
  const eventDate = new Date(dateInput);
  let eventWeek = 1;

  if (eventDate >= new Date(seasonYear, 2, 8)) {
    const daysSinceWeek1 = Math.floor((eventDate - week1Start) / (1000 * 60 * 60 * 24));
    eventWeek = Math.floor(daysSinceWeek1 / 7) + 1;
  }

  return eventWeek;
}

export function getCurrentWeek(seasonYear) {
  const today = new Date();
  const week1Start = new Date(seasonYear, 2, 1);
  const week1End = new Date(seasonYear, 2, 8);
  const week1AvailableFrom = new Date(week1Start.getTime() - 14 * 24 * 60 * 60 * 1000);

  if (today >= week1AvailableFrom && today <= week1End) {
    return 1;
  }

  if (today > week1End) {
    const daysSinceWeek1Start = Math.floor((today - week1Start) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(daysSinceWeek1Start / 7) + 1);
  }

  return 1;
}

export async function getWeekEvents(seasonYear, week) {
  const cacheKey = `${seasonYear}:${week}`;
  const now = Date.now();
  const cached = weekEventsCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.events;
  }

  if (weekEventsInFlight.has(cacheKey)) {
    return weekEventsInFlight.get(cacheKey);
  }

  const fetchPromise = (async () => {
    const events = await getEventsByYear(seasonYear);
    const regionalEvents = (Array.isArray(events) ? events : []).filter(
      (event) => event?.event_type === 0 || event?.event_type === 1
    );

    const weekEvents = regionalEvents.filter((event) => getWeekNumberFromDate(event?.start_date, seasonYear) === week);

    weekEventsCache.set(cacheKey, {
      events: weekEvents,
      expiresAt: Date.now() + WEEK_EVENTS_CACHE_TTL_MS
    });

    return weekEvents;
  });

  weekEventsInFlight.set(cacheKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    weekEventsInFlight.delete(cacheKey);
  }
}

function buildScoreMap(scoreRows) {
  const map = new Map();

  for (const row of Array.isArray(scoreRows) ? scoreRows : []) {
    const eventKey = normalizeEventKey(row?.event_key);
    const teamNumber = parseTeamNumberFromTeamKey(row?.team_key);
    if (!eventKey || !teamNumber) continue;

    map.set(`${eventKey}:${teamNumber}`, Number(row?.totalPoints || 0));
  }

  return map;
}

function recalculateUserWithScoreMap(user, scoreMap) {
  let changed = false;
  const regionals = Array.isArray(user?.regionals) ? user.regionals : [];

  for (const regional of regionals) {
    const eventKey = normalizeEventKey(regional?.eventKey);
    if (!eventKey || !Array.isArray(regional?.alliance)) continue;

    let regionalTotal = 0;
    for (const member of regional.alliance) {
      const teamNumber = Number(member?.teamNumber);
      if (!Number.isFinite(teamNumber)) continue;

      const points = Number(scoreMap.get(`${eventKey}:${teamNumber}`) || 0);
      if (Number(member?.points || 0) !== points) {
        member.points = points;
        changed = true;
      }

      regionalTotal += points;
    }

    if (Number(regional?.totalRegionalPoints || 0) !== regionalTotal) {
      regional.totalRegionalPoints = regionalTotal;
      changed = true;
    }
  }

  const totalPointsSeason = regionals.reduce((sum, regional) => {
    return sum + Number(regional?.totalRegionalPoints || 0);
  }, 0);

  if (Number(user?.totalPointsSeason || 0) !== totalPointsSeason) {
    user.totalPointsSeason = totalPointsSeason;
    changed = true;
  }

  return changed;
}

function isPlaceholderTeamName(name, teamNumber) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return true;
  return normalized === `team ${Number(teamNumber)}` || normalized === "nome da equipe";
}

async function hydrateUserAllianceTeamNames(user) {
  const regionals = Array.isArray(user?.regionals) ? user.regionals : [];
  const entriesToHydrate = regionals.flatMap((regional) => {
    const eventKey = normalizeEventKey(regional?.eventKey);
    if (!eventKey || !Array.isArray(regional?.alliance)) return [];

    return regional.alliance
      .map((member) => ({ eventKey, teamNumber: Number(member?.teamNumber), nickname: member?.nickname }))
      .filter((entry) => Number.isFinite(entry.teamNumber) && isPlaceholderTeamName(entry.nickname, entry.teamNumber));
  });

  const eventKeysToHydrate = [...new Set(
    regionals
      .filter((regional) => Array.isArray(regional?.alliance) && regional.alliance.some((member) => {
        const teamNumber = Number(member?.teamNumber);
        return Number.isFinite(teamNumber) && isPlaceholderTeamName(member?.nickname, teamNumber);
      }))
      .map((regional) => normalizeEventKey(regional?.eventKey))
      .filter(Boolean)
  )];

  if (eventKeysToHydrate.length === 0) {
    return false;
  }

  const teamNameByEventAndNumber = new Map();

  const teamNumbersToHydrate = [...new Set(entriesToHydrate.map((entry) => Number(entry.teamNumber)).filter(Number.isFinite))];
  if (teamNumbersToHydrate.length > 0) {
    const cachedRegionalTeams = await RegionalTeam.find({
      event_key: { $in: eventKeysToHydrate },
      team_number: { $in: teamNumbersToHydrate }
    }).lean();

    for (const row of cachedRegionalTeams) {
      const eventKey = normalizeEventKey(row?.event_key);
      const teamNumber = Number(row?.team_number);
      const nickname = String(row?.nickname || row?.name || "").trim();
      if (!eventKey || !Number.isFinite(teamNumber) || !nickname) continue;
      teamNameByEventAndNumber.set(`${eventKey}:${teamNumber}`, nickname);
    }
  }

  for (const eventKey of eventKeysToHydrate) {
    const missingForEvent = entriesToHydrate
      .filter((entry) => entry.eventKey === eventKey)
      .filter((entry) => !teamNameByEventAndNumber.has(`${eventKey}:${entry.teamNumber}`));

    if (missingForEvent.length === 0) continue;

    try {
      const teams = await getTeamsByEvent(eventKey);
      for (const team of teams) {
        const number = Number(team?.team_number);
        const nickname = String(team?.nickname || team?.name || "").trim();
        if (!Number.isFinite(number) || !nickname) continue;
        teamNameByEventAndNumber.set(`${eventKey}:${number}`, nickname);
      }
    } catch {
      // segue para os próximos eventos
    }
  }

  let changed = false;
  for (const regional of regionals) {
    const eventKey = normalizeEventKey(regional?.eventKey);
    if (!eventKey || !Array.isArray(regional?.alliance)) continue;

    for (const member of regional.alliance) {
      const teamNumber = Number(member?.teamNumber);
      if (!Number.isFinite(teamNumber)) continue;

      if (!isPlaceholderTeamName(member?.nickname, teamNumber)) continue;

      const resolved = teamNameByEventAndNumber.get(`${eventKey}:${teamNumber}`);
      if (!resolved) continue;

      member.nickname = resolved;
      changed = true;
    }
  }

  return changed;
}

export async function refreshUsersScoresByEventKeys(eventKeys) {
  const normalizedKeys = [...new Set((Array.isArray(eventKeys) ? eventKeys : []).map(normalizeEventKey).filter(Boolean))];
  if (normalizedKeys.length === 0) {
    return { updatedUsers: 0 };
  }

  const users = await User.find({ "regionals.eventKey": { $in: normalizedKeys } });
  if (users.length === 0) {
    return { updatedUsers: 0 };
  }

  const scoreRows = await Score.find({ event_key: { $in: normalizedKeys } }).lean();
  const scoreMap = buildScoreMap(scoreRows);

  let updatedUsers = 0;
  for (const user of users) {
    const changed = recalculateUserWithScoreMap(user, scoreMap);
    if (!changed) continue;

    user.markModified("regionals");
    try {
      await user.save();
      updatedUsers += 1;
    } catch (err) {
      // Versioning conflict - retry com updateOne direto
      if (err.message && err.message.includes("No matching document found for id")) {
        try {
          const updateData = {
            regionals: user.regionals,
            totalPointsSeason: user.totalPointsSeason
          };
          await User.updateOne({ _id: user._id }, { $set: updateData }, { overwrite: false });
          updatedUsers += 1;
        } catch (updateErr) {
          console.warn(`⚠️ Não foi possível atualizar usuário ${user._id}: ${updateErr.message}`);
        }
      } else {
        console.error(`❌ Erro ao salvar usuário ${user._id}: ${err.message}`);
      }
    }
  }

  return { updatedUsers };
}

export async function refreshSingleUserScores(user) {
  const regionals = Array.isArray(user?.regionals) ? user.regionals : [];
  const eventKeys = [...new Set(regionals.map((regional) => normalizeEventKey(regional?.eventKey)).filter(Boolean))];

  if (eventKeys.length === 0) {
    if (Number(user?.totalPointsSeason || 0) !== 0) {
      user.totalPointsSeason = 0;
      return true;
    }
    return false;
  }

  const scoreRows = await Score.find({ event_key: { $in: eventKeys } }).lean();
  const scoreMap = buildScoreMap(scoreRows);
  const scoreChanged = recalculateUserWithScoreMap(user, scoreMap);
  const namesChanged = await hydrateUserAllianceTeamNames(user);

  return scoreChanged || namesChanged;
}

async function recalculateWeekEventScores(eventKeys) {
  if (eventKeys.length === 0) {
    return { totalEvents: 0, calculatedEvents: 0, failedEvents: 0, failedEventsDetails: [] };
  }

  const results = await Promise.allSettled(eventKeys.map((eventKey) => calculateEventScores(eventKey)));

  const failedEventsDetails = [];
  const calculatedEvents = results.filter((entry, index) => {
    if (entry.status === "fulfilled") {
      return true;
    } else {
      failedEventsDetails.push({
        eventKey: eventKeys[index],
        error: entry.reason?.message || String(entry.reason)
      });
      console.error(`❌ Falha ao calcular evento ${eventKeys[index]}: ${entry.reason?.message || entry.reason}`);
      return false;
    }
  }).length;
  
  const failedEvents = results.length - calculatedEvents;

  if (failedEvents > 0) {
    console.warn(`⚠️ ${failedEvents} evento(s) falharam no cálculo de pontuação`);
  }

  return {
    totalEvents: eventKeys.length,
    calculatedEvents,
    failedEvents,
    failedEventsDetails
  };
}

export async function ensureWeekScoresFresh(seasonYear, week, options = {}) {
  const minIntervalMs = Math.max(0, Number(options?.minIntervalMs || process.env.WEEK_SCORE_REFRESH_MIN_INTERVAL_MS || 120000));
  const refreshKey = `${seasonYear}:${week}`;
  const now = Date.now();
  const lastRun = weekRefreshState.get(refreshKey) || 0;

  if (!options?.force && minIntervalMs > 0 && now - lastRun < minIntervalMs) {
    return { skipped: true, reason: "THROTTLED" };
  }

  const weekEvents = await getWeekEvents(seasonYear, week);
  const eventKeys = weekEvents.map((event) => normalizeEventKey(event?.key)).filter(Boolean);

  const scoreSummary = await recalculateWeekEventScores(eventKeys);
  const userSummary = await refreshUsersScoresByEventKeys(eventKeys);

  weekRefreshState.set(refreshKey, now);

  return {
    skipped: false,
    eventKeys,
    scoreSummary,
    userSummary
  };
}
