import mongoose from "mongoose";

const globalCache = globalThis;

if (!globalCache.__mongooseCache) {
  globalCache.__mongooseCache = { conn: null, promise: null };
}

export default async function connectMongo() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw new Error("MONGO_URI não definida.");
  }

  const cache = globalCache.__mongooseCache;

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGO_URI, {
      bufferCommands: false
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
