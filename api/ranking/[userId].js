import connectMongo from "../../config/mongo.js";
import User from "../../src/DataBase/models/Users.js";
import { getUserIdFromRequest } from "../../lib/server/auth.js";
import { methodNotAllowed, setCors, handleOptions } from "../../lib/server/http.js";
import { ensureUserSeasonState } from "../../lib/server/userSeason.js";
import { refreshSingleUserScores } from "../../lib/server/scoringSync.js";

function sanitizePublicProfile(user) {
  return {
    id: String(user?._id || user?.id || ""),
    username: String(user?.username || "Usuário"),
    profilePhoto: user?.profilePhoto || "",
    frcTeamNumber: Number.isFinite(Number(user?.frcTeamNumber)) ? Number(user.frcTeamNumber) : null,
    rookieYear: Number.isFinite(Number(user?.rookieYear)) ? Number(user.rookieYear) : null,
    patrimonio: Number(user?.patrimonio || 0),
    totalPointsSeason: Number(user?.totalPointsSeason || 0)
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET"])) return;

  try {
    await connectMongo();
    getUserIdFromRequest(req);

    const userId = String(req.query?.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const seasonResetApplied = ensureUserSeasonState(user, currentSeason);
    const pointsUpdated = await refreshSingleUserScores(user);

    if (seasonResetApplied || pointsUpdated) {
      if (pointsUpdated) {
        user.markModified("regionals");
      }
      await user.save();
    }

    const higherScoreCount = await User.countDocuments({ totalPointsSeason: { $gt: Number(user.totalPointsSeason || 0) } });

    return res.status(200).json({
      user: sanitizePublicProfile(user),
      position: Number(higherScoreCount || 0) + 1
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: "Erro ao carregar perfil público" });
  }
}
