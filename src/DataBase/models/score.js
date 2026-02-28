import mongoose from "mongoose";

const ScoreSchema = new mongoose.Schema({
  team_key: { type: String, required: true },
  event_key: { type: String, required: true },
  autoPoints: { type: Number, required: true, default: 0 },
  teleopPoints: { type: Number, required: true, default: 0 },
  endgamePoints: { type: Number, required: true, default: 0 },
  winPoints: { type: Number, required: true, default: 0 },
  penaltyPoints: { type: Number, required: true, default: 0 },
  bonusPoints: { type: Number, required: true, default: 0 },
  totalPoints: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

ScoreSchema.index({ event_key: 1, totalPoints: -1 });
ScoreSchema.index({ event_key: 1, team_key: 1 }, { unique: true });

export default mongoose.model("Score", ScoreSchema);