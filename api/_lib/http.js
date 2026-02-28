const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export function setCors(req, res) {
  const requestOrigin = req.headers.origin;
  const fallbackOrigin = ALLOWED_ORIGINS[0] || "*";
  const allowOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : fallbackOrigin;

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }

  return false;
}

export function methodNotAllowed(req, res, allowedMethods) {
  if (!allowedMethods.includes(req.method)) {
    res.setHeader("Allow", allowedMethods.join(", "));
    res.status(405).json({ message: `Método ${req.method} não permitido` });
    return true;
  }

  return false;
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  return JSON.parse(raw);
}
