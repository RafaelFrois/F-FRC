import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "replace_this_secret";

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const [key, ...rest] = entry.split("=");
      acc[key] = decodeURIComponent(rest.join("="));
      return acc;
    }, {});
}

export function signUserToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function setAuthCookie(res, token) {
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production";
  const cookie = [
    `token=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : null
  ]
    .filter(Boolean)
    .join("; ");

  res.setHeader("Set-Cookie", cookie);
}

export function getUserIdFromRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const token = cookies.token;
  if (!token) {
    const error = new Error("Não autenticado");
    error.statusCode = 401;
    throw error;
  }

  const payload = jwt.verify(token, JWT_SECRET);
  return payload.id;
}
