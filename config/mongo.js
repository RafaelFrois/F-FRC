import mongoose from "mongoose";

const globalCache = globalThis;

if (!globalCache.__mongooseCache) {
  globalCache.__mongooseCache = { conn: null, promise: null };
}

// Host que o driver tentou resolver em "querySrv ENOTFOUND _mongodb._tcp.<host>".
function extractSrvHost(message) {
  const match = String(message || "").match(/_mongodb\._tcp\.([^\s]+)/i);
  return match ? match[1] : null;
}

export function classifyMongoError(error) {
  const rawMessage = String(error?.message || "");
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    error?.name === "MongoParseError" ||
    normalizedMessage.includes("unescaped") ||
    normalizedMessage.includes("invalid scheme") ||
    normalizedMessage.includes("cannot have port")
  ) {
    return {
      code: "MONGO_URI_INVALID",
      httpStatus: 500,
      message: "MONGO_URI mal formada no servidor.",
      suggestion: "Codifique caracteres especiais da senha (ex.: @ → %40, : → %3A, / → %2F, # → %23) e remova aspas ou espaços do valor."
    };
  }

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
    normalizedMessage.includes("eai_again")
  ) {
    const host = extractSrvHost(rawMessage);
    // Um "@" na senha sem codificar faz o driver tratar o resto da senha como host.
    if (host && !host.toLowerCase().endsWith(".mongodb.net")) {
      return {
        code: "MONGO_URI_INVALID",
        httpStatus: 500,
        message: "MONGO_URI mal formada no servidor.",
        suggestion: "O host lido não é um cluster do Atlas: a senha provavelmente tem '@' sem codificar (use %40)."
      };
    }
    return {
      code: "MONGO_DNS_ERROR",
      httpStatus: 503,
      message: "Falha de resolução DNS do cluster MongoDB.",
      suggestion: "Confirme o host do cluster no MONGO_URI (Atlas > Connect > Drivers) e se o cluster não foi excluído."
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

  const readyState = mongoose.connection.readyState;
  if (cache.conn && readyState === 1) {
    return cache.conn;
  }

  // Em instâncias serverless reaproveitadas, a conexão pode ter caído depois de
  // estabelecida. Com bufferCommands=false, reaproveitar a promise antiga faria a
  // próxima consulta falhar na hora; então descartamos e reconectamos.
  if (cache.promise && (readyState === 0 || readyState === 3)) {
    cache.promise = null;
    cache.conn = null;
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
