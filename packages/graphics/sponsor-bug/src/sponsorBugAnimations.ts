/**
 * The sponsor bug's GSAP timelines (the design's motion.md, "Sponsor bug: the card alone
 * ... it never pulses or cycles"): the whole card rises in, the mark, the word and the
 * sponsor's logo with it; out, the card lifts. Nothing moves while it is up: the bug sits
 * top-left all day, and cycling through sponsors is the corner roll's job (BAJAOVRLAY-26).
 * Every duration, offset and ease comes from the theme's motion tokens (`--motion-*`,
 * `--ease-*` in packages/theme/ardosia/tokens.css), read from the card's computed style
 * when a timeline is built. The manifest's static "actionDurations" promise a renderer the
 * same `--motion-in` and `--motion-out`; sponsorBugManifest.test.ts keeps the two in
 * agreement.
 *
 * motion.md's "100 ms after the clock when they enter together" is about two graphics
 * taken at once; the renderer takes each on its own, so the bug rises at once, as the
 * lower third does without the strip (docs/decisions.md).
 *
 * On a page without the theme every token reads as 0 and the ease as linear (the theme
 * package's rule), so every timeline still ends.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** The one element the animations move: the card, with the mark and the logo inside it. */
export type SponsorBugAnimatedElements = {
  panel: HTMLElement;
};

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type SponsorBugTimeline = ReturnType<typeof gsap.timeline>;

/** Builds the paused play-in timeline: the whole card rises its offset and fades up. */
export function buildPlayInTimeline(elements: SponsorBugAnimatedElements): SponsorBugTimeline {
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
export function buildStopOutTimeline(elements: SponsorBugAnimatedElements): SponsorBugTimeline {
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
export function placePanelOffAir(elements: SponsorBugAnimatedElements): void {
  const motion = readMotionTokens(elements.panel);
  gsap.set(elements.panel, { opacity: 0, y: motion.inOffsetPx });
}
