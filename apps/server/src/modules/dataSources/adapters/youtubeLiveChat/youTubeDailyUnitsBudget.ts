// BAJAOVRLAY_YOUTUBE_DAILY_UNITS: how many of the key's 10 000 daily units the server lets
// itself spend before it stops reading the chat. Read at boot (a typo stops it) and by the
// adapter, through the same parse, so both agree.

/** The budget when the variable is unset or empty: 9 000, a tenth kept back for the rest. */
export const defaultYouTubeDailyUnitsBudget = 9_000;

/** Google's daily quota of a new project: a budget above it could never be spent. */
const youTubeDailyQuotaUnits = 10_000;

/** The parsed budget, or that the text is not a whole number from 1 to 10 000. */
export type YouTubeDailyUnitsBudgetParsing =
  { isValid: true; dailyUnitsBudget: number } | { isValid: false };

/**
 * Reads BAJAOVRLAY_YOUTUBE_DAILY_UNITS: unset or empty is the default (9 000); a whole
 * number from 1 to 10 000 is the budget; anything else is not valid.
 */
export function parseYouTubeDailyUnitsBudget(
  text: string | undefined,
): YouTubeDailyUnitsBudgetParsing {
  const trimmedText = (text ?? '').trim();
  if (trimmedText === '') {
    return { isValid: true, dailyUnitsBudget: defaultYouTubeDailyUnitsBudget };
  }
  const isWholeNumber = /^\d+$/.test(trimmedText);
  const budget = Number(trimmedText);
  if (!isWholeNumber || budget < 1 || budget > youTubeDailyQuotaUnits) {
    return { isValid: false };
  }
  return { isValid: true, dailyUnitsBudget: budget };
}
