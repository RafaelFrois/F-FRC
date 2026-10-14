// Regras de escalação aplicadas no servidor. O navegador só informa quais
// equipes e qual capitão; preço, semana e janela são decididos aqui.

export const ALLIANCE_SIZE = 3;
export const MAX_REGIONALS_PER_WEEK = 4;
// Preço exibido em /api/regionals/teams quando a equipe ainda não tem snapshot.
export const DEFAULT_TEAM_PRICE = 5;

export class AllianceRuleError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AllianceRuleError";
    this.statusCode = statusCode;
  }
}

// Valida a estrutura da escalação enviada pelo cliente e devolve só os campos
// confiáveis (número da equipe e capitão). Preço e nome enviados são ignorados.
export function parseAllianceSelection(rawAlliance) {
  if (!Array.isArray(rawAlliance)) {
    throw new AllianceRuleError(`A aliança deve conter exatamente ${ALLIANCE_SIZE} times`);
  }

  const alliance = rawAlliance.map((entry) => {
    const teamNumber = Number(entry?.teamNumber);
    if (!Number.isInteger(teamNumber) || teamNumber <= 0) {
      throw new AllianceRuleError("Número de equipe inválido na aliança");
    }
    return { teamNumber, isCaptain: entry?.isCaptain === true };
  });

  if (alliance.length !== ALLIANCE_SIZE) {
    throw new AllianceRuleError(`A aliança deve conter exatamente ${ALLIANCE_SIZE} times`);
  }

  if (new Set(alliance.map((entry) => entry.teamNumber)).size !== alliance.length) {
    throw new AllianceRuleError("A aliança não pode conter times repetidos");
  }

  const captains = alliance.filter((entry) => entry.isCaptain).length;
  if (captains === 0) throw new AllianceRuleError("Selecione um capitão para a aliança");
  if (captains > 1) throw new AllianceRuleError("A aliança deve ter apenas um capitão");

  return alliance;
}

// Momento em que a escalação de um regional fecha: 00:00 do dia de início.
// A data da TBA ("AAAA-MM-DD") é interpretada em UTC, como o código já fazia;
// o fuso de referência ainda é uma decisão pendente.
export function getSelectionCloseTime(event) {
  if (!event?.start_date) return null;
  const close = new Date(event.start_date);
  return Number.isNaN(close.getTime()) ? null : close;
}

export function isSelectionClosed(event, now = new Date()) {
  const close = getSelectionCloseTime(event);
  return close ? now >= close : false;
}

export function countRegionalsInWeek(regionals, week, ignoreEventKey = null) {
  return (Array.isArray(regionals) ? regionals : []).filter((regional) => {
    const key = String(regional?.eventKey || "").trim().toLowerCase();
    return Number(regional?.week) === Number(week) && key !== ignoreEventKey;
  }).length;
}

export function priceFromSnapshot(snapshot) {
  const price = Number(snapshot?.price);
  return Number.isFinite(price) && price >= 0 ? price : DEFAULT_TEAM_PRICE;
}
