import connectMongo from "../../../../config/mongo.js";
import { getTeamPriceForWeek } from "../../../../src/DataBase/services/marketSnapshot.service.js";
import { methodNotAllowed, setCors, handleOptions } from "../../../../lib/server/http.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET"])) return;

  try {
    await connectMongo();

    const season = Number(req.query.season);
    const week = Number(req.query.week);
    const teamNumber = Number(req.query.teamNumber);

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
    return res.status(500).json({
      message: "Erro ao buscar preço congelado do time",
      error: error.message
    });
  }
}
