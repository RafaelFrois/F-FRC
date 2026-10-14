import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  normalizeEmail,
  validateLogin,
  validateProfileUpdate,
  validateRegistration,
  validateRookieYear
} from "../lib/server/validation.js";

test("normalizeEmail apara e converte para minúsculas, ignorando não-strings", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
  assert.equal(normalizeEmail({ $ne: null }), "");
  assert.equal(normalizeEmail(undefined), "");
});

test("validateRegistration aceita dados legítimos e converte números", () => {
  const data = validateRegistration({
    email: "A.B+fantasy@escola.org.br",
    username: "  Domus   Arcis ",
    password: "senhaçãõ123",
    confirmPassword: "senhaçãõ123",
    frcTeamNumber: "1156",
    rookieYear: 2003
  });
  assert.deepEqual(data, {
    email: "a.b+fantasy@escola.org.br",
    username: "Domus Arcis",
    password: "senhaçãõ123",
    frcTeamNumber: 1156,
    rookieYear: 2003
  });
});

test("senha de 72 bytes é aceita e de 73 rejeitada (limite do bcrypt)", () => {
  const base = { email: "a@b.co", username: "abc" };
  assert.doesNotThrow(() => validateRegistration({ ...base, password: "a".repeat(72) }));
  assert.throws(() => validateRegistration({ ...base, password: "a".repeat(73) }), ValidationError);
});

test("rookie year aceita de 1992 até o próximo ano", () => {
  const now = new Date("2026-10-14T00:00:00Z");
  assert.equal(validateRookieYear(1992, now), 1992);
  assert.equal(validateRookieYear(2027, now), 2027);
  assert.throws(() => validateRookieYear(1991, now), ValidationError);
  assert.throws(() => validateRookieYear(2028, now), ValidationError);
  assert.throws(() => validateRookieYear(2003.5, now), ValidationError);
});

test("validateLogin exige strings não vazias", () => {
  assert.throws(() => validateLogin({ email: { $ne: null }, password: "x" }), ValidationError);
  assert.throws(() => validateLogin({ email: "a@b.com", password: { $ne: null } }), ValidationError);
  assert.deepEqual(validateLogin({ email: " A@B.com", password: " p " }), { email: "a@b.com", password: " p " });
});

test("validateProfileUpdate só aceita campos editáveis e trata vazio como remoção", () => {
  const { update, unset } = validateProfileUpdate({ username: "novo nome", frcTeamNumber: "", rookieYear: "2010", patrimonio: 1e9 });
  assert.deepEqual(update, { username: "novo nome", rookieYear: 2010 });
  assert.deepEqual(unset, { frcTeamNumber: 1 });
});
