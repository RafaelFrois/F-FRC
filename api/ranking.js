import connectMongo from "../config/mongo.js";
import User from "../src/DataBase/models/Users.js";
import { getUserIdFromRequest } from "../lib/server/auth.js";
import { methodNotAllowed, setCors, handleOptions } from "../lib/server/http.js";
import { ensureUserSeasonState } from "../lib/server/userSeason.js";
import { refreshSingleUserScores } from "../lib/server/scoringSync.js";

function parseSearch(rawSearch) {
  return String(rawSearch || "").trim().toLowerCase();
}

function includesSearch(user, filters) {
  const search = String(filters?.search || "").trim().toLowerCase();
  const name = String(filters?.name || "").trim().toLowerCase();
  const teamNumber = String(filters?.teamNumber || "").trim().toLowerCase();

  const username = String(user?.username || "").toLowerCase();
  const userTeamNumber = String(user?.frcTeamNumber || "").toLowerCase();

  const matchesSearch = !search || username.includes(search) || userTeamNumber.includes(search);
  const matchesName = !name || username.includes(name);
  const matchesTeamNumber = !teamNumber || userTeamNumber.includes(teamNumber);

  return matchesSearch && matchesName && matchesTeamNumber;
}

function sanitizeRankingUser(user) {
  return {
    id: String(user?._id || user?.id || ""),
    username: String(user?.username || "Usuário"),
    profilePhoto: user?.profilePhoto || "",
    frcTeamNumber: Number.isFinite(Number(user?.frcTeamNumber)) ? Number(user.frcTeamNumber) : null,
    totalPointsSeason: Number(user?.totalPointsSeason || 0)
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET"])) return;

  try {
    await connectMongo();

    const userId = getUserIdFromRequest(req);
    const targetUserId = String(req.query?.userId || "").trim();
    const filters = {
      search: parseSearch(req.query?.q),
      name: parseSearch(req.query?.name),
      teamNumber: parseSearch(req.query?.teamNumber)
    };

    const users = await User.find({}).select("username profilePhoto frcTeamNumber totalPointsSeason regionals patrimonio patrimonioSeason");

    for (const user of users) {
      const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();
      const seasonResetApplied = ensureUserSeasonState(user, currentSeason);
      const pointsUpdated = await refreshSingleUserScores(user);

      if (seasonResetApplied || pointsUpdated) {
        if (pointsUpdated) {
          user.markModified("regionals");
        }
        await user.save();
      }
    }

    const sorted = users
      .map((entry) => sanitizeRankingUser(entry))
      .sort((a, b) => {
        if (b.totalPointsSeason !== a.totalPointsSeason) {
          return b.totalPointsSeason - a.totalPointsSeason;
        }

        return a.username.localeCompare(b.username, "pt-BR");
      });

    const rankingWithPositions = sorted.map((entry, index) => ({
      ...entry,
      position: index + 1
    }));

    if (targetUserId) {
      const targetUser = rankingWithPositions.find((entry) => entry.id === targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const fullUser = await User.findById(targetUserId).select("username profilePhoto frcTeamNumber rookieYear patrimonio totalPointsSeason");
      if (!fullUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      return res.status(200).json({
        user: {
          id: String(fullUser?._id || ""),
          username: String(fullUser?.username || "Usuário"),
          profilePhoto: fullUser?.profilePhoto || "",
          frcTeamNumber: Number.isFinite(Number(fullUser?.frcTeamNumber)) ? Number(fullUser.frcTeamNumber) : null,
          rookieYear: Number.isFinite(Number(fullUser?.rookieYear)) ? Number(fullUser.rookieYear) : null,
          patrimonio: Number(fullUser?.patrimonio || 0),
          totalPointsSeason: Number(fullUser?.totalPointsSeason || 0)
        },
        position: targetUser.position
      });
    }

    const filtered = rankingWithPositions.filter((entry) => includesSearch(entry, filters));
    const currentUserRanking = rankingWithPositions.find((entry) => entry.id === String(userId));

    return res.status(200).json({
      ranking: filtered,
      currentUser: {
        id: String(userId),
        position: currentUserRanking?.position || null,
        totalPointsSeason: Number(currentUserRanking?.totalPointsSeason || 0)
      }
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: "Erro ao buscar ranking mundial" });
  }
}
