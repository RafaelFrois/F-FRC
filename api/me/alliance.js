import connectMongo from "../../config/mongo.js";
import User from "../../src/DataBase/models/Users.js";
import Score from "../../src/DataBase/models/score.js";
import RegionalTeam from "../../src/DataBase/models/regionalTeam.js";
import { getEventsByYear, getTeamsByEvent } from "../../src/DataBase/services/tba.services.js";
import { calculateEventScores } from "../../src/DataBase/services/scoring.service.js";
import { ensureTeamPriceForWeek, getTeamPricesForWeek } from "../../src/DataBase/services/marketSnapshot.service.js";
import { getUserIdFromRequest } from "../../lib/server/auth.js";
import {
  AllianceRuleError,
  MAX_REGIONALS_PER_WEEK,
  countRegionalsInWeek,
  isSelectionClosed,
  parseAllianceSelection,
  priceFromSnapshot
} from "../../lib/server/alliance.js";
import { ensureUserSeasonState, ensureUserWeekState } from "../../lib/server/userSeason.js";
import { methodNotAllowed, parseJsonBody, sendError, setCors, handleOptions } from "../../lib/server/http.js";
import { getCurrentWeek } from "../../lib/server/scoringSync.js";

function normalizeEventKey(eventKey) {
  return String(eventKey || "").trim().toLowerCase();
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

function calculateAllianceCost(alliance) {
  return (Array.isArray(alliance) ? alliance : []).reduce((sum, entry) => {
    return sum + Math.max(0, Number(entry?.marketValue || 0));
  }, 0);
}

function applyCaptainMultiplier(points, isCaptain) {
  const basePoints = Number(points || 0);
  return isCaptain ? basePoints * 1.5 : basePoints;
}

function calculateSeasonTotalPoints(regionals, carryover = 0) {
  return (Array.isArray(regionals) ? regionals : []).reduce((sum, regionalEntry) => {
    return sum + Number(regionalEntry?.totalRegionalPoints || 0);
  }, Number(carryover || 0));
}

async function getEventMetadata(eventKey) {
  const currentYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();

  try {
    const events = await getEventsByYear(currentYear);
    const event = (Array.isArray(events) ? events : []).find(
      (entry) => String(entry?.key || "").trim().toLowerCase() === eventKey
    );
    return { event: event || null, currentYear, lookupFailed: false };
  } catch {
    return { event: null, currentYear, lookupFailed: true };
  }
}

// Sem o calendário oficial não dá para saber se o regional já fechou:
// a operação é recusada em vez de liberada.
function requireEvent({ event, lookupFailed }) {
  if (lookupFailed) {
    throw new AllianceRuleError("Não foi possível verificar o calendário do regional. Tente novamente em instantes.", 503);
  }
  if (!event) {
    throw new AllianceRuleError("Regional não encontrado na temporada atual.", 404);
  }
  return event;
}

// Equipes inscritas no evento: cache em RegionalTeam (preenchido por /api/regionals/teams) ou TBA.
async function getEventTeamNames(eventKey) {
  const cached = await RegionalTeam.find({ event_key: eventKey }).lean();
  if (cached.length > 0) {
    return new Map(cached.map((team) => [Number(team.team_number), String(team.nickname || "").trim()]));
  }

  try {
    const teams = await getTeamsByEvent(eventKey);
    return new Map((Array.isArray(teams) ? teams : []).map((team) => [
      Number(team?.team_number),
      String(team?.nickname || team?.name || "").trim()
    ]));
  } catch {
    throw new AllianceRuleError("Não foi possível carregar as equipes do regional. Tente novamente em instantes.", 503);
  }
}

// Preço efetivo de cada equipe na week do evento, sempre calculado no servidor.
async function resolveTeamPrices(teamNumbers, seasonYear, week) {
  const snapshots = await getTeamPricesForWeek(teamNumbers, seasonYear, week);
  const snapshotByTeam = new Map(snapshots.map((snapshot) => [Number(snapshot.teamNumber), snapshot]));

  const missing = teamNumbers.filter((teamNumber) => !snapshotByTeam.has(teamNumber));
  if (missing.length > 0) {
    const created = await Promise.allSettled(
      missing.map((teamNumber) => ensureTeamPriceForWeek(teamNumber, seasonYear, week))
    );
    created.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        snapshotByTeam.set(Number(result.value.teamNumber), result.value);
      }
    });
  }

  return new Map(teamNumbers.map((teamNumber) => [teamNumber, priceFromSnapshot(snapshotByTeam.get(teamNumber))]));
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

  const totalRegionalPoints = allianceWithPoints.reduce((sum, entry) => {
    return sum + applyCaptainMultiplier(entry.points, Boolean(entry.isCaptain));
  }, 0);
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
    const weekResetApplied = ensureUserWeekState(user, currentSeason, getCurrentWeek(currentSeason));

    if (req.method === "DELETE") {
      const normalizedEventKey = normalizeEventKey(req.query?.eventKey || req.query?.event_key);
      if (!normalizedEventKey) {
        return res.status(400).json({ message: "eventKey é obrigatório" });
      }

      const removedRegionalExists = (user.regionals || []).some(
        (entry) => normalizeEventKey(entry?.eventKey) === normalizedEventKey
      );
      if (!removedRegionalExists) {
        return res.status(404).json({ message: "Você não tem aliança neste regional." });
      }

      const deleteEvent = requireEvent(await getEventMetadata(normalizedEventKey));
      if (isSelectionClosed(deleteEvent)) {
        return res.status(403).json({
          message: "Este regional foi iniciado e não permite excluir a aliança."
        });
      }

      const removedRegional = (user.regionals || []).find(
        (entry) => normalizeEventKey(entry?.eventKey) === normalizedEventKey
      );
      const removedCost = calculateAllianceCost(removedRegional?.alliance);

      user.regionals = (user.regionals || []).filter(
        (entry) => normalizeEventKey(entry?.eventKey) !== normalizedEventKey
      );
      user.patrimonio = Math.max(0, Number(user.patrimonio || 0) + removedCost);
      user.totalPointsSeason = calculateSeasonTotalPoints(user.regionals, user.totalPointsCarryover);

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
    const isEditing = body?.isEditing === true;

    if (!normalizedEventKey) {
      return res.status(400).json({ message: "eventKey é obrigatório" });
    }

    const selection = parseAllianceSelection(body?.alliance);

    const metadata = await getEventMetadata(normalizedEventKey);
    const event = requireEvent(metadata);
    if (isSelectionClosed(event)) {
      return res.status(403).json({
        message: "Este regional foi iniciado e não permite mais seleções."
      });
    }

    const teamNames = await getEventTeamNames(normalizedEventKey);
    const outsideEvent = selection.filter((entry) => !teamNames.has(entry.teamNumber));
    if (outsideEvent.length > 0) {
      return res.status(400).json({
        message: `Equipe(s) fora deste regional: ${outsideEvent.map((entry) => entry.teamNumber).join(", ")}`
      });
    }

    const seasonYear = new Date(event.start_date).getFullYear() || metadata.currentYear;
    const eventWeek = getWeekNumberFromDate(event.start_date, seasonYear);

    if (countRegionalsInWeek(user.regionals, eventWeek, normalizedEventKey) >= MAX_REGIONALS_PER_WEEK) {
      return res.status(409).json({
        message: `Você já escalou ${MAX_REGIONALS_PER_WEEK} regionais nesta week.`
      });
    }

    const prices = await resolveTeamPrices(selection.map((entry) => entry.teamNumber), seasonYear, eventWeek);
    const pricedAlliance = selection.map((entry) => ({
      teamNumber: entry.teamNumber,
      nickname: teamNames.get(entry.teamNumber) || `Team ${entry.teamNumber}`,
      isCaptain: entry.isCaptain,
      marketValue: prices.get(entry.teamNumber)
    }));

    const existingIndex = (user.regionals || []).findIndex(
      (entry) => normalizeEventKey(entry?.eventKey) === normalizedEventKey
    );
    const existingRegional = existingIndex !== -1 ? user.regionals[existingIndex] : null;

    if (existingIndex !== -1 && !isEditing) {
      return res.status(409).json({ message: "Você já escalou neste regional." });
    }

    const currentPatrimony = Math.max(0, Number(user.patrimonio || 0));
    const existingAllianceCost = calculateAllianceCost(existingRegional?.alliance);
    const incomingAllianceCost = calculateAllianceCost(pricedAlliance);
    const availablePatrimony = existingRegional ? currentPatrimony + existingAllianceCost : currentPatrimony;

    if (incomingAllianceCost > availablePatrimony) {
      return res.status(400).json({
        message: `Patrimônio insuficiente para essa aliança. Disponível: ${availablePatrimony.toFixed(2)} ◈, custo: ${incomingAllianceCost.toFixed(2)} ◈`
      });
    }

    const { allianceWithPoints, totalRegionalPoints } = await resolveAlliancePoints(normalizedEventKey, pricedAlliance);

    const regionalPayload = {
      regionalName: String(event.name || normalizedEventKey),
      week: eventWeek,
      eventKey: normalizedEventKey,
      eventStartDate: event.start_date,
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

    user.patrimonio = Math.max(0, availablePatrimony - incomingAllianceCost);

    user.totalPointsSeason = calculateSeasonTotalPoints(user.regionals, user.totalPointsCarryover);
    if (seasonResetApplied || weekResetApplied) {
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
    return sendError(res, error, "Erro ao salvar/excluir aliança");
  }
}
