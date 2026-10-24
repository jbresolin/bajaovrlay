/**
 * The team card's GSAP timelines (the design's motion.md, "Team card"): the whole card
 * rises in, its photo and logo with it, never after; out, the card lifts. The card is one
 * element whatever its cells, so the same motion runs on a card of any width. Every
 * duration, offset and ease comes from the theme's motion tokens (`--motion-*`, `--ease-*`
 * in packages/theme/ardosia/tokens.css), read from the card's computed style when a
 * timeline is built. The manifest's static "actionDurations" promise a renderer the same
 * `--motion-in` and `--motion-out`; teamCardManifest.test.ts keeps the two in agreement.
 *
 * On a page without the theme every token reads as 0 and the ease as linear (the theme
 * package's rule), so every timeline still ends.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** The one element the animations move: the card, with its media inside it. */
export type TeamCardAnimatedElements = {
  panel: HTMLElement;
};

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type TeamCardTimeline = ReturnType<typeof gsap.timeline>;

/** Builds the paused play-in timeline: the whole card rises its offset and fades up. */
export function buildPlayInTimeline(elements: TeamCardAnimatedElements): TeamCardTimeline {
  const motion = readMotionTokens(elements.panel);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    elements.panel,
    { opacity: 0, y: motion.inOffsetPx },
    { opacity: 1, y: 0, duration: motion.inMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
  );
  return timeline;
}

/** Builds the paused stop-out timeline: the card lifts its offset and fades away. */
export function buildStopOutTimeline(elements: TeamCardAnimatedElements): TeamCardTimeline {
  const motion = readMotionTokens(elements.panel);
  const timeline = gsap.timeline({ paused: true });
  timeline.to(elements.panel, {
    opacity: 0,
    y: -motion.inOffsetPx,
    duration: motion.outMs / 1000,
    ease: gsapEaseOfToken(motion.easeIn),
  });
  return timeline;
}

/** Puts the card in its off-air look (invisible, below its place) without animating. */
export function placePanelOffAir(elements: TeamCardAnimatedElements): void {
  const motion = readMotionTokens(elements.panel);
  gsap.set(elements.panel, { opacity: 0, y: motion.inOffsetPx });
}
