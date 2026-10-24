/**
 * Playing and ending a graphic's GSAP timelines. Every graphic builds paused timelines
 * from the theme's motion tokens and plays them through these two functions, so the
 * OGraf `skipAnimation` rule and the clean-up of finished timelines are written once.
 */
import type { gsap } from 'gsap';

/** A paused GSAP timeline, as every graphic's animations module builds it. */
export type GraphicTimeline = ReturnType<typeof gsap.timeline>;

/**
 * Plays a paused timeline, kills it once it reaches its end, then resolves. With
 * skipAnimation it jumps straight to the end, as OGraf asks. Ending it early with
 * `finishTimelineAtOnce` also resolves the promise, so nobody is left waiting.
 */
export function playTimelineToTheEnd(
  timeline: GraphicTimeline,
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
export function finishTimelineAtOnce(timeline: GraphicTimeline): void {
  timeline.progress(1);
  timeline.kill();
}
