import connectMongo from "../../config/mongo.js";
import Score from "../../src/DataBase/models/score.js";
import { getTeamsByEvent } from "../../src/DataBase/services/tba.services.js";
import { methodNotAllowed, setCors, handleOptions } from "../../lib/server/http.js";
import { ensureWeekScoresFresh, getCurrentWeek, getWeekEvents } from "../../lib/server/scoringSync.js";

function parseTeamNumber(teamKey) {
  const digits = String(teamKey || "").replace(/[^0-9]/g, "");
  const number = Number(digits);
  return Number.isFinite(number) ? number : null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET"])) return;

  try {
    await connectMongo();

    const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const weekParam = Number(req.query.week);
    const targetWeek = Number.isInteger(weekParam) && weekParam >= 1 ? weekParam : getCurrentWeek(seasonYear);

    await ensureWeekScoresFresh(seasonYear, targetWeek);

    const weekEvents = await getWeekEvents(seasonYear, targetWeek);

    const eventKeys = weekEvents.map((event) => String(event.key || "").trim().toLowerCase()).filter(Boolean);
    if (eventKeys.length === 0) {
      return res.status(200).json({ week: targetWeek, seasonYear, teams: [] });
    }

    let scoreRows = await Score.find({ event_key: { $in: eventKeys } })
      .sort({ totalPoints: -1, bonusPoints: -1, winPoints: -1, createdAt: -1 })
      .limit(100)
      .lean();

    if (scoreRows.length === 0) {
      await ensureWeekScoresFresh(seasonYear, targetWeek, { force: true, minIntervalMs: 0 });

      scoreRows = await Score.find({ event_key: { $in: eventKeys } })
        .sort({ totalPoints: -1, bonusPoints: -1, winPoints: -1, createdAt: -1 })
        .limit(100)
        .lean();
    }

    const eventByKey = new Map(weekEvents.map((event) => [String(event.key || "").toLowerCase(), event]));
    const teamNameByEventAndNumber = new Map();

    const top = [];

    for (const row of scoreRows) {
      if (top.length >= 3) break;

      const eventKey = String(row.event_key || "").toLowerCase();
      const teamNumber = parseTeamNumber(row.team_key);
      if (!teamNumber) continue;

      const dedupeKey = `${eventKey}:${teamNumber}`;
      if (top.some((entry) => entry.key === dedupeKey)) continue;

      const cacheKey = `${eventKey}:${teamNumber}`;
      let teamName = teamNameByEventAndNumber.get(cacheKey);

      if (!teamName) {
        try {
          const teams = await getTeamsByEvent(eventKey);
          const byNumber = new Map(
            teams.map((team) => [Number(team.team_number), String(team.nickname || `TEAM ${team.team_number}`)])
          );

          for (const [number, nickname] of byNumber.entries()) {
            teamNameByEventAndNumber.set(`${eventKey}:${number}`, nickname);
          }

          teamName = byNumber.get(teamNumber);
        } catch {
          teamName = null;
        }
      }

      const event = eventByKey.get(eventKey);

      top.push({
        key: dedupeKey,
        teamNumber,
        teamName: teamName || `TEAM ${teamNumber}`,
        points: Number(row.totalPoints || 0),
        eventKey,
        eventName: String(event?.name || eventKey)
      });
    }

    return res.status(200).json({
      week: targetWeek,
      seasonYear,
      teams: top
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erro ao buscar top pontuação da week",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}