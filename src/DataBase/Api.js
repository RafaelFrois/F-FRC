import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, "../../.env");
console.log("📁 Procurando .env em:", envPath);

dotenv.config({ path: envPath });

console.log("🔍 TBA_KEY após dotenv.config:", process.env.TBA_KEY ? "CARREGADA" : "NÃO ENCONTRADA");
console.log("🔍 Todas as variáveis:", Object.keys(process.env).filter(k => k.includes("TBA") || k.includes("MONGO") || k.includes("JWT")));

// Agora importam os módulos que usam process.env
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import User from "./models/Users.js";
import Regional from "./models/regional.js";
import regionalRoutes from "./routes/regional.routes.js";
import marketSnapshotRoutes from "./routes/marketSnapshot.routes.js";
import scoreRoutes from "./routes/score.routes.js";
import { getEventsByYear } from "./services/tba.services.js";
import { ensureTeamPriceForWeek } from "./services/marketSnapshot.service.js";
import "./jobs/cron.js";

const app = express();
const PORT = 3000;
const STARTING_PATRIMONY = 800;

function getWeekNumberFromDate(dateInput, seasonYear) {
  const eventDate = new Date(dateInput);
  const week1Start = new Date(seasonYear, 2, 1);

  if (eventDate < new Date(seasonYear, 2, 8)) {
    return 1;
  }

  const daysSinceWeek1 = Math.floor((eventDate - week1Start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(daysSinceWeek1 / 7) + 1);
}

function ensureUserSeasonState(user, seasonYear) {
  const sameSeason = Number(user.patrimonioSeason) === Number(seasonYear);

  if (sameSeason) {
    const hasNoAlliances = !Array.isArray(user.regionals) || user.regionals.length === 0;
    if (hasNoAlliances && Number(user.patrimonio) !== STARTING_PATRIMONY) {
      user.patrimonio = STARTING_PATRIMONY;
      return true;
    }

    return false;
  }

  user.patrimonio = STARTING_PATRIMONY;
  user.totalPointsSeason = 0;
  user.regionals = [];
  user.patrimonioSeason = Number(seasonYear);
  return true;
}

// CORS deve estar ANTES das rotas
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());

