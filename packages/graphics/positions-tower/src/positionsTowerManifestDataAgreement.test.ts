// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   positions-tower.ograf.json describes the tower's data as JSON Schema, for renderers
 *   and for the control page's generated form; positionsTowerModel.ts checks the same
 *   data with Zod when `load` and `updateAction` receive it. If the two disagreed, the
 *   form could offer a value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the whole 60-car enduro sample as it
 *     is (a canonical positions list binds as is); the entries alone; an entry carrying
 *     a field the tower does not know (passes: the shape may gain fields); an entry
 *     missing its team name, with a status outside the six, with a negative refuel
 *     count or with a gap of zero laps (fail); a layout outside the two, a paging mode
 *     outside the two and a top-level field the tower does not know (fail).
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest (settings, titles, durations, the OGraf schema itself);
 *     positionsTowerManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1) like its sibling;
 *     it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator';
import positionsSample from '@bajaovrlay/shared/samples/positions.json';
import { describe, expect, it } from 'vitest';

import positionsTowerManifest from '../positions-tower.ograf.json';
import { parseCompletePositionsTowerData } from './positionsTowerModel.js';

/** The enduro sample's 60 entries, as a binding to the positions list hands them over. */
function createSampleEntries(): Record<string, unknown>[] {
  return positionsSample.entries.map((entry) => ({ ...entry }));
}

/** The sample with one entry changed (a field set, or removed when the value is undefined). */
function createSampleWithEntryChanged(
  entryIndex: number,
  fieldName: string,
  value: unknown,
): Record<string, unknown>[] {
  return createSampleEntries().map((entry, index) =>
    index === entryIndex ? { ...entry, [fieldName]: value } : entry,
  );
}

/** The data an item sends with every setting written out, on the given entries. */
function createDetailedTowerData(entries: Record<string, unknown>[]) {
  return {
    entries,
    layout: 'detailed',
    showGap: true,
    showInterval: true,
    showLastLap: true,
    showBestLap: true,
    showPitStops: true,
    showFuelStops: false,
    showStatus: true,
    paging: 'cycle',
  };
}

const dataAgreementScenarios = [
  // The everyday payload: the whole canonical list with every setting.
  {
    name: 'both accept the 60-car sample with every setting written out',
    data: createDetailedTowerData(createSampleEntries()),
    isValid: true,
  },
  // An item that binds the list and types nothing else.
  {
    name: 'both accept the entries alone',
    data: { entries: createSampleEntries() },
    isValid: true,
  },
  // A field the canonical shape gains later must not break the binding.
  {
    name: 'both accept an entry carrying a field the tower does not know',
    data: { entries: createSampleWithEntryChanged(0, 'sector2Ms', 91_002) },
    isValid: true,
  },
  // A car without a team name cannot be drawn.
  {
    name: 'both refuse an entry missing its team name',
    data: { entries: createSampleWithEntryChanged(1, 'teamName', undefined) },
    isValid: false,
  },
  // A status outside the six has no icon and no look.
  {
    name: 'both refuse a status the tower does not know',
    data: { entries: createSampleWithEntryChanged(2, 'status', 'parked') },
    isValid: false,
  },
  // A count below zero is meaningless.
  {
    name: 'both refuse a negative refuel count',
    data: { entries: createSampleWithEntryChanged(0, 'fuelStops', -1) },
    isValid: false,
  },
  // A lapped car is at least one lap down, as in the canonical shape: a 0 would mean
  // "on the leader's lap", which is gapToLeaderMs's job.
  {
    name: 'both refuse a gap of zero laps',
    data: { entries: createSampleWithEntryChanged(2, 'gapToLeaderLaps', 0) },
    isValid: false,
  },
  // A layout outside compact and detailed.
  {
    name: 'both refuse a layout the tower does not have',
    data: { entries: createSampleEntries(), layout: 'wide' },
    isValid: false,
  },
  // A paging mode outside the two.
  {
    name: 'both refuse a paging mode the tower does not have',
    data: { entries: createSampleEntries(), paging: 'scroll' },
    isValid: false,
  },
  // A typo'd top-level field must fail both.
  {
    name: 'both refuse a top-level field the tower does not know',
    data: { entries: createSampleEntries(), showGaps: true },
    isValid: false,
  },
  // The one required field left out.
  {
    name: 'both refuse data without the entries',
    data: { layout: 'compact' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(positionsTowerManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompletePositionsTowerData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
