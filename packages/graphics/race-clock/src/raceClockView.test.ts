/**
 * The race clock's DOM writers (packages/graphics/race-clock)
 *
 * What this module is for:
 *   raceClockView.ts draws the race clock's markup once and afterwards changes only the
 *   text and attributes that really changed. These tests cover the leader laps line,
 *   which some sessions (a qualifying, the pre-race) have no value for.
 *
 * What these tests prove:
 *   - The laps line is hidden when the data has no lapsCompletedByLeader.
 *   - The laps line is shown, with its pt-BR text, when the data has one.
 *
 * What these tests deliberately do not cover:
 *   - How the hidden line looks on air; jsdom draws nothing. The "pre" screenshot in
 *     e2e/raceClockScreenshots.e2e.ts shows the panel without a laps line.
 *   - The clock time and flag writers, which race-clock.test.ts covers through the
 *     component.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { RaceClockData } from './raceClockModel.js';
import {
  findRaceClockParts,
  type RaceClockParts,
  renderRaceClockTemplate,
  writeSessionCaptionAndLaps,
} from './raceClockView.js';

/** Builds the data the server sends during a qualifying session, which counts no laps. */
function createQualifyingDataWithoutLaps(): RaceClockData {
  return {
    sessionName: 'Classificação',
    state: 'green',
    clockMode: 'remaining',
    referenceTimeMs: 900_000,
    referenceWallClockMs: Date.parse('2026-05-16T10:00:00.000Z'),
    running: true,
  };
}

/** Draws the race clock's markup into a fresh container and returns its parts. */
function drawRaceClockParts(): RaceClockParts {
  const container = document.createElement('div');
  render(renderRaceClockTemplate(), container);
  return findRaceClockParts(container);
}

describe('the leader laps line', () => {
  it('is hidden when the data has no lapsCompletedByLeader', () => {
    // Arrange: freshly drawn parts and qualifying data, which has no lap count.
    const parts = drawRaceClockParts();
    const qualifyingData = createQualifyingDataWithoutLaps();

    // Act: write the session, caption and laps from that data.
    writeSessionCaptionAndLaps(parts, qualifyingData);

    // Assert: the laps line is hidden and carries no text.
    expect(parts.laps.hidden, 'with no lap count, the laps line must be hidden').toBe(true);
    expect(parts.laps.textContent, 'a hidden laps line must not keep old text').toBe('');
  });

  it('is shown with its pt-BR text when the data has lapsCompletedByLeader', () => {
    // Arrange: freshly drawn parts and enduro data where the leader has done 12 laps.
    const parts = drawRaceClockParts();
    const enduroData = {
      ...createQualifyingDataWithoutLaps(),
      sessionName: 'Enduro de Resistência',
      lapsCompletedByLeader: 12,
    };

    // Act: write the session, caption and laps from that data.
    writeSessionCaptionAndLaps(parts, enduroData);

    // Assert: the laps line is visible and reads "12 VOLTAS".
    expect(parts.laps.hidden, 'with a lap count, the laps line must be shown').toBe(false);
    expect(parts.laps.textContent, 'the laps line must read the pt-BR lap count').toBe('12 VOLTAS');
  });
});
