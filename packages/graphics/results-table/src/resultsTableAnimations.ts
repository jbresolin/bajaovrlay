/**
 * The results table's GSAP timelines, the standings' overall table's motion (motion.md,
 * "Standings, overall with points per event"), copied rather than shared so the standings
 * stay untouched (BAJAOVRLAY-83):
 * - in: the head card, then `--motion-lead` later the table cascades from its top (its
 *   column head, then each row `--motion-row-stagger` after the one above);
 * - out: everything together over `--motion-out`;
 * - a page turn: the rows lift out together, then the next page's rows cascade in from
 *   the top, the head card and the column head staying.
 * Every piece gets its own tween at its own start, rather than one staggered tween, so a
 * test can read when each piece starts. Every duration, offset and ease is a theme token
 * read when the timeline is built; on a page without the theme they read as 0 and linear,
 * so every timeline still ends. The manifest's "actionDurations" promise `--motion-in` +
 * `--motion-lead` + 20 × `--motion-row-stagger` for play (the last of 20 rows starts after
 * the column head and 20 staggers) and `--motion-out` for stop; the manifest test
 * keeps the JSON and the token file in agreement (resultsTableManifest.test.ts here).
 */
import { gsapEaseOfToken, type MotionTokens, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type ResultsTableTimeline = ReturnType<typeof gsap.timeline>;

/**
 * Builds the paused play-in: the head card rises its offset and fades up at 0, then from
 * `--motion-lead` the table cascades in. `piecesTopToBottom` starts with its column head.
 */
export function buildPlayInTimeline(
  tokensSource: Element,
  head: HTMLElement,
  piecesTopToBottom: HTMLElement[],
): ResultsTableTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  addPieceRisingIn(timeline, motion, head, 0);
  addPiecesCascadingIn(timeline, motion, piecesTopToBottom, motion.leadMs / 1000);
  return timeline;
}

/**
 * Builds the paused lift-out: every piece given lifts its offset and fades away together
 * over `--motion-out`. The stop-out (every piece) and a page turn's first half (the rows)
 * are both this.
 */
export function buildLiftOutTogetherTimeline(
  tokensSource: Element,
  pieces: HTMLElement[],
): ResultsTableTimeline {
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
 * Builds the paused second half of a page turn: the rows cascade in from the top,
 * starting at once (the head card and the column head are already on air).
 */
export function buildPageInTimeline(
  tokensSource: Element,
  rowsTopToBottom: HTMLElement[],
): ResultsTableTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  addPiecesCascadingIn(timeline, motion, rowsTopToBottom, 0);
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

/** Adds the pieces top to bottom: piece n starts at `firstAtSeconds` plus n row staggers. */
function addPiecesCascadingIn(
  timeline: ResultsTableTimeline,
  motion: MotionTokens,
  piecesTopToBottom: HTMLElement[],
  firstAtSeconds: number,
): void {
  const rowStaggerSeconds = motion.rowStaggerMs / 1000;
  piecesTopToBottom.forEach((piece, slotIndex) => {
    const startSeconds = firstAtSeconds + slotIndex * rowStaggerSeconds;
    addPieceRisingIn(timeline, motion, piece, startSeconds);
  });
}

/** Adds one piece rising its offset and fading up over `--motion-in`, from `startSeconds`. */
function addPieceRisingIn(
  timeline: ResultsTableTimeline,
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
