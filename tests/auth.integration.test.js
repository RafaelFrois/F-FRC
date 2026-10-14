import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { startTestDatabase, stopTestDatabase } from "./helpers/db.js";
import { cookieFrom, invoke } from "./helpers/http.js";

let register, login, logout, me, ranking, User;

const VALID = {
  email: "Rafa@Example.com",
  username: "rafa",
  password: "senha-segura-1",
  confirmPassword: "senha-segura-1",
  frcTeamNumber: 1156,
  rookieYear: 2003
};

before(async () => {
  await startTestDatabase();
  ({ default: register } = await import("../api/register.js"));
  ({ default: login } = await import("../api/login.js"));
  ({ default: logout } = await import("../api/logout.js"));
  ({ default: me } = await import("../api/me.js"));
  ({ default: ranking } = await import("../api/ranking.js"));
  ({ default: User } = await import("../src/DataBase/models/Users.js"));
  const { default: connectMongo } = await import("../config/mongo.js");
  await connectMongo();
  await User.init(); // garante os índices únicos antes dos testes de duplicidade
});

after(stopTestDatabase);

beforeEach(async () => {
  await User.deleteMany({});
});

async function registerAndLogin(overrides = {}) {
  const data = { ...VALID, ...overrides };
  const created = await invoke(register, { method: "POST", body: data });
  assert.equal(created.statusCode, 201, JSON.stringify(created.body));
  const logged = await invoke(login, { method: "POST", body: { email: data.email, password: data.password } });
  assert.equal(logged.statusCode, 200, JSON.stringify(logged.body));
  return cookieFrom(logged);
}

