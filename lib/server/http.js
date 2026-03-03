const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export function setCors(req, res) {
  const requestOrigin = req.headers.origin;
  let allowOrigin = ALLOWED_ORIGINS[0] || "*";

  if (requestOrigin) {
    if (ALLOWED_ORIGINS.length === 0) {
      allowOrigin = requestOrigin;
    } else if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    }
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
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

export async function parseMultipartFormData(req, fieldName) {
  const contentType = String(req.headers["content-type"] || "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  if (!boundaryMatch) {
    const error = new Error("Content-Type multipart/form-data inválido");
    error.statusCode = 400;
    throw error;
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBuffer = Buffer.concat(chunks);
  if (!rawBuffer.length) {
    const error = new Error("Nenhum arquivo enviado");
    error.statusCode = 400;
    throw error;
  }

  const body = rawBuffer.toString("latin1");
  const parts = body.split(`--${boundary}`);

  for (const part of parts) {
    if (!part || part === "--" || part === "--\r\n") continue;

    const headerEndIndex = part.indexOf("\r\n\r\n");
    if (headerEndIndex < 0) continue;

    const rawHeaders = part.slice(0, headerEndIndex);
    if (!rawHeaders.includes(`name=\"${fieldName}\"`)) continue;

    const filenameMatch = rawHeaders.match(/filename=\"([^\"]*)\"/i);
    const typeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);
    const contentStart = headerEndIndex + 4;
    const trailingCrlfLength = 2;
    const contentEnd = part.length - trailingCrlfLength;

    const contentLatin1 = part.slice(contentStart, Math.max(contentStart, contentEnd));
    const fileBuffer = Buffer.from(contentLatin1, "latin1");

    return {
      filename: filenameMatch?.[1] || "upload.bin",
      contentType: (typeMatch?.[1] || "application/octet-stream").trim(),
      buffer: fileBuffer
    };
  }

  const error = new Error(`Campo ${fieldName} não encontrado no form-data`);
  error.statusCode = 400;
  throw error;
}