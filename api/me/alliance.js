import connectMongo from "../../config/mongo.js";
import User from "../../src/DataBase/models/Users.js";
import Score from "../../src/DataBase/models/score.js";
import { getEventsByYear } from "../../src/DataBase/services/tba.services.js";
import { calculateEventScores } from "../../src/DataBase/services/scoring.service.js";
import { getUserIdFromRequest } from "../_lib/auth.js";
import { ensureUserSeasonState } from "../_lib/userSeason.js";
import { methodNotAllowed, parseJsonBody, setCors, handleOptions } from "../_lib/http.js";

function normalizeEventKey(eventKey) {
  return String(eventKey || "").trim().toLowerCase();
}

function normalizeTeamNumber(teamNumber) {
  const value = Number(teamNumber);
  return Number.isFinite(value) ? value : null;
}

function getWeekNumberFromDate(dateInput, seasonYear) {
  const eventDate = new Date(dateInput);
  const week1Start = new Date(seasonYear, 2, 1);

  if (eventDate < new Date(seasonYear, 2, 8)) {
    return 1;
  }

  const daysSinceWeek1 = Math.floor((eventDate - week1Start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(daysSinceWeek1 / 7) + 1);
}

function sanitizeAlliance(rawAlliance) {
  const alliance = Array.isArray(rawAlliance) ? rawAlliance : [];

  return alliance
    .map((entry) => {
      const teamNumber = normalizeTeamNumber(entry?.teamNumber);
      if (!teamNumber) return null;

      return {
        teamNumber,
        nickname: String(entry?.nickname || "").trim() || `Team ${teamNumber}`,
        isCaptain: Boolean(entry?.isCaptain),
        marketValue: Number(entry?.marketValue || 0)
      };
    })
    .filter(Boolean);
}

function calculateSeasonTotalPoints(regionals) {
  return (Array.isArray(regionals) ? regionals : []).reduce((sum, regionalEntry) => {
    return sum + Number(regionalEntry?.totalRegionalPoints || 0);
  }, 0);
}

async function getEventMetadata(eventKey) {
  const currentYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();

  try {
    const events = await getEventsByYear(currentYear);
    const event = events.find((entry) => String(entry?.key || "").trim().toLowerCase() === eventKey);
    return { event, currentYear };
  } catch {
    return { event: null, currentYear };
  }
}

async function resolveAlliancePoints(eventKey, alliance) {
  const teamKeys = alliance.map((entry) => `frc${entry.teamNumber}`);
  let scoreRows = await Score.find({
    event_key: eventKey,
    team_key: { $in: teamKeys }
  }).lean();

  if (scoreRows.length === 0) {
    try {
      await calculateEventScores(eventKey);
      scoreRows = await Score.find({
        event_key: eventKey,
        team_key: { $in: teamKeys }
      }).lean();
    } catch {
      scoreRows = [];
    }
  }

  const pointsByTeamKey = new Map(
    scoreRows.map((row) => [String(row.team_key || "").trim().toLowerCase(), Number(row.totalPoints || 0)])
  );

  const allianceWithPoints = alliance.map((entry) => {
    const teamKey = `frc${entry.teamNumber}`;
    return {
      ...entry,
      points: Number(pointsByTeamKey.get(teamKey) || 0)
    };
  });

  const totalRegionalPoints = allianceWithPoints.reduce((sum, entry) => sum + Number(entry.points || 0), 0);
  return { allianceWithPoints, totalRegionalPoints };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["POST", "DELETE"])) return;

  try {
    await connectMongo();
    const userId = getUserIdFromRequest(req);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const seasonResetApplied = ensureUserSeasonState(user, currentSeason);

    if (req.method === "DELETE") {
      const normalizedEventKey = normalizeEventKey(req.query?.eventKey || req.query?.event_key);
      if (!normalizedEventKey) {
        return res.status(400).json({ message: "eventKey é obrigatório" });
      }

      user.regionals = (user.regionals || []).filter(
        (entry) => normalizeEventKey(entry?.eventKey) !== normalizedEventKey
      );
      user.totalPointsSeason = calculateSeasonTotalPoints(user.regionals);

      await user.save();
      const userWithoutPassword = user.toObject();
      delete userWithoutPassword.password;

      return res.status(200).json({
        message: "Aliança excluída com sucesso",
        user: userWithoutPassword
      });
    }

    const body = await parseJsonBody(req);
    const normalizedEventKey = normalizeEventKey(body?.eventKey);
    const sanitizedAlliance = sanitizeAlliance(body?.alliance);
    const isEditing = Boolean(body?.isEditing);

    if (!normalizedEventKey) {
      return res.status(400).json({ message: "eventKey é obrigatório" });
    }

    if (sanitizedAlliance.length !== 3) {
      return res.status(400).json({ message: "A aliança deve conter exatamente 3 times" });
    }

    if (!sanitizedAlliance.some((entry) => entry.isCaptain)) {
      return res.status(400).json({ message: "Selecione um capitão para a aliança" });
    }

    const uniqueTeamNumbers = new Set(sanitizedAlliance.map((entry) => entry.teamNumber));
    if (uniqueTeamNumbers.size !== sanitizedAlliance.length) {
      return res.status(400).json({ message: "A aliança não pode conter times repetidos" });
    }

    const { event, currentYear } = await getEventMetadata(normalizedEventKey);
    if (event?.start_date && new Date() >= new Date(event.start_date)) {
      return res.status(403).json({
        message: "Este regional foi iniciado e não permite mais seleções."
      });
    }

    const existingIndex = (user.regionals || []).findIndex(
      (entry) => normalizeEventKey(entry?.eventKey) === normalizedEventKey
    );

    if (existingIndex !== -1 && !isEditing) {
      return res.status(409).json({ message: "Você já escalou neste regional." });
    }

    const seasonYear = event?.start_date ? new Date(event.start_date).getFullYear() : currentYear;
    const eventWeek = event?.start_date ? getWeekNumberFromDate(event.start_date, seasonYear) : 1;

    const { allianceWithPoints, totalRegionalPoints } = await resolveAlliancePoints(normalizedEventKey, sanitizedAlliance);

    const regionalPayload = {
      regionalName: String(event?.name || normalizedEventKey),
      week: eventWeek,
      eventKey: normalizedEventKey,
      alliance: allianceWithPoints,
      totalRegionalPoints,
      createdAt: new Date()
    };

    if (!Array.isArray(user.regionals)) {
      user.regionals = [];
    }

    if (existingIndex !== -1) {
      user.regionals[existingIndex] = {
        ...user.regionals[existingIndex].toObject?.(),
        ...regionalPayload
      };
    } else {
      user.regionals.push(regionalPayload);
    }

    user.totalPointsSeason = calculateSeasonTotalPoints(user.regionals);
    if (seasonResetApplied) {
      user.markModified("regionals");
    }

    await user.save();

    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    return res.status(200).json({
      message: "Aliança salva com sucesso",
      user: userWithoutPassword
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: "JSON inválido no corpo da requisição" });
    }

    return res.status(500).json({
      message: "Erro ao salvar/excluir aliança",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}