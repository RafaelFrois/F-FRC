import connectMongo from "../../config/mongo.js";
import Score from "../../src/DataBase/models/score.js";
import User from "../../src/DataBase/models/Users.js";
import { getTeamsByEvent } from "../../src/DataBase/services/tba.services.js";
import { methodNotAllowed, setCors, handleOptions } from "../../lib/server/http.js";
import { ensureWeekScoresFresh, getCurrentWeek, getWeekEvents } from "../../lib/server/scoringSync.js";

function parseTeamNumber(teamKey) {
  const digits = String(teamKey || "").replace(/[^0-9]/g, "");
  const number = Number(digits);
  return Number.isFinite(number) ? number : null;
}

function isCronAuthorized(req) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (!cronSecret) return false;

  const authHeader = String(req.headers?.authorization || "").trim();
  const expected = `Bearer ${cronSecret}`;
  return authHeader === expected;
}

function isPlaceholderTeamName(name, teamNumber) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return true;
  return normalized === `team ${Number(teamNumber)}`;
}

async function resolveWeekTeamNamesByNumber(weekEvents, teamNumbers) {
  const wanted = new Set((Array.isArray(teamNumbers) ? teamNumbers : []).map(Number).filter(Number.isFinite));
  const nameByNumber = new Map();

  if (wanted.size === 0) return nameByNumber;

  for (const event of Array.isArray(weekEvents) ? weekEvents : []) {
    if (wanted.size === 0) break;

    const eventKey = String(event?.key || "").trim().toLowerCase();
    if (!eventKey) continue;

    try {
      const teams = await getTeamsByEvent(eventKey);
      for (const team of teams) {
        const number = Number(team?.team_number);
        if (!wanted.has(number)) continue;

        const nickname = String(team?.nickname || team?.name || "").trim();
        if (!nickname) continue;

        nameByNumber.set(number, nickname);
        wanted.delete(number);
      }
    } catch {
      // ignora erro do evento e segue nos próximos
    }
  }

  return nameByNumber;
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
    const refreshRequested = ["1", "true", "yes"].includes(String(req.query.refresh || "").toLowerCase());
    const metric = String(req.query.metric || "points").trim().toLowerCase();

    console.log(`📍 Top-week request: season=${seasonYear}, week=${targetWeek}, metric=${metric}, refresh=${refreshRequested}`);

    if (refreshRequested && !isCronAuthorized(req)) {
      return res.status(401).json({ message: "Não autorizado para refresh forçado" });
    }

    const weekEvents = await getWeekEvents(seasonYear, targetWeek);
    console.log(`📅 Week ${targetWeek} tem ${weekEvents?.length || 0} eventos`);

    if (metric === "chosen") {
      const rows = await User.aggregate([
        { $unwind: "$regionals" },
        { $match: { "regionals.week": targetWeek } },
        { $unwind: "$regionals.alliance" },
        {
          $group: {
            _id: "$regionals.alliance.teamNumber",
            users: { $addToSet: "$_id" },
            selectionCount: { $sum: 1 },
            teamName: { $max: "$regionals.alliance.nickname" }
          }
        },
        {
          $project: {
            _id: 0,
            teamNumber: "$_id",
            teamName: {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ["$teamName", ""] } }, 0] },
                "$teamName",
                { $concat: ["TEAM ", { $toString: "$_id" }] }
              ]
            },
            peopleCount: { $size: "$users" },
            selectionCount: "$selectionCount"
          }
        },
        { $sort: { peopleCount: -1, selectionCount: -1, teamNumber: 1 } },
        { $limit: 3 }
      ]);

      const teams = rows.map((row) => ({
        key: `chosen:${row.teamNumber}`,
        teamNumber: Number(row.teamNumber),
        teamName: String(row.teamName || `TEAM ${row.teamNumber}`),
        peopleCount: Number(row.peopleCount || 0),
        selectionCount: Number(row.selectionCount || 0)
      }));

      const missingNameNumbers = teams
        .filter((entry) => isPlaceholderTeamName(entry.teamName, entry.teamNumber))
        .map((entry) => entry.teamNumber);

      if (missingNameNumbers.length > 0) {
        const resolvedNameByNumber = await resolveWeekTeamNamesByNumber(weekEvents, missingNameNumbers);
        for (const entry of teams) {
          if (!isPlaceholderTeamName(entry.teamName, entry.teamNumber)) continue;
          const resolved = resolvedNameByNumber.get(Number(entry.teamNumber));
          if (resolved) {
            entry.teamName = resolved;
          }
        }
      }

      return res.status(200).json({
        week: targetWeek,
        seasonYear,
        metric: "chosen",
        teams
      });
    }

    const refreshSummary = await ensureWeekScoresFresh(seasonYear, targetWeek, {
      force: refreshRequested,
      minIntervalMs: refreshRequested ? 0 : undefined
    });

    const eventKeys = weekEvents.map((event) => String(event.key || "").trim().toLowerCase()).filter(Boolean);
    console.log(`🔑 Event keys para buscar scores: ${eventKeys.join(", ") || "NENHUM"}`);
    
    if (eventKeys.length === 0) {
      console.log(`⚠️ Nenhum event key encontrado para week ${targetWeek}!`);
      return res.status(200).json({ week: targetWeek, seasonYear, teams: [] });
    }

    let scoreRows = await Score.find({ event_key: { $in: eventKeys } })
      .sort({ totalPoints: -1, bonusPoints: -1, winPoints: -1, createdAt: -1 })
      .limit(100)
      .lean();

    console.log(`📊 Encontrados ${scoreRows.length} scores para os events`);

    if (scoreRows.length === 0) {
      console.log(`🔄 Nenhum score encontrado! Tentando forçar recalculação...`);
      await ensureWeekScoresFresh(seasonYear, targetWeek, { force: true, minIntervalMs: 0 });

      scoreRows = await Score.find({ event_key: { $in: eventKeys } })
        .sort({ totalPoints: -1, bonusPoints: -1, winPoints: -1, createdAt: -1 })
        .limit(100)
        .lean();

      console.log(`📊 Após recalculação: ${scoreRows.length} scores encontrados`);
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

    console.log(`🏆 Top 3 scoring teams encontrados: ${top.length} (esperado 3)`);
    for (const t of top) {
      console.log(`   - #${t.teamNumber} ${t.teamName}: ${t.points} pts`);
    }

    return res.status(200).json({
      week: targetWeek,
      seasonYear,
      refreshed: refreshRequested,
      refreshSummary: refreshRequested ? refreshSummary : undefined,
      teams: top
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erro ao buscar top pontuação da week",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}