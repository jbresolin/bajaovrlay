/**
 * The clock block at the left of the lower strip and the message ticker (BAJAOVRLAY-23):
 * a card with the race time at 44 px and the flag pill beside it, the design's
 * `.lower-strip__clock`. Two graphics draw it, so its markup, its writer and its styles
 * (clockBlockStyles.ts) live here; the race clock's own card stays in race-clock.
 *
 * The time is the kit's raceClockReading text and the flag the kit's flagOnAir, so the
 * block shows exactly what the race clock's card shows for the same reading at the same
 * moment. Nothing here rebuilds elements: a frame or an update writes only what changed.
 * The flag pill changes in place, with no crossfade: on a bar a flag change is read as a
 * state, as every number that changes on air is (motion.md).
 */
import { html, type TemplateResult } from 'lit';

import { dressElementAsFlag } from './flagOnAir.js';
import { type RaceClockReading, writeRaceClockTimeTextAt } from './raceClockReading.js';
import { writeTextIfChanged } from './textInPlace.js';

/** The elements of the block that change after the first render. */
export type ClockBlockParts = {
  block: HTMLElement;
  time: HTMLElement;
  flagPill: HTMLElement;
  flagWord: HTMLElement;
};

/** The block's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderClockBlockTemplate(): TemplateResult {
  return html`<div class="clock-block" data-testid="clock-block">
    <span class="clock-block-time" data-testid="clock-block-time"></span>
    <span class="clock-block-flag" data-testid="clock-block-flag"
      ><span class="clock-block-flag-word" data-testid="clock-block-flag-word"></span
    ></span>
  </div>`;
}

/** Finds the block's parts in the rendered template; a missing one is a bug in the template. */
export function findClockBlockParts(renderRoot: ParentNode): ClockBlockParts {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`clock block part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    block: findPart('clock-block'),
    time: findPart('clock-block-time'),
    flagPill: findPart('clock-block-flag'),
    flagWord: findPart('clock-block-flag-word'),
  };
}

/**
 * Writes the block as the reading is at `nowWallClockMs`: the time, and the flag. Called
 * on every frame while on air, so the time is written only when its text changed. Pass the
 * server-aligned "now" (`readServerAlignedTimeMs`), as the race clock does.
 */
export function writeClockBlockAt(
  parts: ClockBlockParts,
  reading: RaceClockReading,
  nowWallClockMs: number,
): void {
  writeTextIfChanged(parts.time, writeRaceClockTimeTextAt(reading, nowWallClockMs));
  dressElementAsFlag(parts.flagPill, parts.flagWord, reading.state);
}
