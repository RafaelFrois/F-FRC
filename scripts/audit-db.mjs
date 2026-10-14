// Auditoria SOMENTE LEITURA do MongoDB do Fantasy FRC.
// Uso: npm run audit:db   (lê MONGO_URI do .env ou do ambiente)
// Não altera nenhum documento e não imprime e-mails, senhas ou tokens: só contagens.
import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("Defina MONGO_URI no .env ou no ambiente.");
  process.exit(1);
}

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  console.log(`Banco: ${db.databaseName}`);

  const collections = await db.listCollections().toArray();
  console.log("\nColeções:");
  for (const { name } of collections) {
    const count = await db.collection(name).estimatedDocumentCount();
    const indexes = await db.collection(name).indexes();
    const indexText = indexes.map((index) => `${JSON.stringify(index.key)}${index.unique ? " unique" : ""}${index.collation ? " collation" : ""}`);
    console.log(`- ${name}: ${count} documentos; índices: ${indexText.join(", ")}`);
  }

  const users = db.collection("users");
  const checks = {
    "sem e-mail": { $or: [{ email: { $exists: false } }, { email: null }, { email: "" }] },
    "e-mail com maiúsculas ou espaços": { email: { $regex: /[A-Z]|^\s|\s$/ } },
    "sem nome de usuário": { $or: [{ username: { $exists: false } }, { username: null }, { username: "" }] },
    "sem senha": { $or: [{ password: { $exists: false } }, { password: null }, { password: "" }] },
    "senha que não é hash bcrypt": { password: { $exists: true, $type: "string", $not: BCRYPT_PATTERN } },
    "patrimônio ausente ou não numérico": { patrimonio: { $not: { $type: "number" } } },
    "patrimônio negativo": { patrimonio: { $lt: 0 } },
    "com alianças salvas": { "regionals.0": { $exists: true } }
  };

  console.log("\nUsuários:");
  for (const [label, filter] of Object.entries(checks)) {
    console.log(`- ${label}: ${await users.countDocuments(filter)}`);
  }

  const duplicateEmails = await users.aggregate([
    { $match: { email: { $type: "string" } } },
    { $group: { _id: { $toLower: { $trim: { input: "$email" } } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" }
  ]).toArray();
  console.log(`- e-mails repetidos ignorando maiúsculas: ${duplicateEmails[0]?.groups || 0} grupo(s)`);

  const allianceIssues = await users.aggregate([
    { $unwind: "$regionals" },
    {
      $project: {
        size: { $size: { $ifNull: ["$regionals.alliance", []] } },
        captains: {
          $size: {
            $filter: { input: { $ifNull: ["$regionals.alliance", []] }, cond: { $eq: ["$$this.isCaptain", true] } }
          }
        },
        distinctTeams: { $size: { $setUnion: [{ $ifNull: ["$regionals.alliance.teamNumber", []] }, []] } }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        notThreeTeams: { $sum: { $cond: [{ $ne: ["$size", 3] }, 1, 0] } },
        notOneCaptain: { $sum: { $cond: [{ $ne: ["$captains", 1] }, 1, 0] } },
        repeatedTeams: { $sum: { $cond: [{ $ne: ["$distinctTeams", "$size"] }, 1, 0] } }
      }
    }
  ]).toArray();
  const issues = allianceIssues[0] || { total: 0, notThreeTeams: 0, notOneCaptain: 0, repeatedTeams: 0 };
  console.log("\nAlianças:");
  console.log(`- total: ${issues.total}`);
  console.log(`- sem exatamente 3 equipes: ${issues.notThreeTeams}`);
  console.log(`- sem exatamente 1 capitão: ${issues.notOneCaptain}`);
  console.log(`- com equipe repetida: ${issues.repeatedTeams}`);

  if (collections.some(({ name }) => name === "scores")) {
    const duplicateScores = await db.collection("scores").aggregate([
      { $group: { _id: { event: "$event_key", team: "$team_key" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: "groups" }
    ]).toArray();
    console.log(`\nScores duplicados (mesmo evento e equipe): ${duplicateScores[0]?.groups || 0}`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Falha na auditoria:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
