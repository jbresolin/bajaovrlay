/**
 * The GSAP timelines of the bars along the bottom, the lower strip and the message ticker
 * (motion.md, "The lower strip" and "Message ticker"):
 * - in: each piece rises `--motion-in-offset` and fades up over `--motion-in` on
 *   `--ease-out`, `--motion-row-stagger` after the one before (the clock block, the cars or
 *   the label and the message, the page cell);
 * - out: every piece lifts and fades together over `--motion-out` on `--ease-in` (a
 *   staggered exit reads as a glitch);
 * - a page turning in place: the old pieces lift away while the new ones rise into the
 *   same places, each over `--motion-strip-page`, `--motion-page-stagger` apart, both at
 *   once, so the bar never goes empty and never scrolls.
 * Every number is read from the theme's tokens on the page when a timeline is built, so
 * motion follows the theme like colours do. On a page without the theme every token reads
 * as 0 and the ease as linear (the theme package's rule), so every timeline still ends.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built here, played with the kit's `playTimelineToTheEnd`. */
export type BarTimeline = ReturnType<typeof gsap.timeline>;

/** Puts pieces in their off-air look (invisible, below their place) without animating. */
export function placeBarPiecesOffAir(tokensSource: Element, pieces: readonly Element[]): void {
  if (pieces.length === 0) {
    return;
  }
  const motion = readMotionTokens(tokensSource);
  gsap.set(pieces, { opacity: 0, y: motion.inOffsetPx });
}

/** Puts pieces in their on-air look (visible, in their place) without animating. */
export function placeBarPiecesOnAir(pieces: readonly Element[]): void {
  if (pieces.length === 0) {
    return;
  }
  gsap.set(pieces, { opacity: 1, y: 0 });
}

/**
 * Builds the paused play-in: the pieces rise in, in the order given, a row stagger apart.
 * Each tween gets its own objects: GSAP keeps a tween's vars, so two must never share one.
 */
export function buildBarPlayInTimeline(
  tokensSource: Element,
  piecesInOrder: readonly Element[],
): BarTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  for (const [index, piece] of piecesInOrder.entries()) {
    const startSeconds = (index * motion.rowStaggerMs) / 1000;
    timeline.fromTo(
      piece,
      { opacity: 0, y: motion.inOffsetPx },
      {
        opacity: 1,
        y: 0,
        duration: motion.inMs / 1000,
        ease: gsapEaseOfToken(motion.easeOut),
      },
      startSeconds,
    );
  }
  return timeline;
}

/** Builds the paused stop-out: every piece lifts and fades away together. */
export function buildBarStopOutTimeline(
  tokensSource: Element,
  pieces: readonly Element[],
): BarTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  if (pieces.length > 0) {
    timeline.to(pieces, {
      opacity: 0,
      y: -motion.inOffsetPx,
      duration: motion.outMs / 1000,
      ease: gsapEaseOfToken(motion.easeIn),
    });
  }
  return timeline;
}

/**
 * Builds the paused page turn in place: the leaving pieces lift away and the arriving
 * pieces rise into the same places, both starting at once, each over `--motion-strip-page`
 * and `--motion-page-stagger` apart, left to right. The arriving pieces must already be
 * drawn (placed off air) where they will end.
 */
export function buildBarPageTurnTimeline(
  tokensSource: Element,
  leavingPieces: readonly Element[],
  arrivingPieces: readonly Element[],
): BarTimeline {
  const motion = readMotionTokens(tokensSource);
  const pageSeconds = motion.stripPageMs / 1000;
  const timeline = gsap.timeline({ paused: true });
  for (const [index, piece] of leavingPieces.entries()) {
    timeline.to(
      piece,
      {
        opacity: 0,
        y: -motion.inOffsetPx,
        duration: pageSeconds,
        ease: gsapEaseOfToken(motion.easeIn),
      },
      (index * motion.pageStaggerMs) / 1000,
    );
  }
  for (const [index, piece] of arrivingPieces.entries()) {
    timeline.fromTo(
      piece,
      { opacity: 0, y: motion.inOffsetPx },
      {
        opacity: 1,
        y: 0,
        duration: pageSeconds,
        ease: gsapEaseOfToken(motion.easeOut),
      },
      (index * motion.pageStaggerMs) / 1000,
    );
  }
  return timeline;
}
