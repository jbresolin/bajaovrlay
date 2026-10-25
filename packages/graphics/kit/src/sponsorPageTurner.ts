/**
 * The page timer of a sponsor round on air (BAJAOVRLAY-46), for the sponsor roll (its full
 * screen and its corner card) and the intermission's sponsor line: the kit's pageTurner,
 * its hold read anew before every wait as the level hold of the page (or sponsor) on air
 * (sponsorRound.ts), so each page stays its own level's time. Stopping it cancels the
 * pending wait, as the turner always does.
 */
import { createPageTurner, type PageTurner } from './pageTurner.js';
import { readSponsorHoldMsOfLevel, type SponsorLevel } from './sponsorRound.js';

/** What a sponsor round's timer needs from its graphic. */
export type SponsorPageTurnerOptions = {
  /** The element the theme's hold tokens are read from (the graphic itself). */
  tokensSource: Element;
  /** The level of the page or sponsor on air now. */
  readLevelOnAir: () => SponsorLevel;
  /** Turns to the next page or sponsor; resolves once its animation has ended. */
  onTurn: () => Promise<void>;
  /** setTimeout and clearTimeout in a graphic; tests pass hand-driven stand-ins. */
  setTimer: (callback: () => void, delayMs: number) => number;
  clearTimer: (timerId: number) => void;
};

/** Creates a stopped timer for a sponsor round. */
export function createSponsorPageTurner(options: SponsorPageTurnerOptions): PageTurner {
  return createPageTurner({
    onTurn: options.onTurn,
    readHoldMs: () => readSponsorHoldMsOfLevel(options.tokensSource, options.readLevelOnAir()),
    setTimer: options.setTimer,
    clearTimer: options.clearTimer,
  });
}
