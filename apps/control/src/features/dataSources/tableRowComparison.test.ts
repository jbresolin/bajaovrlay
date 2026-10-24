/**
 * When a Fontes table row may skip its redraw (apps/control)
 *
 * What this module is for:
 *   Every poll of a source brings new objects for the same 60 cars. The tables compare a
 *   row's car field by field, so only the rows of cars the poll changed are drawn again;
 *   with one redraw per row per poll, the page froze (gate 2 of PR #18).
 *
 * What these tests prove:
 *   - A new object with the same values counts as the same car, a nested object of the
 *     same values (a standings row's points by part) included.
 *   - A changed field, a field more or less, or a change of what the source sent counts
 *     as a change.
 *   - New corrections always redraw the row, since a cell may now be corrected.
 *
 * What these tests deliberately do not cover:
 *   - That React skips the row; that is React.memo's own promise. The page's speed is
 *     dataSourcesPageStaysResponsive.e2e.ts.
 */
import { describe, expect, it } from 'vitest';

import { isTableRowTheSame } from './tableRowComparison';

/** Car 42, Jequitibá Racing, 19th on lap 33, as one poll sends it (a new object each time). */
function buildCar42AtLap33() {
  return {
    position: 19,
    carNumber: 42,
    teamName: 'Jequitibá Racing',
    schoolName: 'CEFET-MG',
    laps: 33,
    lastLapMs: 278_200,
    status: 'running',
  };
}

const correctionsOfTheSimulator = { sourceId: 'simulador-enduro' };

describe('isTableRowTheSame', () => {
  const scenarios = [
    // A standings row carries its points by part: a new object each poll, same values.
    {
      name: 'is the same when a nested object holds the same values',
      nextEntry: { ...buildCar42AtLap33(), pointsByPart: { enduro: 400 } },
      previousExtra: { pointsByPart: { enduro: 400 } },
      nextCorrections: correctionsOfTheSimulator,
      isTheSame: true,
    },
    // The usual case: the next poll, nothing new for this car.
    {
      name: 'is the same for a new object with the same values',
      nextEntry: buildCar42AtLap33(),
      nextCorrections: correctionsOfTheSimulator,
      isTheSame: true,
    },
    // The car completed a lap: the row must show it.
    {
      name: 'is not the same when a field changed',
      nextEntry: { ...buildCar42AtLap33(), laps: 34 },
      nextCorrections: correctionsOfTheSimulator,
      isTheSame: false,
    },
    // The source now sends the best lap too: a field more is a change.
    {
      name: 'is not the same when a field was added',
      nextEntry: { ...buildCar42AtLap33(), bestLapMs: 271_900 },
      nextCorrections: correctionsOfTheSimulator,
      isTheSame: false,
    },
    // A correction was set or removed somewhere: this row's cell may be the one.
    {
      name: 'is not the same when the corrections changed',
      nextEntry: buildCar42AtLap33(),
      nextCorrections: { sourceId: 'simulador-enduro' },
      isTheSame: false,
    },
  ];

  it.each(scenarios)('$name', ({ nextEntry, nextCorrections, isTheSame, ...row }) => {
    // Arrange: car 42's row as the last poll drew it (with this row's extra fields).
    const previousExtra = 'previousExtra' in row ? row.previousExtra : {};
    const previousRow = {
      entry: { ...buildCar42AtLap33(), ...previousExtra },
      entryAsSent: buildCar42AtLap33(),
      corrections: correctionsOfTheSimulator,
    };

    // Act: compare it with this row's next poll.
    const answer = isTableRowTheSame(previousRow, {
      entry: nextEntry,
      entryAsSent: buildCar42AtLap33(),
      corrections: nextCorrections,
    });

    // Assert: redrawn only when something it shows changed.
    expect(answer, 'whether the row may skip its redraw').toBe(isTheSame);
  });

  it('is not the same when what the source sent changed under a correction', () => {
    // Arrange: car 42's team corrected; the source then renames it.
    const correctedEntry = { ...buildCar42AtLap33(), teamName: 'Jequitibá Racing Team' };
    const previousRow = {
      entry: correctedEntry,
      entryAsSent: buildCar42AtLap33(),
      corrections: correctionsOfTheSimulator,
    };

    // Act: the next poll, same corrected value, a new value as sent.
    const answer = isTableRowTheSame(previousRow, {
      entry: { ...correctedEntry },
      entryAsSent: { ...buildCar42AtLap33(), teamName: 'Jequitibá Baja' },
      corrections: correctionsOfTheSimulator,
    });

    // Assert: redrawn, since the dialog offers the value as sent.
    expect(answer, 'a new value as sent must redraw the row').toBe(false);
  });
});
