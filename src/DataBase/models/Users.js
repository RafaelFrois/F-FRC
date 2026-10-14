import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  frcTeamNumber: { type: Number },
  rookieYear: { type: Number },
  profilePhoto: { type: String },

  patrimonio: { type: Number, default: 300 },
  patrimonioSeason: { type: Number, default: () => new Date().getFullYear() },
  weekStateSeason: { type: Number, default: () => new Date().getFullYear() },
  weekStateNumber: { type: Number, default: 1 },
  totalPointsCarryover: { type: Number, default: 0 },
  totalPointsSeason: { type: Number, default: 0 },

  regionals: [
    {
      regionalName: String,
      week: Number,
      eventKey: String,
      eventStartDate: Date,
      alliance: [
        {
          teamNumber: Number,
          nickname: String,
          isCaptain: Boolean,
          points: { type: Number, default: 0 },
          marketValue: { type: Number, default: 0 }
        }
      ],
      totalRegionalPoints: { type: Number, default: 0 },
      // Quando o custo da aliança voltou ao patrimônio (fim da week do regional)
      patrimonySettledAt: Date,
      createdAt: { type: Date, default: Date.now }
    }
  ],

  // Temporadas anteriores arquivadas na virada de temporada (nada é apagado)
  seasonHistory: [
    {
      season: Number,
      totalPointsSeason: Number,
      patrimonio: Number,
      regionals: { type: Array, default: [] },
      archivedAt: Date
    }
  ]
}, { timestamps: true });

export default mongoose.model("User", userSchema);