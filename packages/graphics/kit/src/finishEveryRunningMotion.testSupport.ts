// Test support: ends every GSAP animation running on the page at once, firing each one's
// onComplete, so a pending playTimelineToTheEnd (a stop-out, a play-in) resolves. A test
// that checks a graphic "during its stop-out" makes that stop-out last a minute, so it
// cannot end by itself while the test looks, then finishes it with this instead of waiting
// for a real 250 ms fade: on a loaded CI runner a real fade may already be over when the
// test looks (gate 2 of PR #27, after #28's CI failed on a test waiting for real motion).
import { gsap } from 'gsap';

/** Jumps every animation GSAP is running to its end; each one's onComplete fires. */
export function finishEveryRunningMotionAtOnce(): void {
  const runningAnimations = gsap.globalTimeline.getChildren(false, true, true);
  for (const animation of runningAnimations) {
    animation.progress(1);
  }
}
