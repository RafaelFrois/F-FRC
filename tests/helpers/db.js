// Banco isolado para testes. Usa MONGO_TEST_URI se definido; caso contrário,
// sobe um MongoDB em memória (mongodb-memory-server). Nunca usa MONGO_URI do .env.
import mongoose from "mongoose";

let memoryServer = null;

export async function startTestDatabase() {
  let uri = process.env.MONGO_TEST_URI;
  if (!uri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  const dbName = `ffrc_test_${process.pid}_${Date.now()}`;
  const url = new URL(uri);
  url.pathname = `/${dbName}`;
  process.env.MONGO_URI = url.toString();
  process.env.JWT_SECRET = "test-secret-only-for-automated-tests";
  process.env.NODE_ENV = "test";
  process.env.TBA_KEY = "test-key-not-real";
  return process.env.MONGO_URI;
}

export async function stopTestDatabase() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
  globalThis.__mongooseCache = { conn: null, promise: null };
  if (memoryServer) await memoryServer.stop();
}
