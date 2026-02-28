import TeamMarketSnapshot from "../models/teamMarketSnapshot.js";
import { getEventsByYear, getTeamsByEvent } from "./tba.services.js";
import { calculateTeamMarketPrice } from "./pricing.service.js";

const OFFICIAL_EVENT_TYPES = new Set([0, 1]);

function normalizeDateOnly(dateInput) {
  if (!dateInput) return null;
  return String(dateInput).split("T")[0];
}

function getWeekNumberFromDate(dateInput, seasonYear) {
  const date = new Date(dateInput);
  const week1Start = new Date(seasonYear, 2, 1); // 01/03

  if (date < new Date(seasonYear, 2, 8)) {
    return 1;
  }

  const daysSinceWeek1 = Math.floor((date - week1Start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(daysSinceWeek1 / 7) + 1);
}

function isOfficialEvent(event) {
  return OFFICIAL_EVENT_TYPES.has(event?.event_type);
}

async function getRegionalsByWeek(seasonYear, weekNumber) {
  const events = await getEventsByYear(seasonYear);

  return events.filter((event) => {
    if (!isOfficialEvent(event)) return false;
    const eventWeek = getWeekNumberFromDate(event.start_date, seasonYear);
    return eventWeek === weekNumber;
  });
}

async function getUniqueTeamsFromRegionals(regionals) {
  const allTeamsByRegional = await Promise.all(
    regionals.map(async (regional) => {
      try {
        const eventKey = regional.key || regional.event_key;
        if (!eventKey) return [];
        const teams = await getTeamsByEvent(eventKey);
        return teams.map((team) => Number(team.team_number)).filter(Number.isFinite);
      } catch (error) {
        console.error("❌ Erro ao buscar times do regional", regional?.key, error.message);
        return [];
      }
    })
  );

  return [...new Set(allTeamsByRegional.flat())];
}

export async function generateWeekMarketSnapshot(seasonYear, weekNumber) {
  try {
    // 1) Buscar regionais oficiais da week.
    const regionals = await getRegionalsByWeek(seasonYear, weekNumber);

    if (regionals.length === 0) {
      return {
        totalTeamsProcessed: 0,
        totalCreated: 0,
        totalSkipped: 0
      };
    }

    // 2) Extrair todos os times dos regionais e remover duplicados.
    const uniqueTeamNumbers = await getUniqueTeamsFromRegionals(regionals);
    const totalTeamsProcessed = uniqueTeamNumbers.length;

    if (totalTeamsProcessed === 0) {
      return {
        totalTeamsProcessed,
        totalCreated: 0,
        totalSkipped: 0
      };
    }

    // 3) Descobrir snapshots já existentes para não recalcular.
    const existingSnapshots = await TeamMarketSnapshot.find({
      season: seasonYear,
      week: weekNumber,
      teamNumber: { $in: uniqueTeamNumbers }
    }).select("teamNumber -_id");

    const existingTeamSet = new Set(existingSnapshots.map((snapshot) => Number(snapshot.teamNumber)));
    const teamsToCalculate = uniqueTeamNumbers.filter((teamNumber) => !existingTeamSet.has(teamNumber));

    let totalCreated = 0;

    // 4) Calcula preço apenas para times sem snapshot e persiste congelado na semana.
    for (const teamNumber of teamsToCalculate) {
      try {
        const breakdown = await calculateTeamMarketPrice(teamNumber, seasonYear);

        await TeamMarketSnapshot.updateOne(
          { teamNumber, season: seasonYear, week: weekNumber },
          {
            $setOnInsert: {
              teamNumber,
              season: seasonYear,
              week: weekNumber,
              price: breakdown.finalPrice,
              weightedEPA: breakdown.weightedEPA,
              trendFactor: breakdown.trendFactor,
              regionalFactor: breakdown.regionalFactor,
              calculatedAt: new Date()
            }
          },
          { upsert: true }
        );

        totalCreated += 1;
      } catch (error) {
        console.error(`❌ Erro ao gerar snapshot do time ${teamNumber}:`, error.message);
      }
    }

    return {
      totalTeamsProcessed,
      totalCreated,
      totalSkipped: totalTeamsProcessed - totalCreated
    };
  } catch (error) {
    console.error("❌ Falha em generateWeekMarketSnapshot:", error.message);
    throw error;
  }
}

export async function getTeamPriceForWeek(teamNumber, seasonYear, weekNumber) {
  // Sempre lê o preço congelado da coleção de snapshots (nunca recalcula aqui).
  const snapshot = await TeamMarketSnapshot.findOne({
    teamNumber: Number(teamNumber),
    season: Number(seasonYear),
    week: Number(weekNumber)
  });

  return snapshot;
}

export async function ensureTeamPriceForWeek(teamNumber, seasonYear, weekNumber) {
  const normalizedTeam = Number(teamNumber);
  const normalizedSeason = Number(seasonYear);
  const normalizedWeek = Number(weekNumber);

  let snapshot = await getTeamPriceForWeek(normalizedTeam, normalizedSeason, normalizedWeek);
  if (snapshot) {
    return snapshot;
  }

  const breakdown = await calculateTeamMarketPrice(normalizedTeam, normalizedSeason);

  await TeamMarketSnapshot.updateOne(
    { teamNumber: normalizedTeam, season: normalizedSeason, week: normalizedWeek },
    {
      $setOnInsert: {
        teamNumber: normalizedTeam,
        season: normalizedSeason,
        week: normalizedWeek,
        price: breakdown.finalPrice,
        weightedEPA: breakdown.weightedEPA,
        trendFactor: breakdown.trendFactor,
        regionalFactor: breakdown.regionalFactor,
        calculatedAt: new Date()
      }
    },
    { upsert: true }
  );

  snapshot = await getTeamPriceForWeek(normalizedTeam, normalizedSeason, normalizedWeek);
  return snapshot;
}

export async function recalculateTeamPriceForWeek(teamNumber, seasonYear, weekNumber) {
  const normalizedTeam = Number(teamNumber);
  const normalizedSeason = Number(seasonYear);
  const normalizedWeek = Number(weekNumber);

  const breakdown = await calculateTeamMarketPrice(normalizedTeam, normalizedSeason);

  await TeamMarketSnapshot.updateOne(
    { teamNumber: normalizedTeam, season: normalizedSeason, week: normalizedWeek },
    {
      $set: {
        teamNumber: normalizedTeam,
        season: normalizedSeason,
        week: normalizedWeek,
        price: breakdown.finalPrice,
        weightedEPA: breakdown.weightedEPA,
        trendFactor: breakdown.trendFactor,
        regionalFactor: breakdown.regionalFactor,
        calculatedAt: new Date()
      }
    },
    { upsert: true }
  );

  return getTeamPriceForWeek(normalizedTeam, normalizedSeason, normalizedWeek);
}

export async function hasWeekSnapshot(seasonYear, weekNumber) {
  const existing = await TeamMarketSnapshot.exists({
    season: Number(seasonYear),
    week: Number(weekNumber)
  });

  return Boolean(existing);
}

export async function getTeamPricesForWeek(teamNumbers, seasonYear, weekNumber) {
  const normalizedTeamNumbers = [...new Set((teamNumbers || [])
    .map((teamNumber) => Number(teamNumber))
    .filter(Number.isFinite))];

  if (normalizedTeamNumbers.length === 0) {
    return [];
  }

  return TeamMarketSnapshot.find({
    teamNumber: { $in: normalizedTeamNumbers },
    season: Number(seasonYear),
    week: Number(weekNumber)
  });
}

export async function generateSnapshotsForTeams(teamNumbers, seasonYear, weekNumber) {
  const normalizedTeamNumbers = [...new Set((teamNumbers || [])
    .map((teamNumber) => Number(teamNumber))
    .filter(Number.isFinite))];

  if (normalizedTeamNumbers.length === 0) {
    return { totalCreated: 0, totalSkipped: 0 };
  }

  const existing = await TeamMarketSnapshot.find({
    teamNumber: { $in: normalizedTeamNumbers },
    season: Number(seasonYear),
    week: Number(weekNumber)
  }).select("teamNumber -_id");

  const existingSet = new Set(existing.map((snapshot) => Number(snapshot.teamNumber)));
  const missing = normalizedTeamNumbers.filter((teamNumber) => !existingSet.has(teamNumber));

  let totalCreated = 0;
  const CONCURRENCY = 10;

  for (let index = 0; index < missing.length; index += CONCURRENCY) {
    const chunk = missing.slice(index, index + CONCURRENCY);

    const chunkResults = await Promise.all(
      chunk.map(async (teamNumber) => {
        try {
          const breakdown = await calculateTeamMarketPrice(teamNumber, seasonYear);
          await TeamMarketSnapshot.updateOne(
            { teamNumber, season: Number(seasonYear), week: Number(weekNumber) },
            {
              $setOnInsert: {
                teamNumber,
                season: Number(seasonYear),
                week: Number(weekNumber),
                price: breakdown.finalPrice,
                weightedEPA: breakdown.weightedEPA,
                trendFactor: breakdown.trendFactor,
                regionalFactor: breakdown.regionalFactor,
                calculatedAt: new Date()
              }
            },
            { upsert: true }
          );

          return 1;
        } catch (error) {
          console.error(`❌ Erro ao gerar snapshot em lote do time ${teamNumber}:`, error.message);
          return 0;
        }
      })
    );

    totalCreated += chunkResults.reduce((sum, value) => sum + value, 0);
  }

  return {
    totalCreated,
    totalSkipped: normalizedTeamNumbers.length - totalCreated
  };
}

export async function getWeekToGenerateForToday(seasonYear, today = new Date()) {
  const todayDate = normalizeDateOnly(today.toISOString());
  const events = await getEventsByYear(seasonYear);

  const eventsStartingToday = events.filter((event) => {
    if (!isOfficialEvent(event)) return false;
    return normalizeDateOnly(event.start_date) === todayDate;
  });

  if (eventsStartingToday.length === 0) {
    return null;
  }

  const weekNumbers = eventsStartingToday
    .map((event) => getWeekNumberFromDate(event.start_date, seasonYear))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  return weekNumbers[0] || null;
}

export async function generateUpcomingWeeksMarketSnapshots(seasonYear, today = new Date()) {
  const events = await getEventsByYear(seasonYear);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const upcomingEvents = events.filter((event) => {
    if (!isOfficialEvent(event)) return false;
    const startDate = new Date(event.start_date);
    return startDate >= todayStart;
  });

  const targetWeeks = [...new Set(
    upcomingEvents
      .map((event) => getWeekNumberFromDate(event.start_date, seasonYear))
      .filter(Number.isFinite)
  )].sort((a, b) => a - b);

  let weeksProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalTeamsProcessed = 0;

  for (const weekNumber of targetWeeks) {
    const exists = await hasWeekSnapshot(seasonYear, weekNumber);
    if (exists) continue;

    const summary = await generateWeekMarketSnapshot(seasonYear, weekNumber);
    weeksProcessed += 1;
    totalCreated += summary.totalCreated;
    totalSkipped += summary.totalSkipped;
    totalTeamsProcessed += summary.totalTeamsProcessed;
  }

  return {
    weeksProcessed,
    totalTeamsProcessed,
    totalCreated,
    totalSkipped
  };
}