// Test support for the battle card's trend tests: the readings of one battle (car 1, Equipe
// FEI Baja, right behind car 8, Imperador) and following them from an empty memory, as a
// graphic does from its load. Every function builds fresh objects on each call.
import {
  emptyTrendMemory,
  followGapReading,
  type GapReading,
  type TrendMemory,
} from './battleTrend.js';

/** Car 1 (Equipe FEI Baja, P5) right behind car 8 (Imperador, P4), at the given lap and gap. */
export function readFeiBehindImperador(behindLaps: number, gapMs: number): GapReading {
  return {
    aheadCarNumber: 8,
    aheadPosition: 4,
    behindCarNumber: 1,
    behindPosition: 5,
    behindLaps,
    gapMs,
  };
}

/**
 * Car 1 has passed car 8: the item still names car 8 ahead and car 1 behind, but car 1 now
 * runs P4 and car 8 P5, and car 1's interval is to a third car, the P3.
 */
export function readFeiAfterPassingImperador(behindLaps: number, gapMs: number): GapReading {
  return { ...readFeiBehindImperador(behindLaps, gapMs), aheadPosition: 5, behindPosition: 4 };
}

/** Follows a list of readings from an empty memory, as a graphic does from its load. */
export function followReadings(readings: GapReading[]): TrendMemory {
  let memory = emptyTrendMemory;
  for (const reading of readings) {
    memory = followGapReading(memory, reading);
  }
  return memory;
}
