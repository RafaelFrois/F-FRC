import bcrypt from "bcryptjs";
import connectMongo from "../config/mongo.js";
import User from "../src/DataBase/models/Users.js";
import { methodNotAllowed, parseJsonBody, sendError, setCors, handleOptions } from "../lib/server/http.js";
import { STARTING_PATRIMONY } from "../lib/server/userSeason.js";
import {
  EMAIL_COLLATION,
  duplicateKeyField,
  isDuplicateKeyError,
  validateRegistration
} from "../lib/server/validation.js";

const BCRYPT_ROUNDS = 10;

function conflict(res, field) {
  const message = field === "username" ? "Nome de usuário já está em uso" : "Email já cadastrado";
  return res.status(409).json({ message, field });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["POST"])) return;

  try {
    const { email, username, password, frcTeamNumber, rookieYear } = validateRegistration(await parseJsonBody(req));
    await connectMongo();

    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();

    // Contas antigas podem ter e-mail com maiúsculas: a checagem ignora a caixa.
    const existingEmail = await User.exists({ email }).collation(EMAIL_COLLATION);
    if (existingEmail) return conflict(res, "email");

    const existingUsername = await User.exists({ username });
    if (existingUsername) return conflict(res, "username");

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await User.create({
      email,
      username,
      password: hashedPassword,
      frcTeamNumber,
      rookieYear,
      patrimonio: STARTING_PATRIMONY,
      patrimonioSeason: currentSeason
    });

    return res.status(201).json({ message: "Usuário criado com sucesso" });
  } catch (error) {
    // Corrida entre duas requisições simultâneas: o índice único decide.
    if (isDuplicateKeyError(error)) {
      return conflict(res, duplicateKeyField(error));
    }
    return sendError(res, error, "Erro ao cadastrar usuário");
  }
}