describe("cadastro", () => {
  test("cadastro válido persiste o usuário com e-mail normalizado e senha em hash", async () => {
    const res = await invoke(register, { method: "POST", body: VALID });
    assert.equal(res.statusCode, 201);

    const stored = await User.findOne({ username: "rafa" }).lean();
    assert.equal(stored.email, "rafa@example.com");
    assert.equal(stored.frcTeamNumber, 1156);
    assert.equal(stored.rookieYear, 2003);
    assert.notEqual(stored.password, VALID.password);
    assert.ok(await bcrypt.compare(VALID.password, stored.password));
    assert.equal(stored.confirmPassword, undefined);
  });

  test("campos opcionais podem ser omitidos", async () => {
    const res = await invoke(register, {
      method: "POST",
      body: { email: "a@b.com", username: "semequipe", password: "12345678", confirmPassword: "12345678" }
    });
    assert.equal(res.statusCode, 201);
    const stored = await User.findOne({ username: "semequipe" }).lean();
    assert.equal(stored.frcTeamNumber, undefined);
    assert.equal(stored.rookieYear, undefined);
  });

  for (const [name, body, field] of [
    ["e-mail inválido", { ...VALID, email: "notanemail" }, "email"],
    ["senha curta", { ...VALID, password: "1234567", confirmPassword: "1234567" }, "password"],
    ["confirmação diferente", { ...VALID, confirmPassword: "outra-senha-1" }, "confirmPassword"],
    ["corpo vazio", {}, "email"],
    ["sem senha", { email: "x@y.com", username: "xyz" }, "password"],
    ["nome curto", { ...VALID, username: "ab" }, "username"],
    ["número de equipe inválido", { ...VALID, frcTeamNumber: "abc" }, "frcTeamNumber"],
    ["rookie year fora do intervalo", { ...VALID, rookieYear: 1800 }, "rookieYear"],
    ["operador NoSQL no e-mail", { ...VALID, email: { $gt: "" } }, "email"]
  ]) {
    test(`rejeita ${name} com 400`, async () => {
      const res = await invoke(register, { method: "POST", body });
      assert.equal(res.statusCode, 400, JSON.stringify(res.body));
      assert.equal(res.body.field, field);
      assert.ok(res.body.message);
      assert.equal(await User.countDocuments(), 0);
    });
  }

  test("e-mail já cadastrado (inclusive com outra caixa) retorna 409", async () => {
    await invoke(register, { method: "POST", body: VALID });
    const res = await invoke(register, { method: "POST", body: { ...VALID, email: "RAFA@example.COM", username: "outro" } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.field, "email");
    assert.equal(await User.countDocuments(), 1);
  });

  test("e-mail antigo gravado com maiúsculas também bloqueia duplicidade", async () => {
    await User.collection.insertOne({ email: "Legacy@Example.com", username: "legacy", password: "x" });
    const res = await invoke(register, { method: "POST", body: { ...VALID, email: "legacy@example.com", username: "novo" } });
    assert.equal(res.statusCode, 409);
  });

  test("nome de usuário duplicado retorna 409 sem vazar detalhes do banco", async () => {
    await invoke(register, { method: "POST", body: VALID });
    const res = await invoke(register, { method: "POST", body: { ...VALID, email: "outro@example.com" } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.field, "username");
    assert.doesNotMatch(JSON.stringify(res.body), /E11000/);
  });

  test("JSON malformado retorna 400", async () => {
    const res = await invoke(register, { method: "POST", body: "{nao-json" });
    assert.equal(res.statusCode, 400);
  });
});

describe("login", () => {
  test("login válido cria cookie HttpOnly e não devolve a senha", async () => {
    await invoke(register, { method: "POST", body: VALID });
    const res = await invoke(login, { method: "POST", body: { email: "rafa@example.com", password: VALID.password } });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["set-cookie"], /^token=.+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800/);
    assert.equal(res.body.user.username, "rafa");
    assert.equal(res.body.user.password, undefined);
  });

  test("login ignora maiúsculas e espaços no e-mail", async () => {
    await invoke(register, { method: "POST", body: VALID });
    const res = await invoke(login, { method: "POST", body: { email: "  RAFA@EXAMPLE.com ", password: VALID.password } });
    assert.equal(res.statusCode, 200);
  });

  test("conta antiga com e-mail em maiúsculas continua conseguindo entrar", async () => {
    const hash = await bcrypt.hash("senha-antiga-1", 10);
    await User.collection.insertOne({ email: "Old@Example.com", username: "old", password: hash, patrimonio: 300, regionals: [] });
    const res = await invoke(login, { method: "POST", body: { email: "old@example.com", password: "senha-antiga-1" } });
    assert.equal(res.statusCode, 200);
  });

  test("senha incorreta e usuário inexistente retornam a mesma mensagem 401", async () => {
    await invoke(register, { method: "POST", body: VALID });
    const wrong = await invoke(login, { method: "POST", body: { email: VALID.email, password: "errada-123" } });
    const missing = await invoke(login, { method: "POST", body: { email: "ninguem@example.com", password: "errada-123" } });
    assert.equal(wrong.statusCode, 401);
    assert.equal(missing.statusCode, 401);
    assert.equal(wrong.body.message, missing.body.message);
    assert.equal(wrong.headers["set-cookie"], undefined);
  });

  test("campos vazios retornam 400", async () => {
    const res = await invoke(login, { method: "POST", body: { email: "", password: "" } });
    assert.equal(res.statusCode, 400);
  });

  test("operador NoSQL no e-mail não autentica ninguém", async () => {
    await invoke(register, { method: "POST", body: VALID });
    const res = await invoke(login, { method: "POST", body: { email: { $ne: null }, password: VALID.password } });
    assert.equal(res.statusCode, 400);
    assert.equal(res.headers["set-cookie"], undefined);
  });

  test("falha ao atualizar pontos não impede o login", async () => {
    await invoke(register, { method: "POST", body: VALID });
    // Documento antigo que não passa na validação do schema atual (username vazio)
    await User.collection.updateOne({ username: "rafa" }, { $set: { username: "" } });
    const res = await invoke(login, { method: "POST", body: { email: VALID.email, password: VALID.password } });
    assert.equal(res.statusCode, 200);
  });
});

describe("sessão e rotas protegidas", () => {
  test("sessão persiste: /api/me com o cookie devolve o usuário sem senha", async () => {
    const cookie = await registerAndLogin();
    const res = await invoke(me, { cookie });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.username, "rafa");
    assert.equal(res.body.user.password, undefined);
  });

  test("rota privada sem cookie retorna 401", async () => {
    for (const handler of [me, ranking]) {
      const res = await invoke(handler);
      assert.equal(res.statusCode, 401);
    }
  });

  test("token malformado, expirado ou com outro segredo retorna 401", async () => {
    const user = await User.create({ email: "t@t.com", username: "tester", password: "x" });
    const expired = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: -10 });
    const forged = jwt.sign({ id: String(user._id) }, "replace_this_secret");
    for (const token of ["abc", expired, forged]) {
      const res = await invoke(me, { cookie: `token=${token}` });
      assert.equal(res.statusCode, 401, token);
    }
  });

  test("logout limpa o cookie", async () => {
    const res = await invoke(logout, { method: "POST" });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["set-cookie"], /^token=; .*Max-Age=0/);
  });

  test("logout seguido de novo login funciona", async () => {
    await registerAndLogin();
    await invoke(logout, { method: "POST" });
    const res = await invoke(login, { method: "POST", body: { email: VALID.email, password: VALID.password } });
    assert.equal(res.statusCode, 200);
  });
});

describe("edição de perfil", () => {
  test("altera apenas o próprio perfil e valida os campos", async () => {
    const cookie = await registerAndLogin();
    await invoke(register, { method: "POST", body: { ...VALID, email: "b@b.com", username: "outro" } });

    const ok = await invoke(me, { method: "PUT", cookie, body: { username: "rafa novo", frcTeamNumber: "254", rookieYear: "" } });
    assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.user.username, "rafa novo");
    assert.equal(ok.body.user.frcTeamNumber, 254);
    assert.equal(ok.body.user.rookieYear, undefined);

    const other = await User.findOne({ username: "outro" }).lean();
    assert.equal(other.frcTeamNumber, 1156);

    const dup = await invoke(me, { method: "PUT", cookie, body: { username: "outro" } });
    assert.equal(dup.statusCode, 409);

    const empty = await invoke(me, { method: "PUT", cookie, body: { username: "  " } });
    assert.equal(empty.statusCode, 400);
  });

  test("campos internos (patrimônio, senha) são ignorados", async () => {
    const cookie = await registerAndLogin();
    await invoke(me, { method: "PUT", cookie, body: { patrimonio: 999999, password: "hack", email: "x@x.com" } });
    const stored = await User.findOne({ username: "rafa" }).lean();
    assert.equal(stored.patrimonio, 300);
    assert.equal(stored.email, "rafa@example.com");
    assert.ok(await bcrypt.compare(VALID.password, stored.password));
  });
});
