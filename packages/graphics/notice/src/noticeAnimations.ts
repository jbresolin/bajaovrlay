/**
 * The notice's GSAP timelines: in and out, the race clock's two motions (the design's
 * motion.md, "Fastest lap and the penalty notice"). Every duration, offset and ease comes
 * from the theme's motion tokens (`--motion-*`, `--ease-*` in
 * packages/theme/ardosia/tokens.css), read from the card's computed style when a timeline
 * is built, so motion follows the theme like colours do. The manifest's static
 * "actionDurations" promise a renderer the same `--motion-in` and `--motion-out`;
 * noticeManifest.test.ts keeps the JSON and the token file in agreement.
 *
 * On a page without the theme every token reads as 0 and the ease as linear (the theme
 * package's rule), so every timeline still ends; nothing on air ever waits on a token
 * that is not there.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** The one element the animations move: the card. */
export type NoticeAnimatedElements = {
  panel: HTMLElement;
};

/** A paused GSAP timeline built by this module, played with `playTimelineToTheEnd`. */
export type NoticeTimeline = ReturnType<typeof gsap.timeline>;

/** Builds the paused play-in timeline: the card rises its offset and fades up. */
export function buildPlayInTimeline(elements: NoticeAnimatedElements): NoticeTimeline {
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
export function buildStopOutTimeline(elements: NoticeAnimatedElements): NoticeTimeline {
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
export function placePanelOffAir(elements: NoticeAnimatedElements): void {
  const motion = readMotionTokens(elements.panel);
  gsap.set(elements.panel, { opacity: 0, y: motion.inOffsetPx });
}

/**
 * Plays a paused timeline, kills it once it reaches its end, then resolves. With
 * skipAnimation it jumps straight to the end, as OGraf asks. Ending it early with
 * `finishTimelineAtOnce` also resolves the promise, so nobody is left waiting.
 */
export function playTimelineToTheEnd(
  timeline: NoticeTimeline,
  options: { skipAnimation: boolean },
): Promise<void> {
  return new Promise((resolve) => {
    timeline.eventCallback('onComplete', () => {
      // GSAP drops a timeline that played to its end on its own, but one jumped there
      // with progress(1) stays registered. The page runs all day in OBS, so kill every
      // finished timeline explicitly; kill keeps the end state on screen.
      timeline.kill();
      resolve();
    });
    if (options.skipAnimation) {
      timeline.progress(1);
    } else {
      timeline.play();
    }
  });
}

/**
 * Jumps a timeline to its end (firing its onComplete, so a pending
 * `playTimelineToTheEnd` resolves) and removes it from GSAP for good.
 */
export function finishTimelineAtOnce(timeline: NoticeTimeline): void {
  timeline.progress(1);
  timeline.kill();
}
