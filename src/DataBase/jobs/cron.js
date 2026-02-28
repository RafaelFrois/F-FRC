import cron from "node-cron";
import Regional from "../models/regional.js";
import {
  generateUpcomingWeeksMarketSnapshots,
  generateWeekMarketSnapshot,
  getWeekToGenerateForToday,
  hasWeekSnapshot
} from "../services/marketSnapshot.service.js";

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

// Executa diariamente às 00:05
cron.schedule("5 0 * * *", async () => {
  await updateRegionalLocks();
  await runWeeklyMarketSnapshot();
  await runUpcomingWeeksSnapshotPrewarm();
});

console.log("⏰ Cron diário iniciado (00:05) para lock de regionais e snapshot semanal.");

setTimeout(() => {
  runUpcomingWeeksSnapshotPrewarm();
}, 3000);