/**
 * Positions tower data model (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   The tower shows a list of cars (`entries`, the canonical positions entries) under a
 *   handful of settings: the layout, which detailed columns are on, and how pages are
 *   handled. The renderer sends the whole object to `load` and then partial changes to
 *   `updateAction` (a live binding sends a new `entries` about every 2 s). This module
 *   checks that data, merges partial changes in, applies the defaults of the settings
 *   left out, and explains in pt-BR what is wrong when the data is bad, so the graphic
 *   can answer 400 instead of throwing.
 *
 * What these tests prove:
 *   - Complete, correct data is accepted as it is, and a canonical entry carrying a field
 *     the tower does not know passes as is (the shape may gain fields later).
 *   - Data missing `entries`, an entry missing a required field, a bad status, a negative
 *     count, a bad layout, or a top-level field the tower does not know is refused with a
 *     pt-BR message naming the field (the entry's index and field for a bad entry).
 *   - A partial update changes only the fields it carries and keeps the rest; a bad one
 *     is refused and leaves nothing half-applied.
 *   - The settings read from data apply the manifest's defaults for whatever is left out:
 *     compact, every detailed column on except the refuels, pages cycling.
 *
 * What these tests deliberately do not cover:
 *   - That the manifest's JSON Schema agrees with these rules;
 *     positionsTowerManifestDataAgreement.test.ts runs the same payloads through both.
 *   - What the component answers on the wire (status codes); positions-tower.test.ts does.
 */
import { describe, expect, it } from 'vitest';

import {
  mergePartialUpdateIntoPositionsTowerData,
  parseCompletePositionsTowerData,
  type PositionsTowerData,
  readTowerSettings,
  type TowerEntry,
} from './positionsTowerModel.js';

/** The top three of the enduro at lap 34: the leader, a car 19 s behind and a lapped car. */
function createTopThreeEntries(): TowerEntry[] {
  return [
    {
      position: 1,
      carNumber: 31,
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      laps: 34,
      lastLapMs: 278_293,
      bestLapMs: 278_291,
      pitStops: 2,
      fuelStops: 2,
      status: 'running',
    },
    {
      position: 2,
      carNumber: 38,
      teamName: 'Coruja Racing',
      schoolName: 'EESC-USP',
      laps: 34,
      lastLapMs: 283_550,
      bestLapMs: 279_596,
      gapToLeaderMs: 19_087,
      intervalMs: 19_087,
      pitStops: 2,
      fuelStops: 2,
      status: 'running',
    },
    {
      position: 3,
      carNumber: 25,
      teamName: 'Bem-te-vi Off-Road',
      schoolName: 'UFES',
      laps: 33,
      lastLapMs: 284_337,
      bestLapMs: 284_063,
      gapToLeaderLaps: 1,
      intervalMs: 41_372,
      pitStops: 2,
      fuelStops: 2,
      status: 'running',
    },
  ];
}

