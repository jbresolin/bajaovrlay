/**
 * The plain sponsor roll's one pass (BAJAOVRLAY-64), written once for the two that must
 * agree on it: the graphic, which turns its sponsors at these moments, and the server,
 * which takes the roll off air when the pass ends (its auto-out). Each level's hold lives
 * here too, so the other sponsor rounds fall back on the same numbers (the kit's
 * sponsorRound.ts) and the kit's sponsorHoldsOfTheTheme.test.ts keeps Ardósia's tokens equal
 * to them.
 *
 * Deliberate: the plain roll reads this table, never the theme's hold tokens. The server
 * cannot read the page's CSS, and an auto-out worked out from other numbers than the
 * graphic's would cut the last sponsor short or leave the card hanging.
 *
 * It imports only sponsorLevels.ts, which imports nothing: the graphics bundle it
 * (`@bajaovrlay/shared/sponsorRollPass`), and every dependency there is a frame-drop risk.
 */
import { findPlaceOfSponsorLevelInRound, type SponsorLevel } from './sponsorLevels.js';

/**
 * How long one sponsor (or one page of a level) stays on air, in ms: Ardósia's values, the
 * higher the level the longer; Bronze has no token of its own and takes the general 5 s.
 */
export const sponsorHoldMsOfEachLevel: Record<SponsorLevel, number> = {
  diamante: 8000,
  ouro: 5000,
  prata: 3000,
  bronze: 5000,
  apoio: 3000,
  realizacao: 5000,
};

/**
 * How long the plain roll takes to come in before the first sponsor's hold starts: its
 * playAction, Ardósia's --motion-in (the package's manifest test holds it to this).
 */
export const plainSponsorRollEntranceMs = 400;

/** A sponsor as the pass reads it: its level and its logo, which may be missing. */
export type SponsorOfThePass = { level: SponsorLevel; logoUrl?: string | undefined };

/** One sponsor shown in the pass: how long it holds, and when that hold ends (from the play). */
export type SponsorShownInThePass<Sponsor> = {
  sponsor: Sponsor;
  holdMs: number;
  holdEndsAtMs: number;
};

/** The pass: the sponsors shown, in order, and its whole length from the play, in ms. */
export type PlainSponsorRollPass<Sponsor> = {
  sponsorsShown: Array<SponsorShownInThePass<Sponsor>>;
  passMs: number;
};

/** Whether a sponsor has a logo to draw: a sponsor without one is skipped, never an empty card. */
function hasALogo(sponsor: SponsorOfThePass): boolean {
  return sponsor.logoUrl !== undefined && sponsor.logoUrl.trim() !== '';
}

/**
 * Plans one pass: the sponsors with a logo in the round's order (sponsors of one level in
 * the order they came), the first held after the entrance, each next one when the one
 * before ends. With none to show, the pass is the entrance alone.
 */
export function planPlainSponsorRollPass<Sponsor extends SponsorOfThePass>(
  sponsors: Sponsor[],
): PlainSponsorRollPass<Sponsor> {
  const sponsorsWithALogo = sponsors.filter(hasALogo);
  // Array.prototype.sort is stable, so sponsors of one level keep the list's order.
  const sponsorsInRoundOrder = [...sponsorsWithALogo].sort(
    (first, second) =>
      findPlaceOfSponsorLevelInRound(first.level) - findPlaceOfSponsorLevelInRound(second.level),
  );
  const sponsorsShown: Array<SponsorShownInThePass<Sponsor>> = [];
  let lastHoldEndsAtMs = plainSponsorRollEntranceMs;
  for (const sponsor of sponsorsInRoundOrder) {
    const holdMs = sponsorHoldMsOfEachLevel[sponsor.level];
    lastHoldEndsAtMs += holdMs;
    sponsorsShown.push({ sponsor, holdMs, holdEndsAtMs: lastHoldEndsAtMs });
  }
  return { sponsorsShown, passMs: lastHoldEndsAtMs };
}

/** How long one pass of these sponsors lasts from the play, in ms: what the server waits. */
export function measurePlainSponsorRollPassMs(sponsors: SponsorOfThePass[]): number {
  return planPlainSponsorRollPass(sponsors).passMs;
}
