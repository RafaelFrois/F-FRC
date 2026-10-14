import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AllianceRuleError,
  DEFAULT_TEAM_PRICE,
  countRegionalsInWeek,
  isSelectionClosed,
  parseAllianceSelection,
  priceFromSnapshot
} from "../lib/server/alliance.js";

test("parseAllianceSelection descarta preço e nome enviados pelo cliente", () => {
  const parsed = parseAllianceSelection([
    { teamNumber: "1", isCaptain: true, marketValue: 0, nickname: "x" },
    { teamNumber: 2, isCaptain: false },
    { teamNumber: 3 }
  ]);
  assert.deepEqual(parsed, [
    { teamNumber: 1, isCaptain: true },
    { teamNumber: 2, isCaptain: false },
    { teamNumber: 3, isCaptain: false }
  ]);
});

test("isCaptain só vale com true literal", () => {
  assert.throws(() => parseAllianceSelection([
    { teamNumber: 1, isCaptain: "true" }, { teamNumber: 2 }, { teamNumber: 3 }
  ]), /capitão/);
});

test("números de equipe inválidos são recusados", () => {
  for (const bad of [0, -1, 1.5, "abc", null]) {
    assert.throws(() => parseAllianceSelection([{ teamNumber: bad, isCaptain: true }, { teamNumber: 2 }, { teamNumber: 3 }]), AllianceRuleError);
  }
  assert.throws(() => parseAllianceSelection("x"), AllianceRuleError);
});

test("janela fecha às 00:00 UTC do dia de início", () => {
  const event = { start_date: "2026-03-05" };
  assert.equal(isSelectionClosed(event, new Date("2026-03-04T23:59:59Z")), false);
  assert.equal(isSelectionClosed(event, new Date("2026-03-05T00:00:00Z")), true);
  assert.equal(isSelectionClosed({}, new Date()), false);
});

test("countRegionalsInWeek ignora o regional em edição", () => {
  const regionals = [
    { eventKey: "a", week: 2 }, { eventKey: "b", week: 2 }, { eventKey: "c", week: 3 }
  ];
  assert.equal(countRegionalsInWeek(regionals, 2), 2);
  assert.equal(countRegionalsInWeek(regionals, 2, "a"), 1);
});

test("priceFromSnapshot usa o padrão quando não há snapshot válido", () => {
  assert.equal(priceFromSnapshot({ price: 12.5 }), 12.5);
  assert.equal(priceFromSnapshot(null), DEFAULT_TEAM_PRICE);
  assert.equal(priceFromSnapshot({ price: -1 }), DEFAULT_TEAM_PRICE);
});
