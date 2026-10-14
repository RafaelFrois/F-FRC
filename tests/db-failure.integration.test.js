import { test } from "node:test";
import assert from "node:assert/strict";
import { invoke } from "./helpers/http.js";

test("banco indisponível: login responde 503 com mensagem segura", async () => {
  process.env.MONGO_URI = "mongodb://127.0.0.1:1/ffrc_unreachable";
  process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS = "500";
  process.env.JWT_SECRET = "test-secret";
  const { default: login } = await import("../api/login.js");

  const res = await invoke(login, { method: "POST", body: { email: "a@b.com", password: "12345678" } });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, "MONGO_UNREACHABLE");
  assert.doesNotMatch(JSON.stringify(res.body), /127\.0\.0\.1|mongodb:\/\//);
});
