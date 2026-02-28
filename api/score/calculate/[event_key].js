import connectMongo from "../../../config/mongo.js";
import { calculateEventScores } from "../../../src/DataBase/services/scoring.service.js";
import { methodNotAllowed, setCors, handleOptions } from "../../_lib/http.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["POST"])) return;

  try {
    await connectMongo();
    const eventKey = String(req.query.event_key || "").trim().toLowerCase();

    if (!eventKey) {
      return res.status(400).json({ message: "event_key é obrigatório" });
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
}
