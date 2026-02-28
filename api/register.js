import bcrypt from "bcryptjs";
import connectMongo from "../config/mongo.js";
import User from "../src/DataBase/models/Users.js";
import { methodNotAllowed, parseJsonBody, setCors, handleOptions } from "./_lib/http.js";
import { STARTING_PATRIMONY } from "./_lib/userSeason.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["POST"])) return;

  try {
    await connectMongo();

    const { email, username, password, frcTeamNumber, rookieYear } = await parseJsonBody(req);
    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email já cadastrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      username,
      password: hashedPassword,
      frcTeamNumber,
      rookieYear,
      patrimonio: STARTING_PATRIMONY,
      patrimonioSeason: currentSeason
    });

    await newUser.save();
    return res.status(201).json({ message: "Usuário criado com sucesso" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: "JSON inválido no corpo da requisição" });
    }
    return res.status(500).json({ error: error.message });
  }
}
