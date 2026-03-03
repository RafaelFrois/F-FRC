export const STARTING_PATRIMONY = 400;

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
  user.totalPointsSeason = 0;
  user.regionals = [];
  user.patrimonioSeason = Number(seasonYear);
  return true;
}