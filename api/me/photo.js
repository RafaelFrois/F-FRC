import connectMongo from "../../config/mongo.js";
import User from "../../src/DataBase/models/Users.js";
import { getUserIdFromRequest } from "../../lib/server/auth.js";
import {
  methodNotAllowed,
  parseJsonBody,
  parseMultipartFormData,
  setCors,
  handleOptions
} from "../../lib/server/http.js";

const MAX_UPLOAD_BYTES = Number(process.env.PROFILE_PHOTO_MAX_BYTES || 2 * 1024 * 1024);

function sanitizeMimeType(input) {
  const value = String(input || "").toLowerCase().trim();
  if (value === "image/jpeg" || value === "image/jpg") return "image/jpeg";
  if (value === "image/png") return "image/png";
  if (value === "image/webp") return "image/webp";
  if (value === "image/gif") return "image/gif";
  return null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["POST"])) return;

  try {
    await connectMongo();
    const userId = getUserIdFromRequest(req);
    const contentType = String(req.headers["content-type"] || "").toLowerCase();

    let profilePhoto = null;

    if (contentType.includes("multipart/form-data")) {
      const file = await parseMultipartFormData(req, "profilePhoto");

      if (!file?.buffer?.length) {
        return res.status(400).json({ message: "Arquivo vazio" });
      }

      if (file.buffer.length > MAX_UPLOAD_BYTES) {
        return res.status(413).json({
          message: `Arquivo muito grande. Limite: ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB`
        });
      }

      const mimeType = sanitizeMimeType(file.contentType);
      if (!mimeType) {
        return res.status(400).json({ message: "Formato de imagem inválido. Use JPG, PNG, WEBP ou GIF." });
      }

      profilePhoto = `data:${mimeType};base64,${file.buffer.toString("base64")}`;
    } else {
      const body = await parseJsonBody(req);
      const photoFromBody = String(body?.profilePhoto || "").trim();
      if (!photoFromBody) {
        return res.status(400).json({ message: "profilePhoto é obrigatório" });
      }
      profilePhoto = photoFromBody;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { profilePhoto },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.status(200).json({
      message: "Foto de perfil atualizada com sucesso",
      url: profilePhoto,
      user
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: "JSON inválido no corpo da requisição" });
    }
    return res.status(500).json({ message: "Erro ao atualizar foto de perfil", error: error.message });
  }
}