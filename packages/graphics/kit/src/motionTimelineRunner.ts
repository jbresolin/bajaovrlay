/**
 * The one place a graphic runs its in, out and page motions: one motion at a time (a new
 * one finishes the running one at once, so a stop during the play-in or a page turn starts
 * settled), every timeline kept until it ends so dispose can end them all, and an answer to
 * "is a motion running?" for the code that must wait for it (a page drawn once the
 * stop-out has faded). The lower strip and the message ticker use it; the standings and
 * the tower keep their own copies until they move here.
 */
import {
  finishTimelineAtOnce,
  type GraphicTimeline,
  playTimelineToTheEnd,
} from './timelinePlayback.js';

/** Runs a graphic's motions one at a time. */
export type MotionTimelineRunner = {
  /**
   * Plays a paused timeline to its end (or jumps there with skipAnimation), finishing at
   * once the one still running first. Resolves when it ends, also when ended early.
   */
  run: (timeline: GraphicTimeline, skipAnimation: boolean) => Promise<void>;
  /** Whether an in, out or page motion is still running. */
  isRunning: () => boolean;
  /** Ends every timeline at once (dispose): their pending runs resolve. */
  finishEveryTimelineAtOnce: () => void;
};

/** Creates a runner with no motion running. */
export function createMotionTimelineRunner(): MotionTimelineRunner {
  let runningTimeline: GraphicTimeline | undefined;
  const unfinishedTimelines = new Set<GraphicTimeline>();

  async function run(timeline: GraphicTimeline, skipAnimation: boolean): Promise<void> {
    if (runningTimeline !== undefined) {
      finishTimelineAtOnce(runningTimeline);
    }
    runningTimeline = timeline;
    unfinishedTimelines.add(timeline);
    await playTimelineToTheEnd(timeline, { skipAnimation });
    unfinishedTimelines.delete(timeline);
    // A later run may have taken its place while this one played.
    if (runningTimeline === timeline) {
      runningTimeline = undefined;
    }
  }

  function isRunning(): boolean {
    return runningTimeline !== undefined;
  }

  function finishEveryTimelineAtOnce(): void {
    for (const timeline of [...unfinishedTimelines]) {
      finishTimelineAtOnce(timeline);
    }
    unfinishedTimelines.clear();
    runningTimeline = undefined;
  }

  return { run, isRunning, finishEveryTimelineAtOnce };
}
