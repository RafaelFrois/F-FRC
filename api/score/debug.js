import connectMongo from "../../config/mongo.js";
import { getCurrentWeek, getWeekEvents } from "../../lib/server/scoringSync.js";
import { getEventsByYear } from "../../src/DataBase/services/tba.services.js";
import Score from "../../src/DataBase/models/score.js";
import { methodNotAllowed, setCors, handleOptions } from "../../lib/server/http.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET"])) return;

  try {
    await connectMongo();

    const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const currentWeek = getCurrentWeek(seasonYear);

    console.log(`🔍 DEBUG: Verificando status do sistema para ${seasonYear}-W${currentWeek}`);

    // Buscar todos os eventos do ano
    const allEvents = await getEventsByYear(seasonYear);
    console.log(`📡 Total de eventos no TBA: ${allEvents?.length || 0}`);

    // Buscar eventos da week atual
    const weekEvents = await getWeekEvents(seasonYear, currentWeek);
    console.log(`📅 Eventos na week ${currentWeek}: ${weekEvents?.length || 0}`);

    // Buscar scores no banco
    const allScores = await Score.countDocuments();
    const eventKeys = weekEvents.map((e) => String(e.key || "").trim().toLowerCase()).filter(Boolean);
    const weekScores = await Score.find({ event_key: { $in: eventKeys } }).lean();

    console.log(`📊 Total de scores no banco: ${allScores}`);
    console.log(`📊 Scores para week ${currentWeek}: ${weekScores.length}`);

    const eventKeysMap = new Map();
    for (const event of weekEvents || []) {
      const key = String(event.key || "").toLowerCase();
      if (key) eventKeysMap.set(key, event);
    }

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
  } catch (error) {
    console.error("❌ Erro no debug:", error.message);
    return res.status(500).json({
      success: false,
      message: "Erro ao coletar informações de debug",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}
