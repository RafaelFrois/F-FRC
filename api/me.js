import connectMongo from "../config/mongo.js";
import User from "../src/DataBase/models/Users.js";
import { getUserIdFromRequest } from "../lib/server/auth.js";
import { methodNotAllowed, parseJsonBody, setCors, handleOptions } from "../lib/server/http.js";
import { calculateUserWeekPoints, ensureUserSeasonState, ensureUserWeekState } from "../lib/server/userSeason.js";
import { getCurrentWeek, refreshSingleUserScores } from "../lib/server/scoringSync.js";
import { getEventsByYear } from "../src/DataBase/services/tba.services.js";

function normalizeEventKey(eventKey) {
  return String(eventKey || "").trim().toLowerCase();
}

function parseSeasonYearFromEventKey(eventKey) {
  const match = String(eventKey || "").trim().match(/^(\d{4})/);
  const parsedYear = Number(match?.[1]);
  return Number.isFinite(parsedYear) ? parsedYear : null;
}

async function hydrateMissingRegionalStartDates(user) {
  const regionals = Array.isArray(user?.regionals) ? user.regionals : [];
  const pending = regionals.filter((regional) => {
    const hasStartDate = Boolean(regional?.eventStartDate || regional?.event_start_date);
    const eventKey = normalizeEventKey(regional?.eventKey);
    return !hasStartDate && Boolean(eventKey);
  });

  if (pending.length === 0) return false;

  const years = [...new Set(
    pending
      .map((regional) => parseSeasonYearFromEventKey(regional?.eventKey))
      .filter(Number.isFinite)
  )];

  if (years.length === 0) return false;

  const startDateByEventKey = new Map();

  for (const year of years) {
    try {
      const events = await getEventsByYear(year);
      for (const event of Array.isArray(events) ? events : []) {
        const key = normalizeEventKey(event?.key || event?.event_key);
        if (!key || !event?.start_date) continue;
        startDateByEventKey.set(key, event.start_date);
      }
    } catch {
      // Se falhar em um ano, segue com os demais.
    }
  }

  let changed = false;
  for (const regional of pending) {
    const key = normalizeEventKey(regional?.eventKey);
    const resolvedStartDate = startDateByEventKey.get(key);
    if (!resolvedStartDate) continue;

    regional.eventStartDate = resolvedStartDate;
    changed = true;
  }

  return changed;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET", "PUT"])) return;

  try {
    await connectMongo();
    const userId = getUserIdFromRequest(req);

    if (req.method === "GET") {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
      const currentWeek = getCurrentWeek(currentSeason);
      const seasonResetApplied = ensureUserSeasonState(user, currentSeason);
      const pointsUpdated = await refreshSingleUserScores(user);
      const weekResetApplied = ensureUserWeekState(user, currentSeason, currentWeek);
      const eventDatesHydrated = await hydrateMissingRegionalStartDates(user);

      if (seasonResetApplied || pointsUpdated || weekResetApplied || eventDatesHydrated) {
        if (pointsUpdated || eventDatesHydrated) {
          user.markModified("regionals");
        }
        await user.save();
      }

      const userWithoutPassword = user.toObject();
      delete userWithoutPassword.password;
      userWithoutPassword.currentWeek = currentWeek;
      userWithoutPassword.currentWeekPoints = Number(calculateUserWeekPoints(user, currentWeek) || 0);
      return res.json({ user: userWithoutPassword });
    }

    const { username, frcTeamNumber, rookieYear, profilePhoto } = await parseJsonBody(req);
    const update = {};
    if (username !== undefined) update.username = username;
    if (frcTeamNumber !== undefined) update.frcTeamNumber = frcTeamNumber;
    if (rookieYear !== undefined) update.rookieYear = rookieYear;
    if (profilePhoto !== undefined) update.profilePhoto = profilePhoto;

    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json({ message: "Perfil atualizado com sucesso", user });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: "JSON inválido no corpo da requisição" });
    }
    return res.status(500).json({ error: error.message });
  }
}
