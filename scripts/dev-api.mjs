// Servidor local que executa as funções serverless de /api (formato Vercel)
// para desenvolvimento: `npm run dev:api` + `npm run dev` (Vite faz proxy de /api para cá).
import "dotenv/config";
import http from "node:http";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(rootDir, "api");
const port = Number(process.env.API_PORT || 3000);

function collectRoutes(dir, prefix = "") {
  const routes = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      routes.push(...collectRoutes(fullPath, `${prefix}/${entry}`));
      continue;
    }
    if (!entry.endsWith(".js")) continue;
    const name = entry.replace(/\.js$/, "");
    const segments = `${prefix}/${name === "index" ? "" : name}`.split("/").filter(Boolean);
    const params = [];
    const pattern = segments.map((segment) => {
      const match = segment.match(/^\[(.+)\]$/);
      if (!match) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      params.push(match[1]);
      return "([^/]+)";
    }).join("/");
    routes.push({ file: fullPath, regex: new RegExp(`^/api/${pattern}/?$`), params, dynamic: params.length > 0 });
  }
  // Rotas estáticas têm prioridade sobre as dinâmicas, como na Vercel.
  return routes.sort((a, b) => Number(a.dynamic) - Number(b.dynamic));
}

const routes = collectRoutes(apiDir);

function decorateResponse(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
    return res;
  };
  res.send = (body) => {
    if (body !== null && typeof body === "object" && !Buffer.isBuffer(body)) return res.json(body);
    res.end(body);
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  decorateResponse(res);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = routes.find((candidate) => candidate.regex.test(url.pathname));
  if (!route) {
    return res.status(404).json({ message: "Rota não encontrada" });
  }

  const match = url.pathname.match(route.regex);
  const query = Object.fromEntries(url.searchParams.entries());
  route.params.forEach((name, index) => { query[name] = decodeURIComponent(match[index + 1]); });
  req.query = query;

  try {
    const module = await import(pathToFileURL(route.file).href);
    await module.default(req, res);
  } catch (error) {
    console.error(`[dev-api] ${req.method} ${url.pathname}:`, error);
    if (!res.headersSent) res.status(500).json({ message: "Erro interno do servidor" });
  }
});

server.listen(port, () => {
  console.log(`[dev-api] API local em http://localhost:${port} (${routes.length} rotas)`);
});
