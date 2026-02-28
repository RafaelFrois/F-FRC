import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  frcTeamNumber: { type: Number },
  rookieYear: { type: Number },
  profilePhoto: { type: String },

  patrimonio: { type: Number, default: 800 },
  patrimonioSeason: { type: Number, default: () => new Date().getFullYear() },
  totalPointsSeason: { type: Number, default: 0 },

  regionals: [
    {
      regionalName: String,
      week: Number,
      eventKey: String,
      alliance: [
        {
          teamNumber: Number,
          isCaptain: Boolean,
          points: { type: Number, default: 0 },
          marketValue: { type: Number, default: 0 }
        }
      ],
      totalRegionalPoints: { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

export default mongoose.model("User", userSchema);