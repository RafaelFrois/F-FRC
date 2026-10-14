import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startTestDatabase, stopTestDatabase } from "./helpers/db.js";
import { cookieFrom, invoke } from "./helpers/http.js";
import { fakeApis, installFakeExternalApis } from "./helpers/fakeExternalApis.js";

let alliance, register, login, me, User, TeamMarketSnapshot;
let cookie;

const DAY = 24 * 60 * 60 * 1000;
const isoDate = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

// Eventos de teste: os abertos começam daqui a 30 dias (mesma week); um já começou.
const OPEN_DATE = isoDate(30);
const OPEN_EVENTS = ["2026tsta", "2026tstb", "2026tstc", "2026tstd", "2026tste"];
const CLOSED_EVENT = "2026tstz";
const TEAMS = [101, 102, 103, 104];
const PRICES = { 101: 40, 102: 30, 103: 20, 104: 10 };

function teamFixture(number) {
  return { key: `frc${number}`, team_number: number, nickname: `Equipe Teste ${number}` };
}

function pick(numbers, captain) {
  // O cliente tenta impor preço 0: o servidor deve ignorar.
  return numbers.map((teamNumber) => ({ teamNumber, isCaptain: teamNumber === captain, marketValue: 0, price: 0 }));
}

async function save(eventKey, numbers, captain, extra = {}) {
  return invoke(alliance, { method: "POST", cookie, body: { eventKey, alliance: pick(numbers, captain), ...extra } });
}

before(async () => {
  await startTestDatabase();
  process.env.FRC_SEASON_YEAR = String(new Date().getFullYear());
  installFakeExternalApis();
  ({ default: alliance } = await import("../api/me/alliance.js"));
  ({ default: register } = await import("../api/register.js"));
  ({ default: login } = await import("../api/login.js"));
  ({ default: me } = await import("../api/me.js"));
  ({ default: User } = await import("../src/DataBase/models/Users.js"));
  ({ default: TeamMarketSnapshot } = await import("../src/DataBase/models/teamMarketSnapshot.js"));
  const { default: connectMongo } = await import("../config/mongo.js");
  await connectMongo();
  await Promise.all([User.init(), TeamMarketSnapshot.init()]);
});

after(stopTestDatabase);

beforeEach(async () => {
  await User.deleteMany({});
  await TeamMarketSnapshot.deleteMany({});
  fakeApis.failTba = false;
  fakeApis.events = [
    ...OPEN_EVENTS.map((key) => ({ key, name: `Regional ${key}`, event_type: 0, start_date: OPEN_DATE, end_date: OPEN_DATE })),
    { key: CLOSED_EVENT, name: "Regional fechado", event_type: 0, start_date: isoDate(-1), end_date: isoDate(1) }
  ];
  fakeApis.teamsByEvent = Object.fromEntries(
    [...OPEN_EVENTS, CLOSED_EVENT].map((key) => [key, TEAMS.map(teamFixture)])
  );

  // Snapshots de preço da week dos eventos abertos
  const { getWeekNumberFromDate } = await weekHelper();
  const season = new Date(OPEN_DATE).getFullYear();
  const week = getWeekNumberFromDate(OPEN_DATE, season);
  await TeamMarketSnapshot.insertMany(TEAMS.map((teamNumber) => ({
    teamNumber, season, week, price: PRICES[teamNumber], weightedEPA: 1, trendFactor: 1, regionalFactor: 1
  })));

  const body = { email: "jogador@example.com", username: "jogador", password: "senha-teste-1", confirmPassword: "senha-teste-1" };
  await invoke(register, { method: "POST", body });
  cookie = cookieFrom(await invoke(login, { method: "POST", body: { email: body.email, password: body.password } }));
});

// Mesma fórmula de week usada pela API (api/me/alliance.js)
async function weekHelper() {
  return {
    getWeekNumberFromDate(dateInput, seasonYear) {
      const eventDate = new Date(dateInput);
      const week1Start = new Date(seasonYear, 2, 1);
      if (eventDate < new Date(seasonYear, 2, 8)) return 1;
      return Math.max(1, Math.floor((eventDate - week1Start) / DAY / 7) + 1);
    }
  };
}

