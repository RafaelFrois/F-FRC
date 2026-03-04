import connectMongo from "../../config/mongo.js";
import { ensureWeekScoresFresh, getCurrentWeek, getWeekEvents } from "../../lib/server/scoringSync.js";
import { getEventsByYear } from "../../src/DataBase/services/tba.services.js";
import Score from "../../src/DataBase/models/score.js";
import { setCors, handleOptions } from "../../lib/server/http.js";

function isCronAuthorized(req) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (!cronSecret) return false;

  const authHeader = String(req.headers?.authorization || "").trim();
  const expected = `Bearer ${cronSecret}`;
  return authHeader === expected;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  try {
    await connectMongo();

    const action = String(req.query?.action || "").toLowerCase();
    const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const weekParam = Number(req.query?.week || req.body?.week);
    const targetWeek = Number.isInteger(weekParam) && weekParam >= 1 ? weekParam : getCurrentWeek(seasonYear);

    // Debug endpoint
    if (action === "debug") {
      if (req.method !== "GET") return res.status(405).json({ message: "Método não permitido" });

      const allEvents = await getEventsByYear(seasonYear);
      const weekEvents = await getWeekEvents(seasonYear, targetWeek);
      const allScores = await Score.countDocuments();
      const eventKeys = weekEvents.map((e) => String(e.key || "").trim().toLowerCase()).filter(Boolean);
      const weekScores = await Score.find({ event_key: { $in: eventKeys } }).lean();

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
        currentWeek: targetWeek,
        tba: {
          totalEventsYear: allEvents?.length || 0,
          eventsThisWeek: weekEvents?.length || 0,
          eventKeys: eventKeys,
          events: (weekEvents || []).map((e) => ({
            key: e.key,
            name: e.name,
            startDate: e.start_date,
            endDate: e.end_date,
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

    // Refresh endpoint (GET for cron, POST for manual)
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

    try {
      // Timeout protection: 25 seconds max
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Refresh timeout")), 25000)
      );

      const result = await Promise.race([
        ensureWeekScoresFresh(seasonYear, targetWeek, {
          force: true,
          minIntervalMs: 0
        }),
        timeoutPromise
      ]).catch(err => {
        console.warn(`⚠️ ${err.message}`);
        return {
          skipped: false,
          timedOut: true,
          eventKeys: weekEvents.map(e => e.key),
          scoreSummary: {
            totalEvents: weekEvents.length,
            calculatedEvents: 0,
            failedEvents: 0,
            failedEventsDetails: []
          },
          userSummary: {}
        };
      });

      return res.status(200).json({
        success: true,
        week: targetWeek,
        seasonYear,
        timedOut: result.timedOut || false,
        scoreSummary: result.scoreSummary || {},
        failedEventsDetails: result.scoreSummary?.failedEventsDetails || []
      });
    } catch (error) {
      console.error(`❌ ERRO no refresh: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: "Erro ao executar refresh",
        error: error.message
      });
    }
  } catch (error) {
    console.error("❌ Erro ao processar requisição:", error.message);
    return res.status(500).json({
      success: false,
      message: "Erro ao processar requisição",
      error: error.message
    });
  }
}
