// Executa uma função serverless de /api com req/res em memória (formato Vercel).
import { Readable } from "node:stream";

export async function invoke(handler, { method = "GET", body, query = {}, cookie, headers = {} } = {}) {
  const payload = body === undefined ? [] : [typeof body === "string" ? body : JSON.stringify(body)];
  const req = Readable.from(payload.map((chunk) => Buffer.from(chunk)));
  req.method = method;
  req.query = query;
  req.headers = {
    "content-type": "application/json",
    ...(cookie ? { cookie } : {}),
    ...headers
  };

  const response = { statusCode: 200, headers: {}, body: undefined };
  const res = {
    headersSent: false,
    setHeader(name, value) { response.headers[name.toLowerCase()] = value; },
    getHeader(name) { return response.headers[name.toLowerCase()]; },
    status(code) { response.statusCode = code; return res; },
    json(data) { response.body = data; res.headersSent = true; return res; },
    end() { res.headersSent = true; return res; }
  };

  await handler(req, res);
  return response;
}

export function cookieFrom(response) {
  const raw = response.headers["set-cookie"];
  return raw ? String(raw).split(";")[0] : undefined;
}
