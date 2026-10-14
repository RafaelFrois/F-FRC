import bcrypt from "bcryptjs";
import connectMongo from "../config/mongo.js";
import User from "../src/DataBase/models/Users.js";
import { methodNotAllowed, parseJsonBody, sendError, setCors, handleOptions } from "../lib/server/http.js";
import { ensureUserSeasonState, ensureUserWeekState } from "../lib/server/userSeason.js";
import { getCurrentWeek, refreshSingleUserScores } from "../lib/server/scoringSync.js";
import { setAuthCookie, signUserToken } from "../lib/server/auth.js";
import { EMAIL_COLLATION, validateLogin } from "../lib/server/validation.js";

const INVALID_CREDENTIALS = "Email ou senha incorretos";

// Contas antigas foram gravadas sem normalizar o e-mail, então a busca ignora a caixa.
// Se existir mais de uma conta com o mesmo e-mail em caixas diferentes, a senha decide.
async function findUserByCredentials(email, password) {
  const candidates = await User.find({ email }).collation(EMAIL_COLLATION).limit(5);
  candidates.sort((a, b) => Number(b.email === email) - Number(a.email === email));

  for (const candidate of candidates) {
    if (typeof candidate.password !== "string" || !candidate.password) continue;
    if (await bcrypt.compare(password, candidate.password)) return candidate;
  }
  return null;
}

// Atualiza pontos e estado da week. Não pode impedir o login: se falhar
// (API externa fora do ar, documento antigo inválido), registra e segue.
async function refreshUserState(user) {
  try {
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
  } catch (error) {
    console.error(`[login] Falha ao atualizar estado do usuário ${user._id}:`, error?.message || error);
  }
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["POST"])) return;

  try {
    const { email, password } = validateLogin(await parseJsonBody(req));
    await connectMongo();

    const user = await findUserByCredentials(email, password);
    if (!user) {
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }

    const token = signUserToken(user._id);
    await refreshUserState(user);
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
    return sendError(res, error, "Erro interno ao processar login.");
  }
}
