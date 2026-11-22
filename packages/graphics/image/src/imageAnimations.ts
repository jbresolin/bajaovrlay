/**
 * The image graphic's GSAP timelines: a short fade in over `--motion-in` and out over
 * `--motion-out`, and nothing else; no rise, no pulse. With the entrance "none" image.ts
 * plays these same timelines with skipAnimation, which jumps them to their end: a cut. The
 * durations and eases come from the theme's motion tokens, read from the box's computed
 * style when a timeline is built; imageManifest.test.ts keeps the manifest's
 * "actionDurations" equal to them. On a page without the theme every token reads as 0 and
 * the ease as linear (the theme package's rule), so every timeline ends.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type ImageTimeline = ReturnType<typeof gsap.timeline>;

/** Builds the paused fade in: the box from invisible to fully visible. */
export function buildFadeInTimeline(box: HTMLElement): ImageTimeline {
  const motion = readMotionTokens(box);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    box,
    { opacity: 0 },
    { opacity: 1, duration: motion.inMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
  );
  return timeline;
}

/** Builds the paused fade out: the box to invisible. */
export function buildFadeOutTimeline(box: HTMLElement): ImageTimeline {
  const motion = readMotionTokens(box);
  const timeline = gsap.timeline({ paused: true });
  timeline.to(box, {
    opacity: 0,
    duration: motion.outMs / 1000,
    ease: gsapEaseOfToken(motion.easeIn),
  });
  return timeline;
}

/** Puts the box in its off-air look (invisible) without animating. */
export function placeBoxOffAir(box: HTMLElement): void {
  gsap.set(box, { opacity: 0 });
}
