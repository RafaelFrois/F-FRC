require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const currentSeason = Number(process.env.FRC_SEASON_YEAR) || new Date().getFullYear();

  const result = await db.collection('users').updateMany(
    {
      patrimonio: 400,
      $or: [
        { regionals: { $exists: false } },
        { regionals: { $size: 0 } }
      ]
    },
    {
      $set: {
        patrimonio: 800,
        patrimonioSeason: currentSeason
      }
    }
  );

  console.log('Users fixed from 400->800:', result.modifiedCount);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
