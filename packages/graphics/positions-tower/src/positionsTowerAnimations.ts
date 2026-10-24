/**
 * The positions tower's GSAP timelines: in (the head first, then the rows in cascade),
 * out (everything together), a page turning (the rows out together, the new rows in
 * cascade), an update (FLIP for the rows whose slot changed, a rise for the rows
 * entering the page, a lift for the rows leaving it, all together) and the cue hold.
 * Every duration, offset and ease comes from the theme's motion tokens (`--motion-*`,
 * `--ease-*`), read from the tower's computed style when a timeline is built. The
 * manifest's static "actionDurations" promise a renderer `--motion-in` plus
 * `--tower-rows-per-page` × `--motion-row-stagger` for play and `--motion-out` for stop;
 * positionsTowerManifest.test.ts keeps the JSON and the token file in agreement.
 *
 * `--motion-lead` (the tower starts 100 ms after the clock) is not used: the tower is
 * its own graphic on its own layer and cannot know when the clock was played; the
 * renderer plays the two as the operator takes them.
 *
 * On a page without the theme every token reads as 0 and the ease as linear (the theme
 * package's rule), so every timeline still ends; nothing on air ever waits on a token
 * that is not there.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type TowerTimeline = ReturnType<typeof gsap.timeline>;

/** One row that must slide from where it was drawn to where it is now (FLIP). */
export type RowSlotShift = {
  element: HTMLElement;
  /** How many pixels down the row was before the DOM change (negative: it was above). */
  shiftPx: number;
};

/** What an update timeline animates: slides, rises and lifts, all starting together. */
export type UpdateMotion = {
  slotShifts: RowSlotShift[];
  rowsEntering: HTMLElement[];
  rowsLeaving: HTMLElement[];
};

/**
 * Builds the paused play-in timeline: the head pill rises its offset and fades up, then
 * each row does the same, one row stagger after the one above it. The whole lasts
 * `--motion-in` plus one stagger per row.
 */
export function buildPlayInTimeline(
  tokensSource: Element,
  head: HTMLElement,
  rows: HTMLElement[],
): TowerTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    head,
    { opacity: 0, y: motion.inOffsetPx },
    { opacity: 1, y: 0, duration: motion.inMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
    0,
  );
  addRowsRisingInCascade(timeline, motion, rows, motion.rowStaggerMs / 1000);
  return timeline;
}

/** Builds the paused stop-out timeline: every pill lifts its offset and fades away together. */
export function buildStopOutTimeline(
  tokensSource: Element,
  head: HTMLElement,
  rows: HTMLElement[],
): TowerTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  addPillsLiftingOut(timeline, motion, [head, ...rows]);
  return timeline;
}

/** Builds the paused first half of a page turn: the rows on air leave together; the head stays. */
export function buildRowsOutTimeline(tokensSource: Element, rows: HTMLElement[]): TowerTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  addPillsLiftingOut(timeline, motion, rows);
  return timeline;
}

/** Builds the paused second half of a page turn: the new page's rows rise in cascade. */
export function buildRowsInTimeline(tokensSource: Element, rows: HTMLElement[]): TowerTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  addRowsRisingInCascade(timeline, motion, rows, 0);
  return timeline;
}

/**
 * Builds the paused update timeline: the rows whose slot changed slide from where they
 * were to where they are (FLIP, `--motion-swap`), the rows entering the page rise in and
 * the rows leaving it lift out, all starting together, as several cars changing in one
 * update must.
 */
export function buildUpdateTimeline(tokensSource: Element, change: UpdateMotion): TowerTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  for (const { element, shiftPx } of change.slotShifts) {
    timeline.fromTo(
      element,
      { y: shiftPx },
      { y: 0, duration: motion.swapMs / 1000, ease: gsapEaseOfToken(motion.easeInOut) },
      0,
    );
  }
  addRowsRisingInCascade(timeline, motion, change.rowsEntering, 0);
  addPillsLiftingOut(timeline, motion, change.rowsLeaving);
  return timeline;
}

/**
 * Builds the paused cue-hold timeline: nothing moves, and after `--motion-cue-hold` the
 * callback clears the ▲ / ▼ and the coloured cells of the update that showed them.
 */
export function buildCueHoldTimeline(tokensSource: Element, clearCues: () => void): TowerTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  timeline.call(clearCues, undefined, motion.cueHoldMs / 1000);
  return timeline;
}

/** Puts pills in their off-air look (invisible, below their place) without animating. */
export function placePillsOffAir(tokensSource: Element, pills: HTMLElement[]): void {
  if (pills.length === 0) {
    return;
  }
  const motion = readMotionTokens(tokensSource);
  gsap.set(pills, { opacity: 0, y: motion.inOffsetPx });
}

/** Puts pills in their on-air look at once (visible, in place), as skipAnimation asks. */
export function showPillsAtOnce(pills: HTMLElement[]): void {
  if (pills.length === 0) {
    return;
  }
  gsap.set(pills, { opacity: 1, y: 0 });
}

type MotionTokens = ReturnType<typeof readMotionTokens>;

/**
 * Adds the rows rising in: the first at `firstRowAtSeconds`, each next one a row stagger
 * later, each with its own `--motion-in` rise. An empty list adds nothing (GSAP would
 * otherwise warn about a tween with no target).
 */
function addRowsRisingInCascade(
  timeline: TowerTimeline,
  motion: MotionTokens,
  rows: HTMLElement[],
  firstRowAtSeconds: number,
): void {
  if (rows.length === 0) {
    return;
  }
  timeline.fromTo(
    rows,
    { opacity: 0, y: motion.inOffsetPx },
    {
      opacity: 1,
      y: 0,
      duration: motion.inMs / 1000,
      ease: gsapEaseOfToken(motion.easeOut),
      stagger: motion.rowStaggerMs / 1000,
    },
    firstRowAtSeconds,
  );
}

/** Adds the pills lifting out together over `--motion-out`; an empty list adds nothing. */
function addPillsLiftingOut(
  timeline: TowerTimeline,
  motion: MotionTokens,
  pills: HTMLElement[],
): void {
  if (pills.length === 0) {
    return;
  }
  timeline.to(
    pills,
    {
      opacity: 0,
      y: -motion.inOffsetPx,
      duration: motion.outMs / 1000,
      ease: gsapEaseOfToken(motion.easeIn),
    },
    0,
  );
}
