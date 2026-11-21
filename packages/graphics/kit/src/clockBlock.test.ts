/**
 * The clock block of the lower strip and the message ticker (packages/graphics/kit)
 *
 * What this module is for:
 *   Both bars start with a card holding the race time and the flag pill, which must read
 *   exactly what the race clock's card reads. clockBlock.ts draws it once and then writes
 *   only what changed, on every frame while on air.
 *
 * What these tests prove:
 *   - The block shows the kit's time text for the reading at the moment given, and the
 *     flag pill dressed as the flag (the checkered one wordless, but named).
 *   - A later frame changes the time in place, on the same elements.
 *   - With no flag in the reading (BAJAOVRLAY-81) the pill is hidden, so the card closes
 *     up around the time; a flag coming back shows the pill again.
 *
 * What these tests deliberately do not cover:
 *   - The look; the bars' screenshot tests show it on the grey and black stages.
 *   - The same text as the race clock's card; the lower strip's sameTimeAsTheRaceClock
 *     test puts both on one page.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import { findClockBlockParts, renderClockBlockTemplate, writeClockBlockAt } from './clockBlock.js';
import type { RaceClockReading } from './raceClockReading.js';

// 14:00:00 on the enduro's day, as the server's clock read it.
const twoInTheAfternoonMs = Date.UTC(2026, 2, 8, 17, 0, 0);

/** The enduro an hour in, green flag, counting up. */
function createEnduroOneHourInReading(): RaceClockReading {
  return {
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: twoInTheAfternoonMs,
    running: true,
  };
}

/** Draws the block into a fresh container and finds its parts. */
function drawClockBlock() {
  const container = document.createElement('div');
  render(renderClockBlockTemplate(), container);
  return findClockBlockParts(container);
}

describe('writeClockBlockAt', () => {
  it('shows the race time at that moment and the flag pill dressed as the flag', () => {
    // Arrange: the block, drawn empty.
    const parts = drawClockBlock();

    // Act: write the enduro an hour in, 90 s after the reading.
    writeClockBlockAt(parts, createEnduroOneHourInReading(), twoInTheAfternoonMs + 90_000);

    // Assert: the time the race clock would show, and the green pill.
    expect(parts.time.textContent, 'the time must be the race clock’s text').toBe('1:01:30');
    expect(parts.flagPill.dataset.flagState, 'the pill takes the flag’s colours').toBe('green');
    expect(parts.flagWord.textContent, 'the pill reads the flag’s word').toBe('VERDE');
  });

  it('changes the time in place on a later frame, and shows the checkered pill wordless', () => {
    // Arrange: the block showing the enduro an hour in.
    const parts = drawClockBlock();
    writeClockBlockAt(parts, createEnduroOneHourInReading(), twoInTheAfternoonMs);
    const timeElementBefore = parts.time;

    // Act: the race ends under the checkered flag, a second later.
    writeClockBlockAt(
      parts,
      { ...createEnduroOneHourInReading(), state: 'checkered' },
      twoInTheAfternoonMs + 1000,
    );

    // Assert: the new second on the same element, and the pattern alone, still named.
    expect(parts.time, 'the time is written in place').toBe(timeElementBefore);
    expect(parts.time.textContent, 'the time moved on by a second').toBe('1:00:01');
    expect(parts.flagWord.textContent, 'the checkered pill shows no word').toBe('');
    expect(parts.flagPill.getAttribute('aria-label'), 'but is named').toBe('QUADRICULADA');
  });
});

describe('writeClockBlockAt with no flag (BAJAOVRLAY-81)', () => {
  it('hides the flag pill when the reading has no flag, and the time still shows', () => {
    // Arrange: the block, drawn empty, and the enduro an hour in with its flag left out.
    const parts = drawClockBlock();
    const { state: flagLeftOut, ...readingWithoutFlag } = createEnduroOneHourInReading();

    // Act: write that reading.
    writeClockBlockAt(parts, readingWithoutFlag, twoInTheAfternoonMs);

    // Assert: the time is there and the pill is hidden (hidden takes it out of the card's
    // row, so the card closes up around the time).
    expect(flagLeftOut, 'the reading we started from had a flag').toBe('green');
    expect(parts.time.textContent, 'the time still shows').toBe('1:00:00');
    expect(parts.flagPill.hidden, 'with no flag the pill must be hidden').toBe(true);
  });

  it('shows the pill again, dressed as the flag, when the flag comes back', () => {
    // Arrange: the block showing a reading with no flag.
    const parts = drawClockBlock();
    const { state: flagLeftOut, ...readingWithoutFlag } = createEnduroOneHourInReading();
    writeClockBlockAt(parts, readingWithoutFlag, twoInTheAfternoonMs);

    // Act: the session source sends the yellow flag a second later.
    writeClockBlockAt(
      parts,
      { ...readingWithoutFlag, state: 'yellow' },
      twoInTheAfternoonMs + 1000,
    );

    // Assert: the pill is back, yellow, with its word.
    expect(flagLeftOut, 'the reading we started from had a flag').toBe('green');
    expect(parts.flagPill.hidden, 'with a flag the pill must show').toBe(false);
    expect(parts.flagPill.dataset.flagState, 'the pill takes the yellow colours').toBe('yellow');
    expect(parts.flagWord.textContent, 'the pill reads the yellow word').toBe('AMARELA');
  });
});
