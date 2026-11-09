/**
 * The race clock's GSAP timelines: in, out, flag change and the band switched on or
 * off on air. Every duration, offset and ease comes from the theme's motion tokens
 * (`--motion-*`, `--ease-*` in packages/theme/ardosia/tokens.css), read from the card's
 * computed style when a timeline is built, so motion follows the theme like colours
 * do. The manifest's static "actionDurations" promise a renderer the same `--motion-in`
 * and `--motion-out`; raceClockManifest.test.ts keeps the JSON and the token file in
 * agreement.
 *
 * On a page without the theme every token reads as 0 and the ease as linear (the
 * theme package's rule), so every timeline still ends; nothing on air ever waits on a
 * token that is not there.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** The three elements the animations move. */
export type RaceClockAnimatedElements = {
  panel: HTMLElement;
  flagBand: HTMLElement;
  incomingFlagLayer: HTMLElement;
};

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type RaceClockTimeline = ReturnType<typeof gsap.timeline>;

/** What the band toggle needs: the card's heights before and after, and the direction. */
export type FlagBandToggle = {
  /** The card's height as drawn before the switch, in pixels. */
  heightBeforePx: number;
  /** The card's height the styles give it after the switch, in pixels. */
  heightAfterPx: number;
  /** True when the band comes on (the card grows), false when it goes (the card shrinks). */
  isShowing: boolean;
};

/** Builds the paused play-in timeline: the whole card rises its offset and fades up. */
export function buildPlayInTimeline(elements: RaceClockAnimatedElements): RaceClockTimeline {
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
export function buildStopOutTimeline(elements: RaceClockAnimatedElements): RaceClockTimeline {
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

/**
 * Builds the paused flag-change timeline: the incoming layer, already dressed in the
 * new flag, fades in over the current one. Nothing moves: a flag change must read as
 * a state, not as an animation (the design's motion.md).
 */
export function buildFlagChangeTimeline(elements: RaceClockAnimatedElements): RaceClockTimeline {
  const motion = readMotionTokens(elements.panel);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    elements.incomingFlagLayer,
    { opacity: 0 },
    { opacity: 1, duration: motion.flagMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
  );
  return timeline;
}

/**
 * Builds the paused band-toggle timeline: the card's height goes from the height it had
 * to the one the styles now give it while the band fades in or out, both over the flag
 * change's duration and with the flag change's ease, `--ease-out`, whichever way the
 * band goes (the design's motion.md: a flag change settles, it never accelerates away
 * like a piece leaving). The inline height and opacity are cleared at the end
 * (`clearProps`), so the styles own them again once the switch has settled.
 */
export function buildFlagBandToggleTimeline(
  elements: RaceClockAnimatedElements,
  toggle: FlagBandToggle,
): RaceClockTimeline {
  const motion = readMotionTokens(elements.panel);
  const durationInSeconds = motion.flagMs / 1000;
  const ease = gsapEaseOfToken(motion.easeOut);
  const timeline = gsap.timeline({ paused: true });
  // lazy: false writes the starting height the moment the tween is built. Left lazy,
  // GSAP may hold it back until its next render (when its ticker has counted a frame it
  // has not rendered yet), and until then the card stands at the height the styles
  // already give it after the switch: a test read '' there under load (BAJAOVRLAY-68).
  timeline.fromTo(
    elements.panel,
    { height: toggle.heightBeforePx },
    {
      height: toggle.heightAfterPx,
      duration: durationInSeconds,
      ease,
      clearProps: 'height',
      lazy: false,
    },
  );
  // autoAlpha sets visibility along with opacity, so a band fading out is also hidden
  // from the page once invisible, and a band fading in is visible from its first frame.
  // lazy: false for the same reason as the height: the band's start goes with it.
  timeline.fromTo(
    elements.flagBand,
    { autoAlpha: toggle.isShowing ? 0 : 1 },
    {
      autoAlpha: toggle.isShowing ? 1 : 0,
      duration: durationInSeconds,
      ease,
      clearProps: 'opacity,visibility',
      lazy: false,
    },
    0,
  );
  return timeline;
}

/** Clears whatever inline height, opacity or visibility a band toggle left behind. */
export function clearFlagBandToggleLeftovers(elements: RaceClockAnimatedElements): void {
  gsap.set(elements.panel, { clearProps: 'height' });
  gsap.set(elements.flagBand, { clearProps: 'opacity,visibility' });
}

/** Makes the incoming flag layer invisible again, ready for the next flag change. */
export function hideIncomingFlagLayer(elements: RaceClockAnimatedElements): void {
  gsap.set(elements.incomingFlagLayer, { opacity: 0 });
}

/** Puts the card in its off-air look (invisible, below its place) without animating. */
export function placePanelOffAir(elements: RaceClockAnimatedElements): void {
  const motion = readMotionTokens(elements.panel);
  gsap.set(elements.panel, { opacity: 0, y: motion.inOffsetPx });
}
