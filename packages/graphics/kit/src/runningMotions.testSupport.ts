/**
 * Test support for GSAP under fake time: ends at once every timeline still running, as if
 * its motion had played to the end, so a component test that starts a real stop-out or
 * play-in (a motion token on the element, the action not awaited) never waits for the
 * animation itself; and puts GSAP's own frame loop to sleep before a test counts timers.
 *
 * Why: under fake time, or on a loaded CI runner, a real 250 ms motion may not end before
 * the test's 5 s timeout (gate 2 of PR #28, CI run 40188813066). Jumping each timeline to
 * its end fires its onComplete, so the graphic's pending action resolves exactly as after
 * a played motion (the kit's playTimelineToTheEnd), and the test then asserts.
 */
import { gsap } from 'gsap';

/** Jumps every running GSAP timeline to its end, firing its onComplete. */
export function finishEveryRunningMotionAtOnce(): void {
  // Only the timelines at the top of GSAP's global timeline: the graphics' own motions.
  // Their nested tweens are finished with them.
  const runningTimelines = gsap.globalTimeline.getChildren(false, false, true);
  for (const timeline of runningTimelines) {
    timeline.progress(1);
  }
}

/**
 * Puts GSAP's own frame loop to sleep, so a count of the page's pending timers and frames
 * holds the graphic's own only. After any motion GSAP keeps its ticker awake for about 120
 * frames (its autoSleep), booking each next frame with the requestAnimationFrame it found
 * when it woke: if that was a test's fake one, the frame is counted as a timer the graphic
 * forgot (CI run 40188813066, and 1 run in 5 locally). The next motion wakes it again.
 */
export function putGsapsFrameLoopToSleep(): void {
  gsap.ticker.sleep();
}
