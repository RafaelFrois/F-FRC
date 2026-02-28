import express from "express";
import { calculateEventScores } from "../services/scoring.service.js";

const router = express.Router();

router.post("/calculate/:event_key", async (req, res) => {
  try {
    const eventKey = String(req.params.event_key || "").trim().toLowerCase();

    if (!eventKey) {
      return res.status(400).json({
        message: "event_key é obrigatório"
      });
    }

    const result = await calculateEventScores(eventKey);

    return res.status(200).json({
      message: "Pontuação calculada e salva com sucesso",
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erro ao calcular pontuação do evento",
      error: error.message,
      details: error.details || null
    });
  }
});

export default router;
