import connectMongo from "../../../../../config/mongo.js";
import {
  getTeamPriceForWeek
} from "../../../../../src/DataBase/services/marketSnapshot.service.js";
import { calculateTeamMarketPrice } from "../../../../../src/DataBase/services/pricing.service.js";
import { methodNotAllowed, setCors, handleOptions } from "../../../../_lib/http.js";

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
    return res.status(500).json({
      message: "Erro ao gerar diagnóstico de preço",
      error: error.message
    });
  }
}
