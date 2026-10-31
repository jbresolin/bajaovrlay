/**
 * The race clock's flag while it is loaded: a new flag state crossfades its band in over
 * the current one, and the band switched on or off grows or shrinks the card, on air;
 * off air both are drawn at once, ready for play. One change at a time: a new one settles
 * the running one at once, so two changes in a row never tangle. Moved out of
 * race-clock.ts (BAJAOVRLAY-55) when the lifecycle file passed 400 lines.
 */
import type { FlagState } from '@bajaovrlay/graphics-kit/raceClockReading';
import { finishTimelineAtOnce } from '@bajaovrlay/graphics-kit/timelinePlayback';

import {
  buildFlagBandToggleTimeline,
  buildFlagChangeTimeline,
  type RaceClockTimeline,
} from './raceClockAnimations.js';
import {
  prepareIncomingFlagLayer,
  type RaceClockParts,
  showFlagBandAtOnce,
  showFlagBandAtOnceAndMeasureChange,
  showFlagStateAtOnce,
} from './raceClockView.js';

/** A flag change on its way, and how to settle it at once if cut short. */
type RunningFlagChange = { timeline: RaceClockTimeline; settleAtOnce: () => void };

/** What the flag changes read from the graphic. */
export type RaceClockFlagChangesOptions = {
  /** The drawn card's parts; there only after load. */
  readParts: () => RaceClockParts;
  isOnAir: () => boolean;
  isDisposed: () => boolean;
  /** Plays a timeline the graphic keeps track of, so dispose can end it early. */
  runTimeline: (timeline: RaceClockTimeline, skipAnimation: boolean) => Promise<void>;
};

/** The race clock's flag changes, one at a time. */
export class RaceClockFlagChanges {
  private readonly options: RaceClockFlagChangesOptions;
  private runningFlagChange: RunningFlagChange | undefined = undefined;

  constructor(options: RaceClockFlagChangesOptions) {
    this.options = options;
  }

  /** Forgets the change on its way (dispose has already ended its timeline). */
  forgetTheRunningChange(): void {
    this.runningFlagChange = undefined;
  }

  /**
   * Changes the flag state: on air the new band crossfades in over the current one;
   * off air nobody would see it, so the new flag is drawn at once, ready for play.
   */
  async changeFlagState(flagState: FlagState, skipAnimation: boolean): Promise<void> {
    const parts = this.options.readParts();
    this.finishRunningFlagChange();
    if (!this.options.isOnAir()) {
      showFlagStateAtOnce(parts, flagState);
      return;
    }
    prepareIncomingFlagLayer(parts, flagState);
    await this.runFlagChange(
      buildFlagChangeTimeline(parts),
      () => showFlagStateAtOnce(parts, flagState),
      skipAnimation,
    );
  }

  /**
   * Switches the band on or off: on air the card grows or shrinks by the band's height
   * while the band fades; off air the card is simply redrawn at its new height. The
   * heights come from the drawn card around the switch, so no pixel value lives here.
   */
  async changeFlagBand(isShown: boolean, skipAnimation: boolean): Promise<void> {
    const parts = this.options.readParts();
    this.finishRunningFlagChange();
    const toggle = showFlagBandAtOnceAndMeasureChange(parts, isShown);
    if (!this.options.isOnAir()) {
      return;
    }
    await this.runFlagChange(
      buildFlagBandToggleTimeline(parts, toggle),
      () => showFlagBandAtOnce(parts, isShown),
      skipAnimation,
    );
  }

  /**
   * Runs a flag change (crossfade or band toggle) and settles it when it ends. Only the
   * latest change may settle; an older one was settled when it was cut short, so two
   * changes in a row never tangle.
   */
  private async runFlagChange(
    timeline: RaceClockTimeline,
    settleAtOnce: () => void,
    skipAnimation: boolean,
  ): Promise<void> {
    const flagChange: RunningFlagChange = { timeline, settleAtOnce };
    this.runningFlagChange = flagChange;
    await this.options.runTimeline(timeline, skipAnimation);

    const isStillTheLatestChange = this.runningFlagChange === flagChange;
    if (isStillTheLatestChange && !this.options.isDisposed()) {
      this.runningFlagChange = undefined;
      flagChange.settleAtOnce();
    }
  }

  private finishRunningFlagChange(): void {
    const runningChange = this.runningFlagChange;
    if (runningChange === undefined) {
      return;
    }
    this.runningFlagChange = undefined;
    finishTimelineAtOnce(runningChange.timeline);
    runningChange.settleAtOnce();
  }
}
