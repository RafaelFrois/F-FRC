import connectMongo from "../../../config/mongo.js";
import Regional from "../../../src/DataBase/models/regional.js";
import RegionalTeam from "../../../src/DataBase/models/regionalTeam.js";
import { getEventsByYear, getTeamsByEvent } from "../../../src/DataBase/services/tba.services.js";
import {
  ensureTeamPriceForWeek,
  generateSnapshotsForTeams,
  getTeamPricesForWeek,
  recalculateTeamPriceForWeek
} from "../../../src/DataBase/services/marketSnapshot.service.js";
import { methodNotAllowed, setCors, handleOptions } from "../../_lib/http.js";

function getWeekNumberFromDate(dateInput, seasonYear) {
  const eventDate = new Date(dateInput);
  const week1Start = new Date(seasonYear, 2, 1);

  if (eventDate < new Date(seasonYear, 2, 8)) {
    return 1;
  }

  const daysSinceWeek1 = Math.floor((eventDate - week1Start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(daysSinceWeek1 / 7) + 1);
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET"])) return;

  try {
    await connectMongo();
    const eventKey = String(req.query.eventKey || "").trim();
    if (!eventKey) {
      return res.status(400).json({ message: "eventKey é obrigatório" });
    }
    const today = new Date();

    const year = today.getFullYear();
    let allEvents = [];
    try {
      allEvents = await getEventsByYear(year);
    } catch (err) {
      console.warn("Erro ao buscar eventos do TBA:", err.message);
    }

    const event = allEvents.find((entry) => entry.key === eventKey);

    if (event) {
      const startDate = new Date(event.start_date);
      if (today >= startDate) {
        return res.status(403).json({
          message: "Regional já iniciado. Não é possível montar aliança.",
          status: "locked"
        });
      }
    }

    const regional = await Regional.findOne({ event_key: eventKey });
    if (regional?.locked) {
      return res.status(403).json({
        message: "Regional já iniciado",
        status: "locked"
      });
    }

    let teams = await RegionalTeam.find({ event_key: eventKey });

    if (teams.length === 0) {
      const apiTeams = await getTeamsByEvent(eventKey);

      const mapped = apiTeams.map((team) => ({
        event_key: eventKey,
        team_number: team.team_number,
        nickname: team.nickname,
        locality: team.locality || "",
        last_event_points: 0
      }));

      await RegionalTeam.insertMany(mapped);
      teams = mapped;
    }

    const seasonYear = event?.start_date ? new Date(event.start_date).getFullYear() : year;
    const weekNumber = event?.start_date ? getWeekNumberFromDate(event.start_date, seasonYear) : 1;

    const teamNumbers = teams.map((team) => Number(team.team_number)).filter(Number.isFinite);
    const snapshots = await getTeamPricesForWeek(teamNumbers, seasonYear, weekNumber);
    const snapshotByTeam = new Map(snapshots.map((snapshot) => [Number(snapshot.teamNumber), snapshot]));

    const staleLowSnapshots = snapshots
      .filter((snapshot) => Number(snapshot.price) === 5)
      .map((snapshot) => Number(snapshot.teamNumber));

    if (staleLowSnapshots.length > 0) {
      const refreshedLow = await Promise.allSettled(
        staleLowSnapshots.map((teamNumber) => recalculateTeamPriceForWeek(teamNumber, seasonYear, weekNumber))
      );

      refreshedLow.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          snapshotByTeam.set(Number(result.value.teamNumber), result.value);
        } else {
          const teamNumber = staleLowSnapshots[index];
          console.warn(`⚠️ Não foi possível recalcular snapshot baixo para time ${teamNumber} (${eventKey})`);
        }
      });
    }

    const missingTeamNumbers = teamNumbers.filter((teamNumber) => !snapshotByTeam.has(teamNumber));
    if (missingTeamNumbers.length > 0) {
      try {
        await generateSnapshotsForTeams(missingTeamNumbers, seasonYear, weekNumber);
      } catch (error) {
        console.error(`❌ Erro ao gerar snapshot síncrono (${eventKey}):`, error.message);
      }

      try {
        const refreshed = await getTeamPricesForWeek(missingTeamNumbers, seasonYear, weekNumber);
        refreshed.forEach((snapshot) => {
          snapshotByTeam.set(Number(snapshot.teamNumber), snapshot);
        });
      } catch (error) {
        console.error(`❌ Erro ao recarregar snapshots (${eventKey}):`, error.message);
      }

      const unresolvedTeamNumbers = missingTeamNumbers.filter((teamNumber) => !snapshotByTeam.has(teamNumber));
      if (unresolvedTeamNumbers.length > 0) {
        const forced = await Promise.allSettled(
          unresolvedTeamNumbers.map((teamNumber) => ensureTeamPriceForWeek(teamNumber, seasonYear, weekNumber))
        );

        forced.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value) {
            snapshotByTeam.set(Number(result.value.teamNumber), result.value);
          } else {
            const teamNumber = unresolvedTeamNumbers[index];
            console.warn(`⚠️ Snapshot não resolvido para time ${teamNumber} (${eventKey})`);
          }
        });
      }
    }

    const pricedTeams = teams.map((team) => {
      const teamNumber = Number(team.team_number);
      const snapshot = snapshotByTeam.get(teamNumber);
      return {
        ...(team.toObject ? team.toObject() : team),
        price: snapshot?.price ?? 5
      };
    });

    return res.json(pricedTeams);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar equipes" });
  }
}
