import connectMongo from "../../config/mongo.js";
import { ensureWeekScoresFresh, getCurrentWeek, getWeekEvents } from "../../lib/server/scoringSync.js";
import { getEventsByYear } from "../../src/DataBase/services/tba.services.js";
import Score from "../../src/DataBase/models/score.js";
import { methodNotAllowed, setCors, handleOptions } from "../../lib/server/http.js";

function isCronAuthorized(req) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (!cronSecret) return false;

  const authHeader = String(req.headers?.authorization || "").trim();
  const expected = `Bearer ${cronSecret}`;
  return authHeader === expected;
}

async function handleDebug(req, res) {
  const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
  const currentWeek = getCurrentWeek(seasonYear);

  console.log(`🔍 DEBUG: Verificando status do sistema para ${seasonYear}-W${currentWeek}`);

  const allEvents = await getEventsByYear(seasonYear);
  console.log(`📡 Total de eventos no TBA: ${allEvents?.length || 0}`);

  const weekEvents = await getWeekEvents(seasonYear, currentWeek);
  console.log(`📅 Eventos na week ${currentWeek}: ${weekEvents?.length || 0}`);

  const allScores = await Score.countDocuments();
  const eventKeys = weekEvents.map((e) => String(e.key || "").trim().toLowerCase()).filter(Boolean);
  const weekScores = await Score.find({ event_key: { $in: eventKeys } }).lean();

  console.log(`📊 Total de scores no banco: ${allScores}`);
  console.log(`📊 Scores para week ${currentWeek}: ${weekScores.length}`);

  const scoresByEvent = {};
  for (const score of weekScores) {
    const eventKey = String(score.event_key || "").toLowerCase();
    scoresByEvent[eventKey] = (scoresByEvent[eventKey] || 0) + 1;
  }

  const topScores = weekScores
    .sort((a, b) => Number(b.totalPoints || 0) - Number(a.totalPoints || 0))
    .slice(0, 5);

  return res.status(200).json({
    success: true,
    seasonYear,
    currentWeek,
    tba: {
      totalEventsYear: allEvents?.length || 0,
      eventsThisWeek: weekEvents?.length || 0,
      eventKeys: eventKeys,
      events: (weekEvents || []).map((e) => ({
        key: e.key,
        name: e.name,
        startDate: e.start_date,
        endDate: e.end_date,
        location: e.location,
        eventType: e.event_type
      }))
    },
    database: {
      totalScoresAllEvents: allScores,
      scoresThisWeek: weekScores.length,
      scoresPerEvent: scoresByEvent,
      topScores: topScores.map((s) => ({
        teamKey: s.team_key,
        eventKey: s.event_key,
        totalPoints: s.totalPoints,
        autoPoints: s.autoPoints,
        teleopPoints: s.teleopPoints,
        endgamePoints: s.endgamePoints,
        bonusPoints: s.bonusPoints,
        winPoints: s.winPoints,
        createdAt: s.createdAt
      }))
    },
    timestamp: new Date().toISOString()
  });
}

async function handleRefresh(req, res) {
  const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
  const weekParam = Number(req.body?.week || req.query?.week);
  const targetWeek = Number.isInteger(weekParam) && weekParam >= 1 ? weekParam : getCurrentWeek(seasonYear);
  const forceRefresh = req.body?.force ?? req.query?.force;

  if (forceRefresh && !isCronAuthorized(req)) {
    return res.status(401).json({
      message: "Não autorizado para refresh forçado",
      details: "CRON_SECRET não foi fornecido ou é inválido"
    });
  }

  console.log(`🔄 Iniciando refresh de pontuações para week ${targetWeek}...`);

  const weekEvents = await getWeekEvents(seasonYear, targetWeek);

  if (!weekEvents || weekEvents.length === 0) {
    return res.status(200).json({
      success: true,
      week: targetWeek,
      seasonYear,
      message: `Nenhum evento encontrado para week ${targetWeek}`,
      eventsCount: 0,
      result: null
    });
  }

  try {
    const result = await ensureWeekScoresFresh(seasonYear, targetWeek, {
      force: forceRefresh === true || forceRefresh === "true",
      minIntervalMs: forceRefresh === true || forceRefresh === "true" ? 0 : undefined
    });

    if (result.skipped) {
      return res.status(200).json({
        success: true,
        week: targetWeek,
        seasonYear,
        message: `Refresh foi ignorado por throttle. Próxima tentativa disponível em ${Number(process.env.WEEK_SCORE_REFRESH_MIN_INTERVAL_MS || 120000) / 1000}s`,
        skipped: true,
        reason: result.reason || "THROTTLED",
        eventsCount: weekEvents.length
      });
    }

    console.log(`✅ Refresh de pontuações concluído para week ${targetWeek}:`, {
      eventKeys: result.eventKeys?.length || 0,
      calculatedEvents: result.scoreSummary?.calculatedEvents || 0,
      failedEvents: result.scoreSummary?.failedEvents || 0,
      usersUpdated: result.userSummary?.updatedUsers || 0
    });

    return res.status(200).json({
      success: true,
      week: targetWeek,
      seasonYear,
      message: "Pontuações atualizadas com sucesso",
      eventsCount: result.eventKeys?.length || 0,
      result: {
        eventKeys: result.eventKeys || [],
        scoreSummary: result.scoreSummary || {},
        userSummary: result.userSummary || {}
      }
    });
  } catch (error) {
    console.error(`❌ ERRO ao fazer refresh: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar pontuações",
      error: error.message,
      details: process.env.NODE_ENV === "production" ? undefined : error.stack
    });
  }
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  try {
    await connectMongo();

    const action = String(req.query?.action || "").toLowerCase();

    // Debug endpoint - GET only
    if (action === "debug") {
      if (req.method !== "GET") {
        return res.status(405).json({ message: "Método não permitido" });
      }
      return await handleDebug(req, res);
    }

    // Refresh endpoint - GET (para cron) ou POST (manual)
    if (req.method === "GET") {
      // GET sem action = cron refresh
      console.log("🔄 GET request (cron) detectado - forçando refresh");
      const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
      const weekParam = Number(req.query?.week);
      const targetWeek = Number.isInteger(weekParam) && weekParam >= 1 ? weekParam : getCurrentWeek(seasonYear);
      
      const weekEvents = await getWeekEvents(seasonYear, targetWeek);
      if (!weekEvents || weekEvents.length === 0) {
        return res.status(200).json({
          success: true,
          week: targetWeek,
          seasonYear,
          message: `Nenhum evento encontrado para week ${targetWeek}`,
          eventsCount: 0
        });
      }

      const result = await ensureWeekScoresFresh(seasonYear, targetWeek, {
        force: true,
        minIntervalMs: 0
      });

      return res.status(200).json({
        success: true,
        method: "GET (cron)",
        week: targetWeek,
        seasonYear,
        result
      });
    }

    if (req.method === "POST") {
      return await handleRefresh(req, res);
    }

    return res.status(405).json({ message: "Método não permitido" });
  } catch (error) {
    console.error("❌ Erro ao processar requisição de scores:", error.message);
    return res.status(500).json({
      success: false,
      message: "Erro ao processar requisição",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}
