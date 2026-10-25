/**
 * The boards' own moves (BAJAOVRLAY-46; motion.md, "The catalogue"), beside the bars' moves
 * in barMotion.ts, which the boards reuse as they are (every piece lifting out together,
 * a page turning in place, pieces placed on or off air):
 * - the rise, each piece at its own start: a board brings its head first, its body
 *   `--motion-lead` later, its rows `--motion-row-stagger` apart; the board works out the
 *   starts from the tokens and hands them here;
 * - the crossfade of a state: the new fades in over the old in `--motion-flag`, nothing
 *   moves (a slot's state on the sessions board, the corner card's next sponsor).
 * Every number is read from the theme's tokens when a timeline is built; on a page without
 * the theme every token reads as 0, so every timeline still ends.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built here, played with the kit's `playTimelineToTheEnd`. */
export type BoardTimeline = ReturnType<typeof gsap.timeline>;

/** One piece of a board and the moment, in ms from the start of the play-in, it rises. */
export type PieceRisingAt = { piece: Element; startMs: number };

/**
 * Builds the paused play-in: each piece rises `--motion-in-offset` and fades up over
 * `--motion-in` on `--ease-out`, at its own start. Each tween gets its own objects: GSAP
 * keeps a tween's vars, so two must never share one.
 */
export function buildPiecesRiseInTimeline(
  tokensSource: Element,
  piecesRisingAt: readonly PieceRisingAt[],
): BoardTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  for (const { piece, startMs } of piecesRisingAt) {
    timeline.fromTo(
      piece,
      { opacity: 0, y: motion.inOffsetPx },
      {
        opacity: 1,
        y: 0,
        duration: motion.inMs / 1000,
        ease: gsapEaseOfToken(motion.easeOut),
      },
      startMs / 1000,
    );
  }
  return timeline;
}

/**
 * Builds the paused crossfade: the leaving pieces fade out and the arriving ones fade in
 * over them, both at once over `--motion-flag` on `--ease-out`; nothing moves. The
 * arriving pieces must already be drawn where they end, at opacity 0.
 */
export function buildCrossfadeTimeline(
  tokensSource: Element,
  leavingPieces: readonly Element[],
  arrivingPieces: readonly Element[],
): BoardTimeline {
  const motion = readMotionTokens(tokensSource);
  const crossfadeSeconds = motion.flagMs / 1000;
  const ease = gsapEaseOfToken(motion.easeOut);
  const timeline = gsap.timeline({ paused: true });
  if (leavingPieces.length > 0) {
    timeline.to(leavingPieces, { opacity: 0, duration: crossfadeSeconds, ease }, 0);
  }
  if (arrivingPieces.length > 0) {
    timeline.fromTo(
      arrivingPieces,
      { opacity: 0 },
      { opacity: 1, duration: crossfadeSeconds, ease },
      0,
    );
  }
  return timeline;
}
