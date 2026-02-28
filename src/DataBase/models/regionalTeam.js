import mongoose from "mongoose";

const RegionalTeamSchema = new mongoose.Schema({
  event_key: String,
  team_number: Number,
  nickname: String,
  locality: String,
  last_event_points: Number
});

export default mongoose.model("RegionalTeam", RegionalTeamSchema);