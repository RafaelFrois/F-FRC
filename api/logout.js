import { clearAuthCookie } from "../lib/server/auth.js";
import { methodNotAllowed, setCors, handleOptions } from "../lib/server/http.js";

// O token é um JWT sem estado: encerrar a sessão é remover o cookie HttpOnly,
// que o JavaScript do navegador não consegue apagar sozinho.
export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["POST"])) return;

  clearAuthCookie(res);
  return res.status(200).json({ message: "Sessão encerrada" });
}
