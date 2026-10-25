/**
 * The six sponsor levels, as the design names them (BAJAOVRLAY-46), in the order every
 * sponsor round goes through them: Diamante first, Realização (SAE Brasil, the organiser)
 * last. A sponsor's `tier` is one of these, and SponsorTierSchema is built from this list.
 *
 * It imports nothing on purpose: the graphics bundle it (`@bajaovrlay/shared/sponsorLevels`),
 * and every dependency there is a frame-drop risk in OBS. The server sorts an entity list
 * of sponsors by it and the graphics kit's sponsorRound pages by it, so the two agree.
 */
export const sponsorLevelsInRoundOrder = [
  'diamante',
  'ouro',
  'prata',
  'bronze',
  'apoio',
  'realizacao',
] as const;

/** One of the six levels. */
export type SponsorLevel = (typeof sponsorLevelsInRoundOrder)[number];

/** Where a level comes in a round: 0 for Diamante, 5 for Realização. */
export function findPlaceOfSponsorLevelInRound(level: SponsorLevel): number {
  return sponsorLevelsInRoundOrder.indexOf(level);
}
