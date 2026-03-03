import connectMongo from "../config/mongo.js";
import User from "../src/DataBase/models/Users.js";
import { getUserIdFromRequest } from "../lib/server/auth.js";
import { methodNotAllowed, parseJsonBody, setCors, handleOptions } from "../lib/server/http.js";
import { ensureUserSeasonState } from "../lib/server/userSeason.js";
import { refreshSingleUserScores } from "../lib/server/scoringSync.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET", "PUT"])) return;

  try {
    await connectMongo();
    const userId = getUserIdFromRequest(req);

    if (req.method === "GET") {
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

      const userWithoutPassword = user.toObject();
      delete userWithoutPassword.password;
      return res.json({ user: userWithoutPassword });
    }

    const { username, frcTeamNumber, rookieYear, profilePhoto } = await parseJsonBody(req);
    const update = {};
    if (username !== undefined) update.username = username;
    if (frcTeamNumber !== undefined) update.frcTeamNumber = frcTeamNumber;
    if (rookieYear !== undefined) update.rookieYear = rookieYear;
    if (profilePhoto !== undefined) update.profilePhoto = profilePhoto;

    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json({ message: "Perfil atualizado com sucesso", user });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: "JSON inválido no corpo da requisição" });
    }
    return res.status(500).json({ error: error.message });
  }
}
