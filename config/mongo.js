import mongoose from "mongoose";

const globalCache = globalThis;

if (!globalCache.__mongooseCache) {
  globalCache.__mongooseCache = { conn: null, promise: null };
}

function classifyMongoError(error) {
  const rawMessage = String(error?.message || "");
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.includes("mongo_uri não definida") || normalizedMessage.includes("mongo_uri")) {
    return {
      code: "MONGO_ENV_MISSING",
      httpStatus: 500,
      message: "Variável MONGO_URI não definida no ambiente da Vercel.",
      suggestion: "Configure MONGO_URI em Project Settings > Environment Variables e faça redeploy."
    };
  }

  if (
    normalizedMessage.includes("authentication failed") ||
    normalizedMessage.includes("bad auth") ||
    normalizedMessage.includes("auth failed")
  ) {
    return {
      code: "MONGO_AUTH_FAILED",
      httpStatus: 500,
      message: "Falha de autenticação no MongoDB.",
      suggestion: "Revise usuário/senha no MONGO_URI (escape URL para caracteres especiais) e teste no Atlas."
    };
  }

  if (
    normalizedMessage.includes("whitelist") ||
    normalizedMessage.includes("not whitelisted") ||
    normalizedMessage.includes("ip address")
  ) {
    return {
      code: "MONGO_IP_BLOCKED",
      httpStatus: 503,
      message: "Conexão bloqueada por regra de rede/IP no MongoDB Atlas.",
      suggestion: "No Atlas, libere Network Access para a origem da Vercel (temporariamente 0.0.0.0/0 para teste)."
    };
  }

  if (
    normalizedMessage.includes("querysrv") ||
    normalizedMessage.includes("enotfound") ||
    normalizedMessage.includes("srv")
  ) {
    return {
      code: "MONGO_DNS_ERROR",
      httpStatus: 503,
      message: "Falha de resolução DNS do cluster MongoDB.",
      suggestion: "Confirme o host do cluster no MONGO_URI e a disponibilidade do cluster Atlas."
    };
  }

  if (
    normalizedMessage.includes("server selection") ||
    normalizedMessage.includes("etimedout") ||
    normalizedMessage.includes("econnrefused")
  ) {
    return {
      code: "MONGO_UNREACHABLE",
      httpStatus: 503,
      message: "MongoDB indisponível ou inacessível no momento.",
      suggestion: "Verifique status do cluster, Network Access e credenciais do MONGO_URI."
    };
  }

  return {
    code: "MONGO_UNKNOWN",
    httpStatus: 500,
    message: "Falha desconhecida ao conectar no MongoDB.",
    suggestion: "Verifique logs da função na Vercel para o stack completo."
  };
}

function decorateMongoError(error) {
  const diagnosis = classifyMongoError(error);
  error.diagnosis = diagnosis;
  return error;
}

export default async function connectMongo() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw decorateMongoError(new Error("MONGO_URI não definida."));
  }

  const cache = globalCache.__mongooseCache;

  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGO_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 8000),
      connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 8000),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 12000)
    }).catch((error) => {
      cache.promise = null;
      throw decorateMongoError(error);
    });
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (error) {
    cache.conn = null;
    throw error;
  }
}
