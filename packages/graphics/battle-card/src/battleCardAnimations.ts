/**
 * The battle card's GSAP timelines (the design's motion.md, "Battle card"): in, the car
 * ahead's pill rises first, the gap card `--motion-lead` behind it and the car behind's
 * pill `--motion-lead` after that, each with its own `--motion-in` rise; out, the three
 * lift together in `--motion-out`. A change of the trend's word crossfades the incoming
 * trend layer in over the current one in `--motion-flag` (nothing moves: a state, not an
 * animation). Every duration, offset and ease comes from the theme's motion tokens,
 * read from the pieces' computed style when a timeline is built. The manifest's static
 * "actionDurations" promise a renderer `--motion-in` + 2 × `--motion-lead` and
 * `--motion-out`; battleCardManifest.test.ts keeps the two in agreement.
 *
 * On a page without the theme every token reads as 0 and the ease as linear (the theme
 * package's rule), so every timeline still ends.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** The three pieces, in the order they enter. */
export type BattleCardPieces = {
  carAheadPill: HTMLElement;
  gapCard: HTMLElement;
  carBehindPill: HTMLElement;
};

/** The two layers of the trend cell. */
export type TrendLayers = {
  trendLayer: HTMLElement;
  incomingTrendLayer: HTMLElement;
};

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type BattleCardTimeline = ReturnType<typeof gsap.timeline>;

/** The pieces in their order of entry, as one list. */
function listPiecesInOrder(pieces: BattleCardPieces): HTMLElement[] {
  return [pieces.carAheadPill, pieces.gapCard, pieces.carBehindPill];
}

/**
 * Builds the paused play-in timeline: each piece rises its offset and fades up, the car
 * ahead at 0, the gap card one lead later, the car behind one lead after that.
 */
export function buildPlayInTimeline(pieces: BattleCardPieces): BattleCardTimeline {
  const motion = readMotionTokens(pieces.carAheadPill);
  const timeline = gsap.timeline({ paused: true });
  listPiecesInOrder(pieces).forEach((piece, placeInOrder) => {
    const startSeconds = (placeInOrder * motion.leadMs) / 1000;
    timeline.fromTo(
      piece,
      { opacity: 0, y: motion.inOffsetPx },
      { opacity: 1, y: 0, duration: motion.inMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
      startSeconds,
    );
  });
  return timeline;
}

/** Builds the paused stop-out timeline: the three pieces lift their offset together. */
export function buildStopOutTimeline(pieces: BattleCardPieces): BattleCardTimeline {
  const motion = readMotionTokens(pieces.carAheadPill);
  const timeline = gsap.timeline({ paused: true });
  timeline.to(listPiecesInOrder(pieces), {
    opacity: 0,
    y: -motion.inOffsetPx,
    duration: motion.outMs / 1000,
    ease: gsapEaseOfToken(motion.easeIn),
  });
  return timeline;
}

/** Puts every piece in its off-air look (invisible, below its place) without animating. */
export function placePiecesOffAir(pieces: BattleCardPieces): void {
  const motion = readMotionTokens(pieces.carAheadPill);
  gsap.set(listPiecesInOrder(pieces), { opacity: 0, y: motion.inOffsetPx });
}

/**
 * Builds the paused trend crossfade: the incoming layer, already dressed in the new
 * trend, fades in while the current one fades out, both in `--motion-flag` on `--ease-out`.
 */
export function buildTrendCrossfadeTimeline(layers: TrendLayers): BattleCardTimeline {
  const motion = readMotionTokens(layers.trendLayer);
  const durationSeconds = motion.flagMs / 1000;
  const ease = gsapEaseOfToken(motion.easeOut);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    layers.incomingTrendLayer,
    { opacity: 0 },
    { opacity: 1, duration: durationSeconds, ease },
  );
  timeline.fromTo(
    layers.trendLayer,
    { opacity: 1 },
    { opacity: 0, duration: durationSeconds, ease },
    0,
  );
  return timeline;
}

/**
 * Puts the two layers back at rest once the current layer wears the new trend: the
 * current one visible, the incoming one invisible again.
 */
export function placeTrendLayersAtRest(layers: TrendLayers): void {
  gsap.set(layers.trendLayer, { opacity: 1 });
  gsap.set(layers.incomingTrendLayer, { opacity: 0 });
}
