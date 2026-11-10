// Test support (chaos suite): reading the race clock on the program output as a viewer
// reads it, in whole seconds, so a scenario can compare the time shown before and after a
// fault with the time that really passed. Functions only.
import { expect, type Locator, type Page } from '@playwright/test';

/** Finds the time the race clock on the "clock" layer shows ("1:05:12"). */
export function findRaceClockTimeOnTheOutput(outputPage: Page): Locator {
  return outputPage
    .locator('[data-layer-id="clock"] > baja-graphic-race-clock')
    .getByTestId('race-clock-time');
}

/**
 * Turns a time as the race clock writes it ("1:05:12", "05:12") into whole seconds. Fails,
 * quoting it, on anything else, so a clock showing "--:--" is a clear failure.
 */
export function readClockTextAsSeconds(clockText: string): number {
  const parts = clockText.trim().split(':');
  const isATime = parts.length >= 2 && parts.every((part) => /^\d+$/.test(part));
  if (!isATime) {
    throw new Error(`the race clock shows "${clockText}", which is not a time`);
  }
  let seconds = 0;
  for (const part of parts) {
    seconds = seconds * 60 + Number(part);
  }
  return seconds;
}

/** Reads the time the race clock on the output shows now, in whole seconds. */
export async function readRaceClockSecondsOnTheOutput(outputPage: Page): Promise<number> {
  const clockText = (await findRaceClockTimeOnTheOutput(outputPage).textContent()) ?? '';
  return readClockTextAsSeconds(clockText);
}

/** Waits until the race clock on the output shows a time: on air, and drawn. */
export async function waitUntilTheRaceClockShowsATime(outputPage: Page): Promise<void> {
  await expect(
    findRaceClockTimeOnTheOutput(outputPage),
    'the race clock must be on air, showing a time',
  ).toHaveText(/^\s*\d+:\d\d(:\d\d)?\s*$/);
}

/** One reading of the race clock: when it was read, and the whole seconds it showed. */
export type ClockReading = { readAtMs: number; seconds: number };

/**
 * Reads the race clock on the output once a second until `stop` is called, which answers
 * every reading, oldest first. For a scenario that must watch the clock through a fault,
 * not only before and after it (gate 2 of PR #61).
 */
export function startReadingTheRaceClockEverySecond(outputPage: Page): {
  stop: () => Promise<ClockReading[]>;
} {
  const readings: ClockReading[] = [];
  let isStopped = false;
  const readingLoop = (async () => {
    while (!isStopped) {
      const seconds = await readRaceClockSecondsOnTheOutput(outputPage);
      readings.push({ readAtMs: Date.now(), seconds });
      await outputPage.waitForTimeout(1_000);
    }
  })();
  return {
    stop: async () => {
      isStopped = true;
      await readingLoop;
      return readings;
    },
  };
}