// Agora as rotas
app.use("/api/regionals", regionalRoutes);
app.use("/api/market-price", marketSnapshotRoutes);
app.use("/score", scoreRoutes);
// setup uploads folder and serve it
const uploadsDir = join(__dirname, '../../public/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });


const connectDB = async () => {
  try {
    console.log("Tentando conectar...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✓ Conectado ao MongoDB com sucesso!");
  } catch (error) {
    console.error("✗ Erro ao conectar:", error.message);
  }
};

connectDB();

// Rota teste
app.post("/", (req, res) => {
  res.json({ message: "API funcionando" });
});

// Rota de cadastro
app.post("/api/register", async (req, res) => {
  try {
    const { email, username, password, frcTeamNumber, rookieYear } = req.body;
    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();

    // Verifica se já existe usuário com esse email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email já cadastrado" });
    }

    // Criptografa senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria novo usuário
    const newUser = new User({
      email,
      username,
      password: hashedPassword,
      frcTeamNumber,
      rookieYear,
      patrimonio: STARTING_PATRIMONY,
      patrimonioSeason: currentSeason
    });

    // Salva no banco
    await newUser.save();

    res.status(201).json({ message: "Usuário criado com sucesso" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota de login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("🔐 Tentativa de login:", email);

    // Verifica se email e senha foram fornecidos
    if (!email || !password) {
      console.log("❌ Email ou senha ausentes");
      return res.status(400).json({ message: "Email e senha são obrigatórios" });
    }

    // Procura usuário por email
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ Usuário não encontrado:", email);
      return res.status(401).json({ message: "Email ou senha incorretos" });
    }

    // Compara senha com a hash armazenada
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log("❌ Senha incorreta para:", email);
      return res.status(401).json({ message: "Email ou senha incorretos" });
    }

    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const seasonResetApplied = ensureUserSeasonState(user, currentSeason);
    if (seasonResetApplied) {
      await user.save();
    }

    // Login bem-sucedido - cria token e seta cookie
    const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
    console.log("✅ Login bem-sucedido:", email);
    res.status(200).json({ 
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
    console.error("❌ Erro no login:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// auth middleware
function authMiddleware(req, res, next) {
  try {
    console.log("🔐 authMiddleware - Cookies recebidos:", req.cookies);
    const token = req.cookies && req.cookies.token;
    if (!token) {
      console.log("❌ authMiddleware - Token não encontrado nos cookies!");
      return res.status(401).json({ message: 'Não autenticado' });
    }
    console.log("✅ authMiddleware - Token encontrado");
    const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
    const payload = jwt.verify(token, JWT_SECRET);
    console.log("✅ authMiddleware - Token válido para userId:", payload.id);
    req.userId = payload.id;
    next();
  } catch (error) {
    console.error("❌ authMiddleware - Erro:", error.message);
    return res.status(401).json({ message: 'Token inválido' });
  }
}

// Get user by id
app.get('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user (partial)
app.put('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, frcTeamNumber, rookieYear, profilePhoto } = req.body;

    const update = {};
    if (username !== undefined) update.username = username;
    if (frcTeamNumber !== undefined) update.frcTeamNumber = frcTeamNumber;
    if (rookieYear !== undefined) update.rookieYear = rookieYear;
    if (profilePhoto !== undefined) update.profilePhoto = profilePhoto;

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ message: 'Perfil atualizado com sucesso', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload profile photo
app.post('/user/:id/photo', upload.single('profilePhoto'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(id, { profilePhoto: url }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ message: 'Foto enviada', url, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Current authenticated user
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    console.log("👤 GET /me - Procurando usuário com ID:", req.userId);
    const user = await User.findById(req.userId);
    if (!user) {
      console.log("❌ GET /me - Usuário não encontrado! ID:", req.userId);
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    const seasonResetApplied = ensureUserSeasonState(user, currentSeason);
    if (seasonResetApplied) {
      await user.save();
    }

    console.log("✅ GET /me - Usuário encontrado:", user.email);
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("❌ GET /me - Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/me', authMiddleware, async (req, res) => {
  try {
    const { username, frcTeamNumber, rookieYear, profilePhoto } = req.body;
    const update = {};
    if (username !== undefined) update.username = username;
    if (frcTeamNumber !== undefined) update.frcTeamNumber = frcTeamNumber;
    if (rookieYear !== undefined) update.rookieYear = rookieYear;
    if (profilePhoto !== undefined) update.profilePhoto = profilePhoto;
    const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ message: 'Perfil atualizado com sucesso', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/me/photo', authMiddleware, upload.single('profilePhoto'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.userId, { profilePhoto: url }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ message: 'Foto enviada', url, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// salvar aliança do usuário
app.post('/api/me/alliance', authMiddleware, async (req, res) => {
  try {
    console.log("🔐 POST /me/alliance - userId:", req.userId);
    const { eventKey, alliance, isEditing = false } = req.body;
    const normalizedEventKey = String(eventKey || '').trim().toLowerCase();
    console.log("📦 Dados recebidos:", { eventKey, allianceLength: alliance?.length });
    
    if (!normalizedEventKey || !Array.isArray(alliance) || alliance.length === 0) {
      console.log("❌ Validação falhou: eventKey ou alliance inválido");
      return res.status(400).json({ message: 'Dados inválidos' });
    }

    // REGRA 1 + 4: Validar se o regional já começou
    const year = new Date().getFullYear();
    let allEvents = [];
    try {
      const allEventsRes = await getEventsByYear(year);
      allEvents = allEventsRes;
      console.log("✅ Eventos do TBA carregados:", allEvents.length);
    } catch (err) {
      console.warn("⚠️ Erro ao buscar eventos do TBA:", err.message);
    }

    const event = allEvents.find(e => String(e.key || '').trim().toLowerCase() === normalizedEventKey);
    if (event) {
      const today = new Date();
      const eventStart = new Date(event.start_date);
      console.log("📅 Verificando datas - Hoje:", today, "Início do evento:", eventStart);
      if (today >= eventStart) {
        console.log("🔒 Regional já iniciado!");
        return res.status(403).json({
          message: "Este regional já foi iniciado. Não é possível adicionar aliança.",
          status: "locked"
        });
      }
    }

    // Buscar regional no banco
    console.log("🔍 Procurando regional com eventKey:", eventKey);
    const regional = await Regional.findOne({ event_key: normalizedEventKey });
    console.log("✅ Regional encontrado:", regional ? regional.name : "não encontrado");
    
    if (regional?.locked) {
      console.log("🔒 Regional bloqueado no banco!");
      return res.status(403).json({
        message: "Regional já iniciado",
        status: "locked"
      });
    }

    const seasonYear = event?.start_date
      ? new Date(event.start_date).getFullYear()
      : (Number(process.env.FRC_SEASON_YEAR) || year);
    const weekNumber = event?.start_date
      ? getWeekNumberFromDate(event.start_date, seasonYear)
      : (regional?.week || 1);

    const allianceWithMarketValue = await Promise.all(
      alliance.map(async (teamEntry) => {
        const teamNumber = Number(teamEntry.teamNumber);
        const snapshot = await ensureTeamPriceForWeek(teamNumber, seasonYear, weekNumber);
        if (!snapshot) {
          throw new Error(`Preço não encontrado para time ${teamNumber} na week ${weekNumber}`);
        }

        return {
          teamNumber,
          nickname: teamEntry.nickname,
          isCaptain: teamEntry.isCaptain,
          marketValue: Number(snapshot.price)
        };
      })
    );

    const totalAllianceCost = allianceWithMarketValue.reduce(
      (sum, teamEntry) => sum + Number(teamEntry.marketValue || 0),
      0
    );

    const entry = {
      regionalName: regional ? regional.name : eventKey,
      week: regional ? regional.week : null,
      alliance: allianceWithMarketValue,
      eventKey: normalizedEventKey,
      event_start_date: event ? event.start_date : null,
      event_end_date: event ? event.end_date : null,
      totalRegionalPoints: 0,
      createdAt: new Date()
    };

    console.log("👤 Procurando usuário ID:", req.userId);
    const user = await User.findById(req.userId);
    if (!user) {
      console.log("❌ Usuário não encontrado!");
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    ensureUserSeasonState(user, seasonYear);
    
    console.log("✅ Usuário encontrado:", user.name);
    user.regionals = user.regionals || [];

    const existingRegionalIndex = user.regionals.findIndex((regionalEntry) => {
      const savedEventKey = String(regionalEntry?.eventKey || '').trim().toLowerCase();
      return savedEventKey && savedEventKey === normalizedEventKey;
    });

    let message = 'Aliança salva';
    if (existingRegionalIndex >= 0) {
      if (!isEditing) {
        return res.status(409).json({
          message: 'Você já escalou neste regional. Não é possível criar outra aliança.'
        });
      }

      const previousEntry = user.regionals[existingRegionalIndex];
      const previousCost = (previousEntry?.alliance || []).reduce(
        (sum, teamEntry) => sum + Number(teamEntry?.marketValue || 0),
        0
      );
      const patrimonyAfterEdit = Number(user.patrimonio || 0) + previousCost - totalAllianceCost;

      if (patrimonyAfterEdit < 0) {
        return res.status(400).json({
          message: `Patrimônio insuficiente para editar aliança. Custo: ${totalAllianceCost} ◈, disponível: ${Number(user.patrimonio || 0) + previousCost} ◈`
        });
      }

      user.patrimonio = patrimonyAfterEdit;
      user.regionals[existingRegionalIndex] = {
        ...entry,
        createdAt: previousEntry?.createdAt || entry.createdAt
      };
      message = 'Aliança atualizada para este regional';
      console.log("♻️ Regional já existia para o usuário, aliança atualizada.");
    } else {
      if (Number(user.patrimonio || 0) < totalAllianceCost) {
        return res.status(400).json({
          message: `Patrimônio insuficiente. Custo da aliança: ${totalAllianceCost} ◈, disponível: ${Number(user.patrimonio || 0)} ◈`
        });
      }

      user.patrimonio = Number(user.patrimonio || 0) - totalAllianceCost;
      user.regionals.push(entry);
    }

    await user.save();
    
    console.log("💾 Aliança salva com sucesso!");
    res.json({ message, entry, user, totalAllianceCost, patrimonioAtual: user.patrimonio });
  } catch (error) {
    console.error("❌ ERRO em POST /me/alliance:", error.message, error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// excluir aliança do usuário por regional
app.delete('/api/me/alliance/:eventKey', authMiddleware, async (req, res) => {
  try {
    const normalizedEventKey = String(req.params.eventKey || '').trim().toLowerCase();

    if (!normalizedEventKey) {
      return res.status(400).json({ message: 'eventKey inválido' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
    ensureUserSeasonState(user, currentSeason);

    user.regionals = user.regionals || [];
    const regionalIndex = user.regionals.findIndex((regionalEntry) => {
      const savedEventKey = String(regionalEntry?.eventKey || '').trim().toLowerCase();
      return savedEventKey === normalizedEventKey;
    });

    if (regionalIndex < 0) {
      return res.status(404).json({ message: 'Aliança não encontrada para este regional' });
    }

    const targetRegional = user.regionals[regionalIndex];
    const eventStartDate = targetRegional?.event_start_date ? new Date(targetRegional.event_start_date) : null;
    if (eventStartDate && new Date() >= eventStartDate) {
      return res.status(403).json({
        message: 'Este regional já foi iniciado e não permite exclusão da aliança.',
        status: 'locked'
      });
    }

    const allianceRefund = (targetRegional?.alliance || []).reduce(
      (sum, teamEntry) => sum + Number(teamEntry?.marketValue || 0),
      0
    );

    user.patrimonio = Number(user.patrimonio || 0) + allianceRefund;

    user.regionals.splice(regionalIndex, 1);
    await user.save();

    return res.json({ message: 'Aliança excluída com sucesso', user, refund: allianceRefund, patrimonioAtual: user.patrimonio });
  } catch (error) {
    console.error('❌ ERRO em DELETE /me/alliance/:eventKey:', error.message, error.stack);
    return res.status(500).json({ error: error.message });
  }
});

// Inicia servidor - DEVE estar ao final, depois de todas as rotas
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});