require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const result = await db.collection('regionalteams').updateMany(
    {},
    { $unset: { price: '' } }
  );

  console.log('Matched:', result.matchedCount, 'Modified:', result.modifiedCount);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
