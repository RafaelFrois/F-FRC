import express from "express";
import Regional from "../models/regional.js";
import RegionalTeam from "../models/regionalTeam.js";
import { getEventsByYear, getTeamsByEvent } from "../services/tba.services.js";
import {
  ensureTeamPriceForWeek,
  generateSnapshotsForTeams,
  getTeamPricesForWeek,
  recalculateTeamPriceForWeek
} from "../services/marketSnapshot.service.js";

const router = express.Router();

function getWeekNumberFromDate(dateInput, seasonYear) {
  const eventDate = new Date(dateInput);
  const week1Start = new Date(seasonYear, 2, 1); // 01/03/yyyy

  if (eventDate < new Date(seasonYear, 2, 8)) {
    return 1;
  }

  const daysSinceWeek1 = Math.floor((eventDate - week1Start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(daysSinceWeek1 / 7) + 1);
}

// 🔹 Buscar regionais da week atual (removido - use /week/:week abaixo)

// 🔹 Buscar times de um regional
// REGRA 1 + 4: Validar se regional começou
router.get("/:eventKey/teams", async (req, res) => {
  try {
    const { eventKey } = req.params;
    const today = new Date();

    // Buscar regional na API do TBA para validar datas
    const year = today.getFullYear();
    let allEvents = [];
    try {
      const allEventsRes = await getEventsByYear(year);
      allEvents = allEventsRes;
    } catch (err) {
      console.warn("Erro ao buscar eventos do TBA:", err.message);
    }

    const event = allEvents.find(e => e.key === eventKey);

    // REGRA 1: Se começou, bloqueia
    if (event) {
      const startDate = new Date(event.start_date);
      if (today >= startDate) {
        return res.status(403).json({
          message: "Regional já iniciado. Não é possível montar aliança.",
          status: "locked"
        });
      }
    }

    // Buscar regional no banco
    const regional = await Regional.findOne({ event_key: eventKey });

    if (regional?.locked) {
      return res.status(403).json({
        message: "Regional já iniciado",
        status: "locked"
      });
    }

    // Buscar times
    let teams = await RegionalTeam.find({ event_key: eventKey });

    if (teams.length === 0) {
      // Buscar times da API se não tem em cache
      const apiTeams = await getTeamsByEvent(eventKey);

      const mapped = apiTeams.map(team => ({
        event_key: eventKey,
        team_number: team.team_number,
        nickname: team.nickname,
        locality: team.locality || "",
        last_event_points: 0
      }));

      await RegionalTeam.insertMany(mapped);
      teams = mapped;
    }

    // Aplicar preço congelado da week para cada time
    const seasonYear = event?.start_date ? new Date(event.start_date).getFullYear() : year;
    const weekNumber = event?.start_date ? getWeekNumberFromDate(event.start_date, seasonYear) : 1;

    const teamNumbers = teams.map((team) => Number(team.team_number)).filter(Number.isFinite);
    let snapshots = await getTeamPricesForWeek(teamNumbers, seasonYear, weekNumber);
    let snapshotByTeam = new Map(snapshots.map((snapshot) => [Number(snapshot.teamNumber), snapshot]));

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
        const summary = await generateSnapshotsForTeams(missingTeamNumbers, seasonYear, weekNumber);
        console.log(`📈 Snapshot síncrono (${eventKey})`, summary);
      } catch (error) {
        console.error(`❌ Erro ao gerar snapshot síncrono (${eventKey}):`, error.message);
      }

      try {
        const refreshed = await getTeamPricesForWeek(missingTeamNumbers, seasonYear, weekNumber);
        if (refreshed.length > 0) {
          refreshed.forEach((snapshot) => {
            snapshotByTeam.set(Number(snapshot.teamNumber), snapshot);
          });
        }
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

    res.json(pricedTeams);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar equipes" });
  }
});

// 🔹 Buscar regionais de uma semana específica
router.get("/week/:week", async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const today = new Date();
    const weekParam = parseInt(req.params.week);

    console.log(`📡 Buscando regionais da semana ${weekParam}...`);

    let events = await getEventsByYear(year);
    console.log(`✅ Recebeu ${events.length} eventos da TBA`);

    // Filtrar apenas regionais
    const regionals = events.filter(event =>
      (event.event_type === 0 || event.event_type === 1)
    );
    console.log(`🏆 ${regionals.length} regionais encontrados`);

    // Filtrar regionais não encerrados e da semana correta
    const filtered = regionals.filter(event => {
      const end = new Date(event.end_date);
      if (today > end) return false;
      // Calcular week do evento
      const week1Start = new Date(year, 2, 1); // 01/03/yyyy
      const eventDate = new Date(event.start_date);
      let eventWeek = 1;
      if (eventDate >= new Date(year, 2, 8)) {
        const daysSinceWeek1 = Math.floor((eventDate - week1Start) / (1000 * 60 * 60 * 24));
        eventWeek = Math.floor(daysSinceWeek1 / 7) + 1;
      }
      return eventWeek === weekParam;
    });

    console.log(`✨ ${filtered.length} regionais da week ${weekParam}`);
    res.json(filtered);
  } catch (error) {
    console.error(`❌ Erro ao buscar regionais da semana:`, error.message);
    res.status(500).json({ error: "Erro ao buscar regionais da semana", details: error.message });
  }
});

export default router;