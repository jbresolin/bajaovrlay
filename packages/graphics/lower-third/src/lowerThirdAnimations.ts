/**
 * The lower third's GSAP timelines (the design's motion.md, "Lower third: the name pill
 * first, the role pill 100 ms behind it ... Out together"). In: the name pill rises
 * `--motion-in-offset` and fades up over `--motion-in` on `--ease-out`, and the role pill
 * does the same `--motion-lead` later. Out: both pills lift and fade together over
 * `--motion-out` on `--ease-in`. Every number is read from the theme's tokens on the
 * page when a timeline is built, so motion follows the theme like colours do. The
 * manifest's static "actionDurations" promise a renderer the same lengths;
 * lowerThirdManifest.test.ts keeps the JSON and the token file in agreement.
 *
 * The role pill is animated even when it is hidden (a name-only lower third): tweening a
 * hidden element costs nothing, and it keeps the play-in the same length the manifest
 * promises whatever the data, and the pill ready should an update show it on air.
 *
 * On a page without the theme every token reads as 0 and the ease as linear (the theme
 * package's rule), so every timeline still ends; nothing on air ever waits on a token
 * that is not there.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** The two elements the animations move: the name pill and the role pill under it. */
export type LowerThirdAnimatedElements = {
  namePill: HTMLElement;
  rolePill: HTMLElement;
};

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type LowerThirdTimeline = ReturnType<typeof gsap.timeline>;

/** Builds the paused play-in timeline: the name pill rises in, the role pill a lead behind. */
export function buildPlayInTimeline(elements: LowerThirdAnimatedElements): LowerThirdTimeline {
  const motion = readMotionTokens(elements.namePill);
  const inSeconds = motion.inMs / 1000;
  const leadSeconds = motion.leadMs / 1000;
  const entryEase = gsapEaseOfToken(motion.easeOut);

  // Each tween gets its own objects: GSAP keeps a tween's vars, so two tweens must never
  // share one.
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    elements.namePill,
    { opacity: 0, y: motion.inOffsetPx },
    { opacity: 1, y: 0, duration: inSeconds, ease: entryEase },
    0,
  );
  timeline.fromTo(
    elements.rolePill,
    { opacity: 0, y: motion.inOffsetPx },
    { opacity: 1, y: 0, duration: inSeconds, ease: entryEase },
    leadSeconds,
  );
  return timeline;
}

/** Builds the paused stop-out timeline: both pills lift and fade away together. */
export function buildStopOutTimeline(elements: LowerThirdAnimatedElements): LowerThirdTimeline {
  const motion = readMotionTokens(elements.namePill);
  const timeline = gsap.timeline({ paused: true });
  timeline.to([elements.namePill, elements.rolePill], {
    opacity: 0,
    y: -motion.inOffsetPx,
    duration: motion.outMs / 1000,
    ease: gsapEaseOfToken(motion.easeIn),
  });
  return timeline;
}

/** Puts both pills in their off-air look (invisible, below their place) without animating. */
export function placePillsOffAir(elements: LowerThirdAnimatedElements): void {
  const motion = readMotionTokens(elements.namePill);
  gsap.set([elements.namePill, elements.rolePill], { opacity: 0, y: motion.inOffsetPx });
}
