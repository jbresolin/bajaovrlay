/**
 * The battle card's trend crossfade on air: the one motion the card runs by itself, when a
 * new reading changes the trend's word (motion.md: the new word fades in over the old,
 * nothing moves). It keeps the crossfade that is running, so stop, dispose and the element
 * leaving the page can end it at once, and it settles the trend cell when the crossfade
 * ends, by itself or cut short. Split from battle-card.ts at gate 2 of PR #27.
 */
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
} from '@bajaovrlay/graphics-kit/timelinePlayback';

import { type BattleCardTimeline, buildTrendCrossfadeTimeline } from './battleCardAnimations.js';
import type { BattleCardParts } from './battleCardView.js';
import type { TrendShown } from './battleTrend.js';

/** A crossfade on air, with the trend the current layer wears once it ends. */
type RunningTrendCrossfade = { timeline: BattleCardTimeline; trendWanted: TrendShown };

/**
 * The trend crossfade of one battle card. `settleTrend` dresses the current layer in a
 * trend and puts both layers at rest; it is called once per crossfade, when it ends.
 */
export class BattleTrendCrossfade {
  private running: RunningTrendCrossfade | undefined = undefined;

  constructor(private readonly settleTrend: (trend: TrendShown) => void) {}

  /**
   * Crossfades the incoming layer (already dressed in `trendWanted`) in over the current
   * one and resolves when it ends. One ended first by finish(), or replaced by a newer
   * crossfade, was settled already and is left alone.
   */
  async run(
    parts: BattleCardParts,
    trendWanted: TrendShown,
    skipAnimation: boolean,
  ): Promise<void> {
    const crossfade: RunningTrendCrossfade = {
      timeline: buildTrendCrossfadeTimeline(parts),
      trendWanted,
    };
    this.running = crossfade;
    await playTimelineToTheEnd(crossfade.timeline, { skipAnimation });
    if (this.running === crossfade) {
      this.running = undefined;
      this.settleTrend(trendWanted);
    }
  }

  /** Ends a running crossfade at once and settles its new trend; nothing when none runs. */
  finish(): void {
    const crossfade = this.running;
    if (crossfade === undefined) {
      return;
    }
    this.running = undefined;
    finishTimelineAtOnce(crossfade.timeline);
    this.settleTrend(crossfade.trendWanted);
  }
}
