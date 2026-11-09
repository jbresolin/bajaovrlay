/**
 * The logo bug's GSAP timelines: a short fade in over `--motion-in` and out over
 * `--motion-out`, and nothing else. No rise, no pulse, no cycling (the brief): a channel
 * logo sits still. The durations and eases come from the theme's motion tokens, read from
 * the panel's computed style when a timeline is built; logoBugManifest.test.ts keeps the
 * manifest's "actionDurations" equal to them. On a page without the theme every token
 * reads as 0 and the ease as linear (the theme package's rule), so every timeline ends.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type LogoBugTimeline = ReturnType<typeof gsap.timeline>;

/** Builds the paused fade in: the panel from invisible to fully visible. */
export function buildFadeInTimeline(panel: HTMLElement): LogoBugTimeline {
  const motion = readMotionTokens(panel);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    panel,
    { opacity: 0 },
    { opacity: 1, duration: motion.inMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
  );
  return timeline;
}

/** Builds the paused fade out: the panel to invisible. */
export function buildFadeOutTimeline(panel: HTMLElement): LogoBugTimeline {
  const motion = readMotionTokens(panel);
  const timeline = gsap.timeline({ paused: true });
  timeline.to(panel, {
    opacity: 0,
    duration: motion.outMs / 1000,
    ease: gsapEaseOfToken(motion.easeIn),
  });
  return timeline;
}

/** Puts the panel in its off-air look (invisible) without animating. */
export function placePanelOffAir(panel: HTMLElement): void {
  gsap.set(panel, { opacity: 0 });
}