/** Builds the data an item sends with every setting written out. */
function createDetailedTowerData(): PositionsTowerData {
  return {
    entries: createTopThreeEntries(),
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

describe('parseCompletePositionsTowerData', () => {
  it('accepts complete, correct data unchanged', () => {
    // Arrange: the top three with every setting written out.
    const towerData = createDetailedTowerData();

    // Act: check it as `load` does.
    const result = parseCompletePositionsTowerData(towerData);

    // Assert: it is valid and comes back exactly as sent.
    expect(result, 'correct data must be accepted exactly as sent').toEqual({
      isValid: true,
      data: towerData,
    });
  });

  it('accepts data with the entries alone, every setting left out', () => {
    // Arrange: an item that binds the list and types nothing else.
    const entriesOnly = { entries: createTopThreeEntries() };

    // Act: check it as `load` does.
    const result = parseCompletePositionsTowerData(entriesOnly);

    // Assert: every setting really is optional.
    expect(result.isValid, 'data with the entries alone must be valid').toBe(true);
  });

  it('accepts an entry carrying a field the tower does not know, as the shape may gain one', () => {
    // Arrange: a canonical entry with a field a later shape added.
    const [leader, ...others] = createTopThreeEntries();
    const entriesWithAnExtraField = [{ ...leader, sector2Ms: 91_002 }, ...others];

    // Act: check it as `load` does.
    const result = parseCompletePositionsTowerData({ entries: entriesWithAnExtraField });

    // Assert: accepted, so a binding to the canonical list never breaks on a new field.
    expect(result.isValid, 'an extra field on an entry must pass').toBe(true);
  });

  const refusedDataScenarios = [
    {
      // The one required field left out.
      name: 'refuses data without the entries',
      data: { layout: 'compact' },
      expectedProblem: 'Falta o campo obrigatório "entries".',
    },
    {
      // A source that forgot a car's team: the message points at the entry and its field.
      name: 'refuses an entry missing its team name, naming the entry',
      data: {
        entries: createTopThreeEntries().map((entry, index) =>
          index === 1 ? { ...entry, teamName: undefined } : entry,
        ),
      },
      expectedProblem: 'Falta o campo obrigatório "entries[1].teamName".',
    },
    {
      // A status outside the six the tower draws.
      name: 'refuses a status the tower does not know',
      data: {
        entries: createTopThreeEntries().map((entry, index) =>
          index === 2 ? { ...entry, status: 'parked' } : entry,
        ),
      },
      expectedProblem: 'Valor inválido no campo "entries[2].status".',
    },
    {
      // A count below zero is meaningless.
      name: 'refuses a negative refuel count',
      data: {
        entries: createTopThreeEntries().map((entry, index) =>
          index === 0 ? { ...entry, fuelStops: -1 } : entry,
        ),
      },
      expectedProblem: 'Valor inválido no campo "entries[0].fuelStops".',
    },
    {
      // A layout outside compact and detailed.
      name: 'refuses a layout the tower does not have',
      data: { entries: createTopThreeEntries(), layout: 'wide' },
      expectedProblem: 'Valor inválido no campo "layout".',
    },
    {
      // A typo in a top-level field name would otherwise be silently ignored.
      name: 'refuses a top-level field the tower does not know, such as a typo',
      data: { entries: createTopThreeEntries(), showGaps: true },
      expectedProblem: 'Campo desconhecido nos dados: "showGaps".',
    },
    {
      // Something that is not an object at all, such as the bare list.
      name: 'refuses something that is not a data object',
      data: createTopThreeEntries(),
      expectedProblem: 'Dados inválidos: era esperado um objeto com os dados da torre.',
    },
  ];

  it.each(refusedDataScenarios)('$name', ({ data, expectedProblem }) => {
    // Arrange: the bad data comes from the scenario row above.

    // Act: check it as `load` does.
    const result = parseCompletePositionsTowerData(data);

    // Assert: it is refused with a pt-BR message that names the problem.
    expect(result, 'bad data must be refused with a pt-BR message naming the field').toEqual({
      isValid: false,
      problem: expectedProblem,
    });
  });
});

describe('mergePartialUpdateIntoPositionsTowerData', () => {
  it('replaces the entries and keeps every setting when a live refresh sends the list', () => {
    // Arrange: the detailed tower on air; the binding sends the list after a swap.
    const currentData = createDetailedTowerData();
    const [leader, second, third] = createTopThreeEntries();
    const swappedEntries = [leader, { ...third, position: 2 }, { ...second, position: 3 }];

    // Act: merge the one-field update into the current data.
    const result = mergePartialUpdateIntoPositionsTowerData(currentData, {
      entries: swappedEntries,
    });

    // Assert: only the entries changed; layout, columns and paging are untouched.
    expect(result, 'a refresh must change the entries and nothing else').toEqual({
      isValid: true,
      data: { ...createDetailedTowerData(), entries: swappedEntries },
    });
  });

  it('changes the layout alone when "Atualizar no ar" sends it', () => {
    // Arrange: the detailed tower; the operator switches to compact.
    const currentData = createDetailedTowerData();

    // Act: merge the layout change.
    const result = mergePartialUpdateIntoPositionsTowerData(currentData, { layout: 'compact' });

    // Assert: the layout changed, the entries and the other settings stayed.
    expect(result, 'a layout update must keep the entries and the columns').toEqual({
      isValid: true,
      data: { ...createDetailedTowerData(), layout: 'compact' },
    });
  });

  it('refuses a bad update and leaves the current data untouched', () => {
    // Arrange: an update with a good field and a misspelled paging mode, so a merge that
    // applied fields one by one would leave a half-update.
    const currentData = createDetailedTowerData();
    const misspelledUpdate = { showGap: false, paging: 'alternar' };

    // Act: try to merge it.
    const result = mergePartialUpdateIntoPositionsTowerData(currentData, misspelledUpdate);

    // Assert: refused with a pt-BR message; the current data was not changed.
    expect(result, 'a bad update must be refused with a pt-BR message').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "paging".',
    });
    expect(currentData, 'a refused update must not apply even its good fields').toEqual(
      createDetailedTowerData(),
    );
  });
});

describe('readTowerSettings', () => {
  it('applies the manifest defaults to every setting left out', () => {
    // Arrange: data with the entries alone.
    const entriesOnly = { entries: createTopThreeEntries() };

    // Act: read the settings the tower draws with.
    const settings = readTowerSettings(entriesOnly);

    // Assert: compact, the default detailed columns (the refuels off), pages cycling.
    expect(settings, 'a setting left out must take the manifest default').toEqual({
      layout: 'compact',
      showGap: true,
      showInterval: true,
      showLastLap: true,
      showBestLap: true,
      showPitStops: true,
      showFuelStops: false,
      showStatus: true,
      paging: 'cycle',
    });
  });

  it('keeps every setting that is written out', () => {
    // Arrange: a detailed tower with the times off and the refuels on, holding page 1.
    const towerData: PositionsTowerData = {
      ...createDetailedTowerData(),
      showGap: false,
      showInterval: false,
      showLastLap: false,
      showBestLap: false,
      showFuelStops: true,
      paging: 'firstPageOnly',
    };

    // Act: read the settings.
    const settings = readTowerSettings(towerData);

    // Assert: what was written out is what the tower draws with.
    expect(settings, 'a setting written out must be kept as written').toEqual({
      layout: 'detailed',
      showGap: false,
      showInterval: false,
      showLastLap: false,
      showBestLap: false,
      showPitStops: true,
      showFuelStops: true,
      showStatus: true,
      paging: 'firstPageOnly',
    });
  });
});
