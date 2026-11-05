/**
 * The history page's filters (packages/shared)
 *
 * What this module is for:
 *   The history page (BAJAOVRLAY-30) narrows the rows by who sent them, their command
 *   group, a layer, refusals only and free text over the sentence. The page runs these on
 *   the live rows and the server on the older pages, so both agree.
 *
 * What these tests prove:
 *   - Each filter keeps the rows it should and drops the others; filters add up.
 *   - The text filter ignores case and accents, and blank text keeps every row.
 *   - hasAnyEventLogFilter says whether any filter is in use.
 *
 * What these tests deliberately do not cover:
 *   - How a row is described; describeEventLogEntry.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { DescribedEventLogEntry } from './describeEventLogEntry.js';
import { doesEventLogEntryMatchFilters, hasAnyEventLogFilter } from './eventLogFilters.js';

/** The operator's take of the race clock, accepted. */
function buildOperatorTakeOfTheClock(): DescribedEventLogEntry {
  return {
    id: 4_812,
    ts: '2026-10-09T14:32:05.000Z',
    who: { kind: 'operador', label: 'Operador' },
    sentence: 'Tomou "Relógio – Enduro" na camada Relógio (Programa)',
    isRefusal: false,
    group: 'takesAndClears',
    layerIds: ['clock'],
  };
}

/** Companion's take of a deleted lower third, refused. */
function buildRefusedTakeFromCompanion(): DescribedEventLogEntry {
  return {
    id: 4_813,
    ts: '2026-10-09T14:32:09.000Z',
    who: { kind: 'api', label: 'API · companion' },
    sentence: 'Recusado: Tomou item excluído (item-tarja-bruno-lima) — O item não existe.',
    isRefusal: true,
    group: 'takesAndClears',
    layerIds: [],
  };
}

const filterScenarios = [
  // Who: the operator's row passes, Companion's does not.
  {
    name: 'who keeps the operator’s row',
    filters: { who: 'operador' },
    row: 'operator',
    expected: true,
  },
  {
    name: 'who drops a device’s row',
    filters: { who: 'operador' },
    row: 'companion',
    expected: false,
  },
  // Group: a take is not a preview.
  {
    name: 'group drops a take under "Prévias"',
    filters: { group: 'previews' },
    row: 'operator',
    expected: false,
  },
  // Layer: the clock's take is on "Relógio", not on "Tarja".
  {
    name: 'layer keeps a row on that layer',
    filters: { layerId: 'clock' },
    row: 'operator',
    expected: true,
  },
  {
    name: 'layer drops a row on another layer',
    filters: { layerId: 'lower-third' },
    row: 'operator',
    expected: false,
  },
  // Refusals only.
  {
    name: 'refusals only keeps a refusal',
    filters: { onlyRefusals: true },
    row: 'companion',
    expected: true,
  },
  {
    name: 'refusals only drops an accepted row',
    filters: { onlyRefusals: true },
    row: 'operator',
    expected: false,
  },
  // Text, typed fast: no accent, any case.
  {
    name: 'text finds "Relógio" typed as "RELOGIO"',
    filters: { text: 'RELOGIO' },
    row: 'operator',
    expected: true,
  },
  {
    name: 'text drops a row without the words',
    filters: { text: 'pódio' },
    row: 'operator',
    expected: false,
  },
  // Blank text is no filter at all.
  {
    name: 'blank text keeps every row',
    filters: { text: '   ' },
    row: 'companion',
    expected: true,
  },
  // Filters add up: Companion and refusals, on the refused row.
  {
    name: 'two filters together keep a row that passes both',
    filters: { who: 'api', onlyRefusals: true },
    row: 'companion',
    expected: true,
  },
] as const;

describe('doesEventLogEntryMatchFilters', () => {
  it.each(filterScenarios)('$name', ({ filters, row, expected }) => {
    // Arrange: the row the scenario names.
    const described =
      row === 'operator' ? buildOperatorTakeOfTheClock() : buildRefusedTakeFromCompanion();

    // Act: apply the filters.
    const isKept = doesEventLogEntryMatchFilters(described, filters);

    // Assert: kept or dropped as the scenario says.
    expect(isKept, 'the filters must keep exactly the rows that pass them').toBe(expected);
  });
});

describe('hasAnyEventLogFilter', () => {
  it('says no filter is in use for none, or for blank text', () => {
    // Arrange: no filter, and a text of spaces.
    const noFilter = {};
    const blankText = { text: '  ' };

    // Act: ask each.
    const answers = [hasAnyEventLogFilter(noFilter), hasAnyEventLogFilter(blankText)];

    // Assert: neither counts as a filter.
    expect(answers, 'blank text and no filter mean every row is shown').toEqual([false, false]);
  });

  it('says a filter is in use for a layer or for refusals only', () => {
    // Arrange: a layer filter, and refusals only.
    const layerFilter = { layerId: 'clock' };
    const refusalsFilter = { onlyRefusals: true };

    // Act: ask each.
    const answers = [hasAnyEventLogFilter(layerFilter), hasAnyEventLogFilter(refusalsFilter)];

    // Assert: both count.
    expect(answers, 'a layer or refusals only is a filter in use').toEqual([true, true]);
  });
});
