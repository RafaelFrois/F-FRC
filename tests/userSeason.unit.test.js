import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STARTING_PATRIMONY,
  ensureUserSeasonState,
  ensureUserWeekState,
  settleFinishedRegionals
} from "../lib/server/userSeason.js";

function alliance(prices, points = [0, 0, 0]) {
  return prices.map((marketValue, index) => ({ teamNumber: index + 1, isCaptain: index === 0, marketValue, points: points[index] }));
}

function userWith(regionals, extra = {}) {
  return {
    patrimonio: STARTING_PATRIMONY - regionals.reduce((sum, r) => sum + r.alliance.reduce((s, m) => s + m.marketValue, 0), 0),
    patrimonioSeason: 2026,
    weekStateSeason: 2026,
    weekStateNumber: 3,
    totalPointsCarryover: 0,
    totalPointsSeason: 0,
    regionals,
    ...extra
  };
}

test("virada de week mantém as alianças e devolve o custo das que terminaram", () => {
  const user = userWith([
    { eventKey: "a", week: 3, alliance: alliance([40, 30, 20]), totalRegionalPoints: 50 },
    { eventKey: "b", week: 3, alliance: alliance([10, 10, 10]), totalRegionalPoints: 7 }
  ]);
  assert.equal(user.patrimonio, 180);

  assert.equal(ensureUserWeekState(user, 2026, 4), true);
  assert.equal(user.regionals.length, 2);
  assert.equal(user.patrimonio, 300);
  assert.equal(user.weekStateNumber, 4);
  assert.equal(user.totalPointsSeason, 57);
  assert.ok(user.regionals.every((r) => r.patrimonySettledAt instanceof Date));
});

test("a devolução acontece uma vez só, mesmo com várias chamadas", () => {
  const user = userWith([{ eventKey: "a", week: 3, alliance: alliance([40, 30, 20]), totalRegionalPoints: 10 }]);
  ensureUserWeekState(user, 2026, 4);
  ensureUserWeekState(user, 2026, 4);
  ensureUserWeekState(user, 2026, 5);
  assert.equal(user.patrimonio, 300);
});

test("aliança da week atual não é devolvida", () => {
  const user = userWith([{ eventKey: "a", week: 4, alliance: alliance([40, 30, 20]) }], { weekStateNumber: 4 });
  assert.equal(settleFinishedRegionals(user, 4), false);
  assert.equal(user.patrimonio, 210);
});

test("pontos de weeks apagadas pela versão antiga continuam no total", () => {
  const user = userWith([{ eventKey: "c", week: 5, alliance: alliance([5, 5, 5]), totalRegionalPoints: 12 }], {
    totalPointsCarryover: 100,
    weekStateNumber: 5
  });
  ensureUserWeekState(user, 2026, 5);
  assert.equal(user.totalPointsSeason, 112);
});

test("virada de temporada arquiva a temporada anterior em vez de apagar", () => {
  const regionals = [{ eventKey: "2026a", week: 2, alliance: alliance([10, 10, 10]), totalRegionalPoints: 30 }];
  const user = userWith(regionals, { totalPointsSeason: 30 });
  assert.equal(ensureUserSeasonState(user, 2027), true);
  assert.equal(user.regionals.length, 0);
  assert.equal(user.patrimonio, STARTING_PATRIMONY);
  assert.equal(user.seasonHistory.length, 1);
  assert.equal(user.seasonHistory[0].season, 2026);
  assert.equal(user.seasonHistory[0].totalPointsSeason, 30);
  assert.equal(user.seasonHistory[0].regionals[0].eventKey, "2026a");
});
