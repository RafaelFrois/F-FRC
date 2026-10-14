export const STARTING_PATRIMONY = 300;

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateRegionalTotalWithCaptain(regional) {
  const alliance = Array.isArray(regional?.alliance) ? regional.alliance : [];
  return alliance.reduce((sum, member) => {
    const basePoints = asNumber(member?.points, 0);
    const multiplier = member?.isCaptain ? 1.5 : 1;
    return sum + basePoints * multiplier;
  }, 0);
}

function calculateCurrentWeekTotal(regionals) {
  return (Array.isArray(regionals) ? regionals : []).reduce((sum, regional) => {
    const storedTotal = asNumber(regional?.totalRegionalPoints, NaN);
    if (Number.isFinite(storedTotal)) {
      return sum + storedTotal;
    }

    return sum + calculateRegionalTotalWithCaptain(regional);
  }, 0);
}

function calculateRegionalTotal(regional) {
  const storedTotal = asNumber(regional?.totalRegionalPoints, NaN);
  if (Number.isFinite(storedTotal)) {
    return storedTotal;
  }

  return calculateRegionalTotalWithCaptain(regional);
}

export function calculateUserWeekPoints(user, weekNumber) {
  const regionals = Array.isArray(user?.regionals) ? user.regionals : [];
  const normalizedWeek = Number(weekNumber);
  const shouldFilterByWeek = Number.isInteger(normalizedWeek) && normalizedWeek >= 1;

  return regionals.reduce((sum, regional) => {
    if (shouldFilterByWeek && Number(regional?.week) !== normalizedWeek) {
      return sum;
    }

    return sum + calculateRegionalTotal(regional);
  }, 0);
}

function getCurrentWeekByDate(seasonYear, today = new Date()) {
  const week1Start = new Date(seasonYear, 2, 1);
  const week1AvailableFrom = new Date(week1Start.getTime() - 14 * 24 * 60 * 60 * 1000);

  if (today < week1AvailableFrom) {
    return 1;
  }

  const daysSinceWeek1Start = Math.floor((today - week1Start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(daysSinceWeek1Start / 7) + 1);
}

function allianceCost(regional) {
  return (Array.isArray(regional?.alliance) ? regional.alliance : []).reduce(
    (sum, member) => sum + Math.max(0, asNumber(member?.marketValue, 0)),
    0
  );
}

// Quando a week de um regional termina, o capital investido na aliança volta
// ao patrimônio. A aliança continua salva como histórico. A variação pela
// pontuação (base_rate × MarketMultiplier) ainda depende dos parâmetros do jogo.
export function settleFinishedRegionals(user, currentWeek, now = new Date()) {
  const regionals = Array.isArray(user?.regionals) ? user.regionals : [];
  let refunded = 0;
  let changed = false;

  for (const regional of regionals) {
    if (regional?.patrimonySettledAt) continue;
    if (!(asNumber(regional?.week, Infinity) < Number(currentWeek))) continue;

    refunded += allianceCost(regional);
    regional.patrimonySettledAt = now;
    changed = true;
  }

  if (changed) {
    user.patrimonio = asNumber(user?.patrimonio, 0) + refunded;
  }
  return changed;
}

export function ensureUserSeasonState(user, seasonYear) {
  const sameSeason = Number(user.patrimonioSeason) === Number(seasonYear);

  if (sameSeason) {
    const hasNoAlliances = !Array.isArray(user.regionals) || user.regionals.length === 0;
    if (hasNoAlliances && Number(user.patrimonio) !== STARTING_PATRIMONY) {
      user.patrimonio = STARTING_PATRIMONY;
      return true;
    }
    return false;
  }

  // Nova temporada: o estado recomeça, mas a temporada anterior fica arquivada.
  const previousRegionals = Array.isArray(user.regionals) ? user.regionals : [];
  if (previousRegionals.length > 0 || asNumber(user.totalPointsSeason, 0) !== 0) {
    if (!Array.isArray(user.seasonHistory)) user.seasonHistory = [];
    user.seasonHistory.push({
      season: asNumber(user.patrimonioSeason, Number(seasonYear) - 1),
      totalPointsSeason: asNumber(user.totalPointsSeason, 0),
      patrimonio: asNumber(user.patrimonio, 0),
      regionals: previousRegionals.map((regional) => (regional?.toObject ? regional.toObject() : regional)),
      archivedAt: new Date()
    });
  }

  user.patrimonio = STARTING_PATRIMONY;
  user.weekStateSeason = Number(seasonYear);
  user.weekStateNumber = 1;
  user.totalPointsCarryover = 0;
  user.totalPointsSeason = 0;
  user.regionals = [];
  user.patrimonioSeason = Number(seasonYear);
  return true;
}

// Mantém a week de referência do usuário e o total da temporada. As alianças de
// weeks anteriores ficam salvas (histórico); `totalPointsCarryover` guarda só os
// pontos de weeks cujas alianças foram apagadas pela versão antiga deste código.
export function ensureUserWeekState(user, seasonYear, currentWeek = null) {
  const resolvedWeek = Number.isInteger(Number(currentWeek)) && Number(currentWeek) >= 1
    ? Number(currentWeek)
    : getCurrentWeekByDate(seasonYear);

  const currentWeekStateSeason = asNumber(user?.weekStateSeason, Number(seasonYear));
  const regionals = Array.isArray(user?.regionals) ? user.regionals : [];

  let changed = false;

  if (currentWeekStateSeason !== Number(seasonYear)) {
    user.weekStateSeason = Number(seasonYear);
    user.totalPointsCarryover = 0;
    changed = true;
  }

  if (asNumber(user?.weekStateNumber, 0) !== resolvedWeek) {
    user.weekStateNumber = resolvedWeek;
    changed = true;
  }

  if (settleFinishedRegionals(user, resolvedWeek)) {
    changed = true;
  }

  const expectedSeasonTotal = asNumber(user?.totalPointsCarryover, 0) + calculateCurrentWeekTotal(regionals);
  if (asNumber(user?.totalPointsSeason, 0) !== expectedSeasonTotal) {
    user.totalPointsSeason = expectedSeasonTotal;
    changed = true;
  }

  return changed;
}
