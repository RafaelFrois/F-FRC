import mongoose from "mongoose";

const teamMarketSnapshotSchema = new mongoose.Schema({
  teamNumber: { type: Number, required: true },
  season: { type: Number, required: true },
  week: { type: Number, required: true },
  price: { type: Number, required: true },
  weightedEPA: { type: Number, required: true },
  trendFactor: { type: Number, required: true },
  regionalFactor: { type: Number, required: true },
  calculatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

teamMarketSnapshotSchema.index({ teamNumber: 1, season: 1, week: 1 }, { unique: true });

export default mongoose.model("TeamMarketSnapshot", teamMarketSnapshotSchema);