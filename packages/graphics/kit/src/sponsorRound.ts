/**
 * Every sponsor round on air, written once (BAJAOVRLAY-46): the sponsor roll on the full
 * screen, its corner card and the intermission's sponsor line go through the levels in
 * shared's round order (Diamante … Realização last; the server sorts the list by the same),
 * head each level with its pt-BR heading, and hold each page or sponsor by its level's
 * token: `--motion-sponsor-hold-<level>`, Bronze (which has none) `--motion-sponsor-hold`.
 * The hold is read anew before every wait, like every page hold, so a token change is
 * followed; a missing token falls back to the general hold, then to Ardósia's value for
 * the level, never to 0 (a page flipping every frame). Ardósia's values are shared's table
 * (sponsorRollPass.ts, BAJAOVRLAY-64), which the plain roll and the server read too;
 * sponsorHoldsOfTheTheme.test.ts keeps the tokens equal to it.
 */
import { type SponsorLevel, sponsorLevelsInRoundOrder } from '@bajaovrlay/shared/sponsorLevels';
import { sponsorHoldMsOfEachLevel } from '@bajaovrlay/shared/sponsorRollPass';

import { type PageHoldTokenKey, readHoldMsOrFallback } from './pageHold.js';
import { ptBRSponsorLevelHeadings } from './ptBRSponsorLevelHeadings.js';

/** The six levels in the order every round goes through them (shared's list itself). */
export const sponsorLevelsInTheRound = sponsorLevelsInRoundOrder;

/** One of the six levels, as a sponsor of an entity list carries it. */
export type { SponsorLevel };

/** The general sponsor hold when its token is missing: Ardósia's 5 s, Bronze's in shared's table. */
export const sponsorHoldMsWhenTokenMissing = sponsorHoldMsOfEachLevel.bronze;

/**
 * Each level's hold token. With the token and the general hold both missing, the level
 * falls back on its value in shared's table. Bronze reads the general hold, as motion.md says.
 */
const holdTokenKeyOfEachLevel: Record<SponsorLevel, PageHoldTokenKey> = {
  diamante: 'sponsorHoldDiamanteMs',
  ouro: 'sponsorHoldOuroMs',
  prata: 'sponsorHoldPrataMs',
  bronze: 'sponsorHoldMs',
  apoio: 'sponsorHoldApoioMs',
  realizacao: 'sponsorHoldRealizacaoMs',
};

/** The pt-BR heading of a level on air: "PATROCÍNIO DIAMANTE", "APOIO", "REALIZAÇÃO". */
export function headingOfSponsorLevel(level: SponsorLevel): string {
  return ptBRSponsorLevelHeadings[level];
}

/**
 * How long a page (or a sponsor, in the corner) of this level stays on air, in ms: the
 * level's token on `element`'s computed style; missing, the general `--motion-sponsor-hold`;
 * that missing too, Ardósia's value for the level.
 */
export function readSponsorHoldMsOfLevel(element: Element, level: SponsorLevel): number {
  const tokenKey = holdTokenKeyOfEachLevel[level];
  const ardosiaMs = sponsorHoldMsOfEachLevel[level];
  const generalHoldMs = readHoldMsOrFallback(element, 'sponsorHoldMs', 0);
  const fallbackMs = generalHoldMs > 0 ? generalHoldMs : ardosiaMs;
  return readHoldMsOrFallback(element, tokenKey, fallbackMs);
}
