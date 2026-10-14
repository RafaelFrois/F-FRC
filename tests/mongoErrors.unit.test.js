import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyMongoError } from "../config/mongo.js";

const parseError = (message) => Object.assign(new Error(message), { name: "MongoParseError" });

test("senha com '@' sem codificar é identificada como URI mal formada", () => {
  assert.equal(classifyMongoError(new Error("querySrv ENOTFOUND _mongodb._tcp.ss")).code, "MONGO_URI_INVALID");
});

test("erros de parsing da URI viram MONGO_URI_INVALID", () => {
  assert.equal(classifyMongoError(parseError("Password contains unescaped characters")).code, "MONGO_URI_INVALID");
  assert.equal(classifyMongoError(parseError('Invalid scheme, expected connection string to start with "mongodb://"')).code, "MONGO_URI_INVALID");
});

test("cluster do Atlas que não resolve continua como erro de DNS", () => {
  const error = new Error("querySrv ENOTFOUND _mongodb._tcp.cluster0.abcde.mongodb.net");
  assert.equal(classifyMongoError(error).code, "MONGO_DNS_ERROR");
});

test("mensagens que só contêm 'srv' não são mais tratadas como DNS", () => {
  assert.notEqual(classifyMongoError(new Error("some srv-related server error")).code, "MONGO_DNS_ERROR");
});
