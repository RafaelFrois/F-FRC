import jwt from "jsonwebtoken";

const TOKEN_COOKIE = "token";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEV_FALLBACK_SECRET = "ffrc-dev-only-secret";

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function authError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

// Sem JWT_SECRET em produção, qualquer pessoa poderia forjar tokens com um
// segredo conhecido. Por isso falhamos de forma explícita em vez de usar um padrão.
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (isProduction()) {
    throw authError("Configuração do servidor incompleta: JWT_SECRET não definida.", 500, "JWT_SECRET_MISSING");
  }

  if (!globalThis.__ffrcJwtWarned) {
    console.warn("⚠️ JWT_SECRET não definida; usando segredo de desenvolvimento. Configure-a no .env.");
    globalThis.__ffrcJwtWarned = true;
  }
  return DEV_FALLBACK_SECRET;
}

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const [key, ...rest] = entry.split("=");
      try {
        acc[key] = decodeURIComponent(rest.join("="));
      } catch {
        acc[key] = rest.join("=");
      }
      return acc;
    }, {});
}

export function signUserToken(userId) {
  return jwt.sign({ id: String(userId) }, getJwtSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

function buildCookie(value, maxAgeSeconds) {
  return [
    `${TOKEN_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    isProduction() ? "Secure" : null
  ]
    .filter(Boolean)
    .join("; ");
}

export function setAuthCookie(res, token) {
  res.setHeader("Set-Cookie", buildCookie(encodeURIComponent(token), TOKEN_TTL_SECONDS));
}

export function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", buildCookie("", 0));
}

export function getUserIdFromRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const token = cookies[TOKEN_COOKIE];
  if (!token) {
    throw authError("Não autenticado", 401);
  }

  const secret = getJwtSecret();
  try {
    const payload = jwt.verify(token, secret);
    if (!payload?.id) throw new Error("token sem id");
    return String(payload.id);
  } catch {
    // Token expirado, malformado ou assinado com outro segredo: sessão inválida.
    throw authError("Sessão expirada. Faça login novamente.", 401);
  }
}
