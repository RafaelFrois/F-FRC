// Validação e normalização das entradas de autenticação e perfil.
// Toda entrada vinda do cliente é convertida para tipos primitivos antes de
// chegar ao MongoDB (evita injeção de operadores como {"$ne": null}).

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // limite efetivo do bcrypt
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const FIRST_FRC_YEAR = 1992;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
    this.field = field;
  }
}

function asTrimmedString(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function normalizeEmail(value) {
  return asTrimmedString(value).toLowerCase();
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email) throw new ValidationError("Informe o e-mail.", "email");
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError("E-mail inválido.", "email");
  }
  return email;
}

export function validateUsername(value) {
  const username = asTrimmedString(value).replace(/\s+/g, " ");
  if (!username) throw new ValidationError("Informe o nome de usuário.", "username");
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    throw new ValidationError(
      `O nome de usuário deve ter entre ${USERNAME_MIN_LENGTH} e ${USERNAME_MAX_LENGTH} caracteres.`,
      "username"
    );
  }
  return username;
}

export function validateNewPassword(password, confirmPassword) {
  if (typeof password !== "string" || !password) {
    throw new ValidationError("Informe a senha.", "password");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ValidationError(`A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`, "password");
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_LENGTH) {
    throw new ValidationError(`A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`, "password");
  }
  // A confirmação é opcional para clientes antigos, mas, quando enviada, precisa conferir.
  if (confirmPassword !== undefined && confirmPassword !== password) {
    throw new ValidationError("As senhas não coincidem.", "confirmPassword");
  }
  return password;
}

function optionalInteger(value, { field, label, min, max }) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`${label} inválido.`, field);
  }
  return parsed;
}

export function validateFrcTeamNumber(value) {
  return optionalInteger(value, { field: "frcTeamNumber", label: "Número da equipe", min: 1, max: 99999 });
}

export function validateRookieYear(value, now = new Date()) {
  return optionalInteger(value, {
    field: "rookieYear",
    label: "Ano rookie",
    min: FIRST_FRC_YEAR,
    max: now.getFullYear() + 1
  });
}

export function validateRegistration(body = {}) {
  return {
    email: validateEmail(body.email),
    username: validateUsername(body.username),
    password: validateNewPassword(body.password, body.confirmPassword),
    frcTeamNumber: validateFrcTeamNumber(body.frcTeamNumber),
    rookieYear: validateRookieYear(body.rookieYear)
  };
}

export function validateLogin(body = {}) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    throw new ValidationError("Email e senha são obrigatórios", !email ? "email" : "password");
  }
  return { email, password };
}

// Campos do perfil que o próprio usuário pode alterar. `null`/"" limpam os opcionais.
export function validateProfileUpdate(body = {}) {
  const update = {};
  const unset = {};

  if (body.username !== undefined) update.username = validateUsername(body.username);

  for (const [field, validate] of [["frcTeamNumber", validateFrcTeamNumber], ["rookieYear", validateRookieYear]]) {
    if (body[field] === undefined) continue;
    const value = validate(body[field]);
    if (value === undefined) unset[field] = 1;
    else update[field] = value;
  }

  if (body.profilePhoto !== undefined) {
    if (typeof body.profilePhoto !== "string") {
      throw new ValidationError("Foto de perfil inválida.", "profilePhoto");
    }
    update.profilePhoto = body.profilePhoto.trim();
  }

  return { update, unset };
}

// Busca por e-mail sem diferenciar maiúsculas, compatível com contas antigas
// gravadas antes da normalização. Collation de força 2 ignora caixa.
export const EMAIL_COLLATION = { locale: "en", strength: 2 };

export function isDuplicateKeyError(error) {
  return error?.code === 11000 || /E11000/.test(String(error?.message || ""));
}

export function duplicateKeyField(error) {
  const keys = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (keys.length) return keys[0];
  const match = String(error?.message || "").match(/index: (\w+?)_\d/);
  return match?.[1] || null;
}
