/**
 * The race clock's DOM writers (packages/graphics/race-clock)
 *
 * What this module is for:
 *   raceClockView.ts draws the race clock's markup once and afterwards changes only the
 *   text and attributes that really changed. These tests cover the leader laps line,
 *   which some sessions (a qualifying, the pre-race) have no value for; the flag band
 *   switch, which lowers the card by the band's height; and the checkered band, which
 *   carries no word (only the pattern) but keeps the word as its accessible name.
 *
 * What these tests prove:
 *   - The laps line is hidden when the data has no lapsCompletedByLeader.
 *   - The laps line is shown, with its pt-BR text, when the data has one.
 *   - Showing or hiding the band marks the card (data-flag-band) and hides the band
 *     from assistive technology, on the same elements (nothing is rebuilt).
 *   - A flag state writes its word on the band and as the band's accessible name; the
 *     checkered state writes an empty word and keeps QUADRICULADA as the name.
 *
 * What these tests deliberately do not cover:
 *   - How the hidden line, the lower card or the checkered pattern look on air; jsdom
 *     draws nothing. The "pre" and "sem-faixa" screenshots in
 *     e2e/raceClockScreenshots.e2e.ts show them.
 *   - The clock time writer, which race-clock.test.ts covers through the component.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { RaceClockData } from './raceClockModel.js';
import {
  findRaceClockParts,
  type RaceClockParts,
  renderRaceClockTemplate,
  showFlagBandAtOnce,
  showFlagStateAtOnce,
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

describe('the flag band switch', () => {
  it('marks the card as without its band and hides the band when switched off', () => {
    // Arrange: freshly drawn parts, with the band shown as the template starts.
    const parts = drawRaceClockParts();
    const panelBefore = parts.panel;
    const flagBandBefore = parts.flagBand;

    // Act: switch the band off.
    showFlagBandAtOnce(parts, false);

    // Assert: the same card and band are still there; the card is marked (the styles
    // lower it by the band's height from that mark) and the band is hidden from
    // assistive technology.
    expect(parts.panel, 'the card must be the same element, never rebuilt').toBe(panelBefore);
    expect(parts.flagBand, 'the band must be the same element, never rebuilt').toBe(flagBandBefore);
    expect(parts.panel.dataset.flagBand, 'the card must be marked as without its band').toBe(
      'hidden',
    );
    expect(
      parts.flagBand.getAttribute('aria-hidden'),
      'a hidden band must be hidden from assistive technology',
    ).toBe('true');
  });

  it('marks the card as with its band and shows the band again when switched back on', () => {
    // Arrange: parts whose band was switched off.
    const parts = drawRaceClockParts();
    showFlagBandAtOnce(parts, false);

    // Act: switch it back on.
    showFlagBandAtOnce(parts, true);

    // Assert: the mark and the accessibility hiding are gone.
    expect(parts.panel.dataset.flagBand, 'the card must be marked as with its band').toBe('shown');
    expect(
      parts.flagBand.getAttribute('aria-hidden'),
      'a shown band must not be hidden from assistive technology',
    ).toBeNull();
  });
});

describe('the flag word on the band', () => {
  it('writes the word for a coloured flag and makes it the band’s accessible name', () => {
    // Arrange: freshly drawn parts.
    const parts = drawRaceClockParts();

    // Act: show the yellow flag at once.
    showFlagStateAtOnce(parts, 'yellow');

    // Assert: the word is on the band, and the layer answers to the same word.
    expect(parts.currentFlagLabel.textContent, 'the yellow band must read AMARELA').toBe('AMARELA');
    expect(
      parts.currentFlagLayer.getAttribute('aria-label'),
      'the band’s accessible name must be the flag word',
    ).toBe('AMARELA');
    expect(parts.currentFlagLayer.dataset.flagState, 'the layer must carry the state').toBe(
      'yellow',
    );
  });

  it('writes no word for the checkered flag and keeps QUADRICULADA as the accessible name', () => {
    // Arrange: parts showing the green flag, with its word on the band.
    const parts = drawRaceClockParts();
    showFlagStateAtOnce(parts, 'green');

    // Act: the leader crosses the line: the checkered flag.
    showFlagStateAtOnce(parts, 'checkered');

    // Assert: the pattern alone is on the band (the design puts no word over it), but
    // the band still says what it is to assistive technology.
    expect(parts.currentFlagLabel.textContent, 'the checkered band must carry no word').toBe('');
    expect(
      parts.currentFlagLayer.getAttribute('aria-label'),
      'the checkered band must still be named QUADRICULADA',
    ).toBe('QUADRICULADA');
  });
});
