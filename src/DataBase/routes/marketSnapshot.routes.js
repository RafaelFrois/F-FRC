import express from "express";
import { getTeamPriceForWeek } from "../services/marketSnapshot.service.js";
import { calculateTeamMarketPrice } from "../services/pricing.service.js";

const router = express.Router();

// Diagnóstico completo do preço para auditoria.
router.get("/debug/:season/:week/:teamNumber", async (req, res) => {
  try {
    const season = Number(req.params.season);
    const week = Number(req.params.week);
    const teamNumber = Number(req.params.teamNumber);

    if (!Number.isInteger(season) || !Number.isInteger(week) || !Number.isInteger(teamNumber)) {
      return res.status(400).json({ message: "Parâmetros inválidos. Use season/week/teamNumber numéricos." });
    }

    const snapshot = await getTeamPriceForWeek(teamNumber, season, week);
    const live = await calculateTeamMarketPrice(teamNumber, season, { includeDiagnostics: true });

    return res.json({
      teamNumber,
      season,
      week,
      snapshot: snapshot
        ? {
          found: true,
          price: snapshot.price,
          weightedEPA: snapshot.weightedEPA,
          trendFactor: snapshot.trendFactor,
          regionalFactor: snapshot.regionalFactor,
          calculatedAt: snapshot.calculatedAt
        }
        : { found: false },
      liveCalculation: {
        price: live.finalPrice,
        weightedEPA: live.weightedEPA,
        trendFactor: live.trendFactor,
        regionalFactor: live.regionalFactor,
        diagnostics: live.diagnostics || null
      },
      effectiveReturnedPrice: snapshot?.price ?? live.finalPrice,
      effectiveSource: snapshot ? "snapshot" : "live_calculation"
    });
  } catch (error) {
    console.error("❌ Erro em GET /api/market-price/debug/:season/:week/:teamNumber:", error.message);
    return res.status(500).json({
      message: "Erro ao gerar diagnóstico de preço",
      error: error.message
    });
  }
});

// Retorna o preço congelado (snapshot) de um time para season/week específica.
router.get("/:season/:week/:teamNumber", async (req, res) => {
  try {
    const season = Number(req.params.season);
    const week = Number(req.params.week);
    const teamNumber = Number(req.params.teamNumber);

    if (!Number.isInteger(season) || !Number.isInteger(week) || !Number.isInteger(teamNumber)) {
      return res.status(400).json({ message: "Parâmetros inválidos. Use season/week/teamNumber numéricos." });
    }

    const snapshot = await getTeamPriceForWeek(teamNumber, season, week);

    if (!snapshot) {
      return res.status(404).json({
        message: "Snapshot não encontrado para esse time/season/week."
      });
    }

    return res.json({
      teamNumber: snapshot.teamNumber,
      season: snapshot.season,
      week: snapshot.week,
      price: snapshot.price,
      weightedEPA: snapshot.weightedEPA,
      trendFactor: snapshot.trendFactor,
      regionalFactor: snapshot.regionalFactor,
      calculatedAt: snapshot.calculatedAt
    });
  } catch (error) {
    console.error("❌ Erro em GET /api/market-price/:season/:week/:teamNumber:", error.message);
    return res.status(500).json({
      message: "Erro ao buscar preço congelado do time",
      error: error.message
    });
  }
});

export default router;
