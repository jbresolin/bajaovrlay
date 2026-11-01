/**
 * One scrolling text's cycle (scrollingTextCycle.ts) as Web Animation keyframes, the form
 * the clock hands to the browser (scrollingTextWhenTooLong.ts). Only `transform` and
 * `opacity` move: Chromium runs such an animation on its compositor thread, so the scroll
 * keeps its frames when the page's main thread is busy. A GSAP timeline, which writes the
 * transform from the main thread every frame, dropped 6 to 27 frames in 3 s on a loaded
 * machine where the still tower dropped none (positionsTowerFrameBudget.e2e.ts).
 */
import { readPhaseMomentsOfText, type ScrollingTextCycle } from './scrollingTextCycle.js';
import type { ScrollingTextTimings } from './scrollingTextTimings.js';

/** One keyframe: where in the cycle (0 to 1), how far the text is moved, how shown. */
export type ScrollingTextKeyframe = {
  offset: number;
  transform: string;
  opacity: number;
};

/** The transform that moves a text `offsetPx` along (negative: to the left). */
function writeTranslation(offsetPx: number): string {
  return `translateX(${String(offsetPx)}px)`;
}

/**
 * The keyframes of one text over the whole cycle, read linearly between them: holding at
 * its start, scrolling, holding at its end, fading out there, jumping back unseen (two
 * keyframes at the same offset), fading in at its start. None for a text not in the cycle.
 */
export function buildScrollingTextKeyframes(
  cycle: ScrollingTextCycle,
  name: string,
  timings: ScrollingTextTimings,
): ScrollingTextKeyframe[] {
  const moments = readPhaseMomentsOfText(cycle, name, timings);
  const scrollDistancePx = cycle.scrollDistancePxByName.get(name);
  if (moments === undefined || scrollDistancePx === undefined) {
    return [];
  }
  const durationMs = cycle.durationMs;
  const atStart = writeTranslation(0);
  const atEnd = writeTranslation(-scrollDistancePx);
  return [
    { offset: 0, transform: atStart, opacity: 1 },
    { offset: moments.scrollStartsAtMs / durationMs, transform: atStart, opacity: 1 },
    { offset: moments.scrollEndsAtMs / durationMs, transform: atEnd, opacity: 1 },
    { offset: moments.returnStartsAtMs / durationMs, transform: atEnd, opacity: 1 },
    { offset: moments.returnSwitchesAtMs / durationMs, transform: atEnd, opacity: 0 },
    { offset: moments.returnSwitchesAtMs / durationMs, transform: atStart, opacity: 0 },
    { offset: 1, transform: atStart, opacity: 1 },
  ];
}
