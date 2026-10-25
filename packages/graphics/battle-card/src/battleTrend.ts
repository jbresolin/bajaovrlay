/**
 * The battle card's trend: whether the car behind is closing on the car ahead, opening the
 * gap, or holding it, and by how much since a lap ago (BAJAOVRLAY-47, decided in the brief).
 * No canonical shape carries the gap of a lap ago, so the graphic remembers it: the gap it
 * saw when the car behind last completed a lap. When the car behind's laps grow, the new
 * gap is compared with that one: 0,1 s or more smaller is closing, 0,1 s or more larger is
 * opening, anything in between is steady; then the new reading is the one remembered.
 * Until there are two readings the card says steady with no number. A trend the operator
 * set by hand always wins over this one.
 *
 * Deliberate trade-off: this memory lives in the graphic, not on the server, so a renderer
 * reload (or a new take, which loads a new element) starts it again, and the first lap
 * after that shows "ESTÁVEL" with no number. Keeping it on the server would need a new
 * slice for one graphic's convenience; a trend that matters can be set by hand.
 *
 * Every function here is pure: the memory goes in and a new memory comes out.
 */
import { writeSecondsToTheTenthCutAsText } from '@bajaovrlay/shared/raceTimeText';

import { ptBR } from './ptBR.js';

/** The three trends the design draws, each with its own word, shape and colour. */
export type TrendWord = 'closing' | 'opening' | 'steady';

/**
 * What the trend cell shows: the word, and the change of the gap in ms (negative when
 * closing), or undefined when there is no number to show (steady, or not two readings yet).
 */
export type TrendShown = { word: TrendWord; changeMs: number | undefined };

/** One reading of the battle the trend is followed from: who fights, the laps and the gap. */
export type GapReading = {
  aheadCarNumber: number;
  behindCarNumber: number;
  behindLaps: number;
  gapMs: number;
};

/**
 * What the graphic keeps between updates: the reading taken at the car behind's last lap
 * change (undefined before the first reading) and the trend that comparison gave.
 */
export type TrendMemory = {
  readingAtLastLapChange: GapReading | undefined;
  trendFromTheGap: TrendShown;
};

/** The trend the operator may set by hand, as the manifest's two optional fields carry it. */
export type TrendSetByHand = {
  manualTrend?: TrendWord | undefined;
  manualTrendChangeMs?: number | undefined;
};

/** The smallest change of the gap, in ms, that is a trend: 0,1 s, the tenth the card shows. */
export const trendThresholdMs = 100;

/** "— ESTÁVEL" with no number: before two readings, and for every steady comparison. */
const steadyWithNoNumber: TrendShown = { word: 'steady', changeMs: undefined };

/** The memory of a graphic that has seen nothing yet. */
export const emptyTrendMemory: TrendMemory = {
  readingAtLastLapChange: undefined,
  trendFromTheGap: steadyWithNoNumber,
};

/**
 * Compares the gap now with the gap a lap ago: smaller by the threshold or more is
 * closing, larger by the threshold or more is opening, anything else is steady.
 */
export function compareGapWithTheLapBefore(gapLapBeforeMs: number, gapNowMs: number): TrendShown {
  const changeMs = gapNowMs - gapLapBeforeMs;
  if (changeMs <= -trendThresholdMs) {
    return { word: 'closing', changeMs };
  }
  if (changeMs >= trendThresholdMs) {
    return { word: 'opening', changeMs };
  }
  return steadyWithNoNumber;
}

/**
 * Takes one more reading into the memory:
 * - the first reading, another pair of cars, or laps that went down (a timing correction)
 *   start the memory again: this reading is kept and the trend is steady with no number;
 * - the car behind's laps unchanged: nothing is compared and the memory stays as it was,
 *   so the trend on screen holds until the next lap;
 * - the car behind's laps grew: the new gap is compared with the remembered one, and the
 *   new reading becomes the one remembered.
 */
export function followGapReading(memory: TrendMemory, reading: GapReading): TrendMemory {
  const remembered = memory.readingAtLastLapChange;
  const isFirstReading = remembered === undefined;
  const isAnotherBattle =
    !isFirstReading &&
    (remembered.aheadCarNumber !== reading.aheadCarNumber ||
      remembered.behindCarNumber !== reading.behindCarNumber);
  const haveLapsGoneDown = !isFirstReading && reading.behindLaps < remembered.behindLaps;
  if (isFirstReading || isAnotherBattle || haveLapsGoneDown) {
    return { readingAtLastLapChange: reading, trendFromTheGap: steadyWithNoNumber };
  }

  const hasCompletedALap = reading.behindLaps > remembered.behindLaps;
  if (!hasCompletedALap) {
    return memory;
  }
  return {
    readingAtLastLapChange: reading,
    trendFromTheGap: compareGapWithTheLapBefore(remembered.gapMs, reading.gapMs),
  };
}

/**
 * The trend to put on air: the one set by hand when there is one (its change shown as a
 * closing minus or an opening plus, never on a steady), otherwise the one from the gap.
 */
export function chooseTrendToShow(memory: TrendMemory, setByHand: TrendSetByHand): TrendShown {
  const manualTrend = setByHand.manualTrend;
  if (manualTrend === undefined) {
    return memory.trendFromTheGap;
  }
  const changeSizeMs = setByHand.manualTrendChangeMs;
  if (manualTrend === 'steady' || changeSizeMs === undefined) {
    return { word: manualTrend, changeMs: undefined };
  }
  const changeMs = manualTrend === 'closing' ? -changeSizeMs : changeSizeMs;
  return { word: manualTrend, changeMs };
}

/**
 * Writes the change with its sign, in tenths cut like every race time: −700 ms is
 * "−0,7" (the typographic minus), 650 ms is "+0,6".
 */
export function writeTrendChangeText(changeMs: number): string {
  const sign = changeMs < 0 ? ptBR.minusSign : ptBR.plusSign;
  return `${sign}${writeSecondsToTheTenthCutAsText(Math.abs(changeMs))}`;
}

/** The words of the trend cell: "FECHANDO −0,7", "ABRINDO +0,7", "ESTÁVEL". */
export function writeTrendWords(trend: TrendShown): string {
  const word = ptBR.trendWords[trend.word];
  if (trend.word === 'steady' || trend.changeMs === undefined) {
    return word;
  }
  return `${word} ${writeTrendChangeText(trend.changeMs)}`;
}
