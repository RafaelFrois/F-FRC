import connectMongo from "../../config/mongo.js";
import { ensureWeekScoresFresh, getCurrentWeek, getWeekEvents } from "../../lib/server/scoringSync.js";
import { methodNotAllowed, setCors, handleOptions } from "../../lib/server/http.js";

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
  if (methodNotAllowed(req, res, ["POST"])) return;

  try {
    await connectMongo();

    const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const weekParam = Number(req.body?.week || req.query?.week);
    const targetWeek = Number.isInteger(weekParam) && weekParam >= 1 ? weekParam : getCurrentWeek(seasonYear);
    const forceRefresh = req.body?.force ?? req.query?.force;

    // Verifica autorização para refresh forçado
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
    console.error("❌ Erro ao fazer refresh de pontuações:", error.message);
    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar pontuações",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}
