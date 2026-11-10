/**
 * The turns of one pass of the plain sponsor roll: one timer per sponsor after the first,
 * each due when the hold before it ends, counted from the play, on shared's plan
 * (sponsorRollPass.ts), the very plan the server's auto-out is worked out from. The last
 * sponsor's hold ends the pass, so it has no turn: the server's clear comes then. Moved out
 * of sponsor-roll-plain.ts at gate 2 of PR #59, so the lifecycle reads on its own.
 */
import type { SponsorRollPlainPass } from './sponsorRollPlainModel.js';

/** The pending turns of the pass on air; started at play, called off at stop and dispose. */
export class TurnsOfThePass {
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  /**
   * Calls off any turn still pending, then starts one timer per turn of this pass;
   * `turnToTheSponsorAt` is called with the index of the sponsor whose hold begins.
   */
  start(pass: SponsorRollPlainPass, turnToTheSponsorAt: (sponsorIndex: number) => void): void {
    this.callOff();
    const sponsorsShown = pass.sponsorsShown;
    for (let nextIndex = 1; nextIndex < sponsorsShown.length; nextIndex += 1) {
      const holdBefore = sponsorsShown[nextIndex - 1];
      if (holdBefore === undefined) {
        continue;
      }
      const timer = setTimeout(() => {
        turnToTheSponsorAt(nextIndex);
      }, holdBefore.holdEndsAtMs);
      this.timers.push(timer);
    }
  }

  /** Calls off every turn still pending. */
  callOff(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];
  }
}