describe("salvar aliança", () => {
  test("usa o preço do servidor, ignorando o preço enviado pelo navegador", async () => {
    const res = await save("2026tsta", [101, 102, 103], 101);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));

    const stored = await User.findOne({ username: "jogador" }).lean();
    assert.equal(stored.patrimonio, 300 - (40 + 30 + 20));
    const saved = stored.regionals[0];
    assert.deepEqual(saved.alliance.map((member) => member.marketValue), [40, 30, 20]);
    assert.deepEqual(saved.alliance.map((member) => member.nickname), ["Equipe Teste 101", "Equipe Teste 102", "Equipe Teste 103"]);
    assert.equal(saved.alliance.filter((member) => member.isCaptain).length, 1);
  });

  test("escalação salva continua disponível em /api/me", async () => {
    await save("2026tsta", [101, 102, 103], 102);
    const res = await invoke(me, { cookie });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.regionals.length, 1);
    assert.equal(res.body.user.regionals[0].eventKey, "2026tsta");
  });

  for (const [name, numbers, captainMode, message] of [
    ["dois times", [101, 102], 101, /exatamente 3/],
    ["quatro times", [101, 102, 103, 104], 101, /exatamente 3/],
    ["time repetido", [101, 101, 102], 102, /repetidos/],
    ["sem capitão", [101, 102, 103], null, /capitão/],
    ["dois capitães", [101, 102, 103], "two", /apenas um capitão/],
    ["time fora do regional", [101, 102, 9999], 101, /fora deste regional/]
  ]) {
    test(`rejeita ${name}`, async () => {
      let body = pick(numbers, captainMode);
      if (captainMode === "two") body = body.map((entry, index) => ({ ...entry, isCaptain: index < 2 }));
      const res = await invoke(alliance, { method: "POST", cookie, body: { eventKey: "2026tsta", alliance: body } });
      assert.equal(res.statusCode, 400, JSON.stringify(res.body));
      assert.match(res.body.message, message);
      assert.equal((await User.findOne({ username: "jogador" }).lean()).regionals.length, 0);
    });
  }

  test("regional já iniciado recusa a escalação, mesmo por requisição direta", async () => {
    const res = await save(CLOSED_EVENT, [101, 102, 103], 101);
    assert.equal(res.statusCode, 403);
  });

  test("regional desconhecido retorna 404 e TBA fora do ar retorna 503", async () => {
    assert.equal((await save("2026nope", [101, 102, 103], 101)).statusCode, 404);
    fakeApis.failTba = true;
    assert.equal((await save("2026tsta", [101, 102, 103], 101)).statusCode, 503);
  });

  test("patrimônio insuficiente é recusado", async () => {
    // Com zero alianças o código atual força o patrimônio de volta para 300 (ensureUserSeasonState),
    // então o cenário precisa de uma aliança já salva.
    await save("2026tsta", [104, 103, 102], 104);
    await User.updateOne({ username: "jogador" }, { $set: { patrimonio: 50 } });
    const res = await save("2026tstb", [101, 102, 103], 101);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Patrimônio insuficiente/);
  });

  test("no máximo 4 regionais por week", async () => {
    await User.updateOne({ username: "jogador" }, { $set: { patrimonio: 10000 } });
    for (const key of OPEN_EVENTS.slice(0, 4)) {
      assert.equal((await save(key, [102, 103, 104], 104)).statusCode, 200, key);
    }
    const fifth = await save(OPEN_EVENTS[4], [102, 103, 104], 104);
    assert.equal(fifth.statusCode, 409);
    assert.match(fifth.body.message, /4 regionais/);
  });

  test("salvar de novo no mesmo regional sem edição retorna 409", async () => {
    await save("2026tsta", [101, 102, 103], 101);
    assert.equal((await save("2026tsta", [102, 103, 104], 102)).statusCode, 409);
  });

  test("editar devolve o custo anterior e cobra o novo", async () => {
    await save("2026tsta", [101, 102, 103], 101);
    const res = await save("2026tsta", [102, 103, 104], 104, { isEditing: true });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const stored = await User.findOne({ username: "jogador" }).lean();
    assert.equal(stored.patrimonio, 300 - (30 + 20 + 10));
    assert.equal(stored.regionals.length, 1);
  });

  test("excluir devolve o custo; excluir regional sem aliança retorna 404", async () => {
    await save("2026tsta", [101, 102, 103], 101);
    const del = await invoke(alliance, { method: "DELETE", cookie, query: { eventKey: "2026tsta" } });
    assert.equal(del.statusCode, 200);
    const stored = await User.findOne({ username: "jogador" }).lean();
    assert.equal(stored.patrimonio, 300);
    assert.equal(stored.regionals.length, 0);

    const again = await invoke(alliance, { method: "DELETE", cookie, query: { eventKey: "2026tsta" } });
    assert.equal(again.statusCode, 404);
  });

  test("sem sessão retorna 401", async () => {
    const res = await invoke(alliance, { method: "POST", body: { eventKey: "2026tsta", alliance: pick([101, 102, 103], 101) } });
    assert.equal(res.statusCode, 401);
  });
});
