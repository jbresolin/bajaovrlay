/**
 * The standings' GSAP timelines, as motion.md describes them ("Standings, overall with
 * points per event" and "Standings in columns"):
 * - in: the head card, then `--motion-lead` later each column cascades from its top (its
 *   column head, then each row `--motion-row-stagger` after the one above). The table is
 *   one column; the columns board's columns all start together, so row n of every column
 *   enters at the same moment and the field fills in one sweep;
 * - out: everything together over `--motion-out`;
 * - a page turn: the pieces leaving lift out together, then the next page's pieces cascade
 *   in from their tops, the head card staying.
 * Every piece gets its own tween at its own start, rather than one staggered tween, so a
 * test can read when each piece starts. Every duration, offset and ease is a theme token
 * read when the timeline is built; on a page without the theme they read as 0 and linear,
 * so every timeline still ends. The manifest's "actionDurations" promise `--motion-in` +
 * `--motion-lead` + 20 × `--motion-row-stagger` for play (the last of 20 rows starts after
 * the column head and 20 staggers) and `--motion-out` for stop; standingsManifest.test.ts
 * keeps the JSON and the token file in agreement.
 */
import { gsapEaseOfToken, type MotionTokens, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type StandingsTimeline = ReturnType<typeof gsap.timeline>;

/**
 * Builds the paused play-in: the head card rises its offset and fades up at 0, then from
 * `--motion-lead` every column cascades in, all columns together. `cascades` lists each
 * column's pieces top to bottom (its column head first).
 */
export function buildPlayInTimeline(
  tokensSource: Element,
  head: HTMLElement,
  cascades: HTMLElement[][],
): StandingsTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  addPieceRisingIn(timeline, motion, head, 0);
  addColumnsCascadingIn(timeline, motion, cascades, motion.leadMs / 1000);
  return timeline;
}

/**
 * Builds the paused lift-out: every piece given lifts its offset and fades away together
 * over `--motion-out`. The stop-out (every piece) and a page turn's first half (the rows,
 * and the columns board's column heads) are both this.
 */
export function buildLiftOutTogetherTimeline(
  tokensSource: Element,
  pieces: HTMLElement[],
): StandingsTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  if (pieces.length > 0) {
    timeline.to(
      pieces,
      {
        opacity: 0,
        y: -motion.inOffsetPx,
        duration: motion.outMs / 1000,
        ease: gsapEaseOfToken(motion.easeIn),
      },
      0,
    );
  }
  return timeline;
}

/**
 * Builds the paused second half of a page turn: every column cascades in from its top,
 * all columns together, starting at once (the head card is already on air).
 */
export function buildPageInTimeline(
  tokensSource: Element,
  cascades: HTMLElement[][],
): StandingsTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  addColumnsCascadingIn(timeline, motion, cascades, 0);
  return timeline;
}

/** Puts pieces in their off-air look (invisible, below their place) without animating. */
export function placePiecesOffAir(tokensSource: Element, pieces: HTMLElement[]): void {
  if (pieces.length === 0) {
    return;
  }
  const motion = readMotionTokens(tokensSource);
  gsap.set(pieces, { opacity: 0, y: motion.inOffsetPx });
}

/** Puts pieces in their on-air look at once (visible, in place), as an update on air asks. */
export function showPiecesAtOnce(pieces: HTMLElement[]): void {
  if (pieces.length === 0) {
    return;
  }
  gsap.set(pieces, { opacity: 1, y: 0 });
}

/**
 * Adds every column's pieces: piece n of each column starts at `firstAtSeconds` plus n row
 * staggers, so the columns run side by side.
 */
function addColumnsCascadingIn(
  timeline: StandingsTimeline,
  motion: MotionTokens,
  cascades: HTMLElement[][],
  firstAtSeconds: number,
): void {
  const rowStaggerSeconds = motion.rowStaggerMs / 1000;
  for (const piecesTopToBottom of cascades) {
    piecesTopToBottom.forEach((piece, slotIndex) => {
      const startSeconds = firstAtSeconds + slotIndex * rowStaggerSeconds;
      addPieceRisingIn(timeline, motion, piece, startSeconds);
    });
  }
}

/** Adds one piece rising its offset and fading up over `--motion-in`, from `startSeconds`. */
function addPieceRisingIn(
  timeline: StandingsTimeline,
  motion: MotionTokens,
  piece: HTMLElement,
  startSeconds: number,
): void {
  timeline.fromTo(
    piece,
    { opacity: 0, y: motion.inOffsetPx },
    { opacity: 1, y: 0, duration: motion.inMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
    startSeconds,
  );
}
