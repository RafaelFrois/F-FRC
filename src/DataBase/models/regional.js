import mongoose from "mongoose";

const RegionalSchema = new mongoose.Schema({
  event_key: { type: String, unique: true },
  name: String,
  week: Number,
  start_date: Date,
  end_date: Date,
  locked: { type: Boolean, default: false },
  teams_cached: { type: Boolean, default: false }
});

export default mongoose.model("Regional", RegionalSchema);