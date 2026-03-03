import mongoose from "mongoose";
import connectMongo from "../config/mongo.js";

export default async function handler(req, res) {
  const env = {
    MONGO_URI: Boolean(process.env.MONGO_URI),
    JWT_SECRET: Boolean(process.env.JWT_SECRET),
    CORS_ORIGINS: Boolean(process.env.CORS_ORIGINS),
    TBA_KEY: Boolean(process.env.TBA_KEY)
  };

  try {
    await connectMongo();

    return res.status(200).json({
      ok: true,
      service: "api",
      mongo: {
        connected: mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState
      },
      env,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      service: "api",
      mongo: {
        connected: false,
        readyState: mongoose.connection.readyState
      },
      env,
      message: "Falha ao conectar no banco de dados",
      details: process.env.NODE_ENV === "production" ? undefined : error.message,
      timestamp: new Date().toISOString()
    });
  }
}