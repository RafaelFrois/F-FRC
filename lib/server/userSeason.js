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

  user.patrimonio = STARTING_PATRIMONY;
  user.weekStateSeason = Number(seasonYear);
  user.weekStateNumber = 1;
  user.totalPointsCarryover = 0;
  user.totalPointsSeason = 0;
  user.regionals = [];
  user.patrimonioSeason = Number(seasonYear);
  return true;
}

export function ensureUserWeekState(user, seasonYear, currentWeek = null) {
  const resolvedWeek = Number.isInteger(Number(currentWeek)) && Number(currentWeek) >= 1
    ? Number(currentWeek)
    : getCurrentWeekByDate(seasonYear);

  const currentWeekStateSeason = asNumber(user?.weekStateSeason, Number(seasonYear));
  const currentWeekStateNumber = Math.max(1, asNumber(user?.weekStateNumber, 1));
  const regionals = Array.isArray(user?.regionals) ? user.regionals : [];
  const carryover = asNumber(user?.totalPointsCarryover, 0);

  let changed = false;

  if (currentWeekStateSeason !== Number(seasonYear)) {
    user.weekStateSeason = Number(seasonYear);
    user.weekStateNumber = resolvedWeek;
    user.totalPointsCarryover = 0;
    user.totalPointsSeason = calculateCurrentWeekTotal(regionals);
    changed = true;
    return changed;
  }

  if (resolvedWeek > currentWeekStateNumber) {
    const finishedWeekTotal = calculateCurrentWeekTotal(regionals);
    user.totalPointsCarryover = carryover + finishedWeekTotal;
    user.totalPointsSeason = user.totalPointsCarryover;
    user.regionals = [];
    user.patrimonio = STARTING_PATRIMONY;
    user.weekStateNumber = resolvedWeek;
    changed = true;
    return changed;
  }

  if (resolvedWeek < currentWeekStateNumber) {
    user.weekStateNumber = resolvedWeek;
    changed = true;
  }

  const currentWeekTotal = calculateCurrentWeekTotal(regionals);
  const expectedSeasonTotal = carryover + currentWeekTotal;
  if (asNumber(user?.totalPointsSeason, 0) !== expectedSeasonTotal) {
    user.totalPointsSeason = expectedSeasonTotal;
    changed = true;
  }

  return changed;
}
