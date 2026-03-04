import cron from "node-cron";
import Regional from "../models/regional.js";
import {
  generateUpcomingWeeksMarketSnapshots,
  generateWeekMarketSnapshot,
  getWeekToGenerateForToday,
  hasWeekSnapshot
} from "../services/marketSnapshot.service.js";
import { ensureWeekScoresFresh, getCurrentWeek, getWeekEvents } from "../../lib/server/scoringSync.js";

async function updateRegionalLocks() {
  console.log("🕛 Atualizando status de regionais...");

  const today = new Date();

  const regionals = await Regional.find();

  for (let regional of regionals) {
    if (today >= regional.start_date) {
      regional.locked = true;
      await regional.save();
    }
  }
}

async function runWeeklyMarketSnapshot() {
  const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();

  try {
    const weekNumber = await getWeekToGenerateForToday(seasonYear);

    if (!weekNumber) {
      console.log("📉 Nenhuma week iniciando hoje. Snapshot não gerado.");
      return;
    }

    const alreadyGenerated = await hasWeekSnapshot(seasonYear, weekNumber);
    if (alreadyGenerated) {
      console.log(`⏭️ Snapshot já existe para season ${seasonYear}, week ${weekNumber}.`);
      return;
    }

    const summary = await generateWeekMarketSnapshot(seasonYear, weekNumber);
    console.log("✅ Snapshot semanal gerado:", {
      seasonYear,
      weekNumber,
      ...summary
    });
  } catch (error) {
    console.error("❌ Erro ao executar snapshot semanal:", error.message);
  }
}

async function runUpcomingWeeksSnapshotPrewarm() {
  const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();

  try {
    const summary = await generateUpcomingWeeksMarketSnapshots(seasonYear);
    console.log("🚀 Pré-cálculo de snapshots futuros:", {
      seasonYear,
      ...summary
    });
  } catch (error) {
    console.error("❌ Erro no pré-cálculo de snapshots futuros:", error.message);
  }
}

async function refreshWeekScores() {
  const seasonYear = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
  const currentWeek = getCurrentWeek(seasonYear);

  try {
    console.log(`📊 Atualizando pontuações da week ${currentWeek}...`);
    const weekEvents = await getWeekEvents(seasonYear, currentWeek);
    
    if (!weekEvents || weekEvents.length === 0) {
      console.log(`⏭️ Nenhum evento encontrado para week ${currentWeek}.`);
      return;
    }

    const result = await ensureWeekScoresFresh(seasonYear, currentWeek, {
      force: false,
      minIntervalMs: 0
    });

    if (result.skipped) {
      console.log(`⏭️ Refresh de pontuações foi ignorado (throttled). Próxima tentativa em ${Number(process.env.WEEK_SCORE_REFRESH_MIN_INTERVAL_MS || 120000) / 1000}s`);
    } else {
      console.log(`✅ Pontuações atualizadas para week ${currentWeek}:`, {
        events: result.eventKeys?.length || 0,
        calculatedEvents: result.scoreSummary?.calculatedEvents || 0,
        failedEvents: result.scoreSummary?.failedEvents || 0,
        usersUpdated: result.userSummary?.updatedUsers || 0
      });
    }
  } catch (error) {
    console.error(`❌ Erro ao atualizar pontuações da week ${currentWeek}:`, error.message);
  }
}

// Executa diariamente às 00:05
cron.schedule("5 0 * * *", async () => {
  await updateRegionalLocks();
  await runWeeklyMarketSnapshot();
  await runUpcomingWeeksSnapshotPrewarm();
});

// Executa a cada 5 minutos para atualizar pontuações em tempo real durante a week
cron.schedule("*/5 * * * *", async () => {
  await refreshWeekScores();
});

console.log("⏰ Cron diário iniciado (00:05) para lock de regionais e snapshot semanal.");
console.log("⏰ Cron a cada 5 minutos iniciado para atualização de pontuações em tempo real.");

setTimeout(() => {
  runUpcomingWeeksSnapshotPrewarm();
}, 3000);

// Executa refresh de scores logo ao iniciar
setTimeout(() => {
  refreshWeekScores();
}, 1000);