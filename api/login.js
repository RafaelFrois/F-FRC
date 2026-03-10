import bcrypt from "bcryptjs";
import connectMongo from "../config/mongo.js";
import User from "../src/DataBase/models/Users.js";
import { methodNotAllowed, parseJsonBody, setCors, handleOptions } from "../lib/server/http.js";
import { ensureUserSeasonState, ensureUserWeekState } from "../lib/server/userSeason.js";
import { getCurrentWeek, refreshSingleUserScores } from "../lib/server/scoringSync.js";
import { setAuthCookie, signUserToken } from "../lib/server/auth.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["POST"])) return;

  try {
    await connectMongo();
    const { email, password } = await parseJsonBody(req);

    if (!email || !password) {
      return res.status(400).json({ message: "Email e senha são obrigatórios" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Email ou senha incorretos" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Email ou senha incorretos" });
    }

    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const seasonResetApplied = ensureUserSeasonState(user, currentSeason);
    const pointsUpdated = await refreshSingleUserScores(user);
    const weekResetApplied = ensureUserWeekState(user, currentSeason, getCurrentWeek(currentSeason));
    if (seasonResetApplied || pointsUpdated || weekResetApplied) {
      if (pointsUpdated) {
        user.markModified("regionals");
      }
      await user.save();
    }

    const token = signUserToken(user._id);
    setAuthCookie(res, token);

    return res.status(200).json({
      message: "Login realizado com sucesso",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        frcTeamNumber: user.frcTeamNumber,
        rookieYear: user.rookieYear,
        regionals: user.regionals || []
      }
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: "JSON inválido no corpo da requisição" });
    }

    if (error?.diagnosis) {
      return res.status(error.diagnosis.httpStatus || 500).json({
        message: error.diagnosis.message,
        code: error.diagnosis.code,
        suggestion: error.diagnosis.suggestion
      });
    }

    const rawMessage = String(error?.message || "");
    const normalizedMessage = rawMessage.toLowerCase();

    if (normalizedMessage.includes("mongo_uri não definida") || normalizedMessage.includes("mongo_uri")) {
      return res.status(500).json({
        message: "Configuração do servidor incompleta: variável MONGO_URI não definida na Vercel."
      });
    }

    if (
      normalizedMessage.includes("ecconnrefused") ||
      normalizedMessage.includes("etimedout") ||
      normalizedMessage.includes("server selection") ||
      normalizedMessage.includes("querysrv")
    ) {
      return res.status(503).json({
        message: "Não foi possível conectar ao banco de dados no momento."
      });
    }

    return res.status(500).json({
      message: "Erro interno ao processar login.",
      details: process.env.NODE_ENV === "production" ? undefined : rawMessage
    });
  }
}
