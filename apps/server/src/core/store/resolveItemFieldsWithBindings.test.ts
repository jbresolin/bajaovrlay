/**
 * Resolving item fields that read from a data source (apps/server)
 *
 * What this module is for:
 *   At the take (and at a preview), resolveItemFieldsIntoGraphicData turns an item's
 *   fields into the data its graphic receives. A bound field reads its source's last good
 *   snapshot at its path, with the operator's overrides laid over it, then its transform.
 *   The resolver is pure: it is handed the moment, the sources with their snapshots and
 *   the overrides, and the graphic (for which fields are required, their titles, and the
 *   clock fields by role), and reads nothing itself. One field it cannot fill refuses the
 *   whole take (concept §5.1): never a half-rendered graphic.
 *
 * What these tests prove (the brief's table, the rows that resolve):
 *   - A literal and a binding together; a live and a frozen binding both read at the take.
 *   - A value absent on an optional field leaves the field out, like a cleared literal.
 *   - Overrides: a session field; a car's field that follows the car to another place;
 *     an override and then a transform.
 *   - The whole clock fills the four clock fields from one binding.
 *   - A car chosen by number picks that car's entry.
 *   - topN keeps the first entries of a list.
 *   - A stale source still resolves.
 *
 * What these tests deliberately do not cover:
 *   - The rows that refuse; resolveItemFieldsWithBindingsRefused.test.ts.
 *   - Literals and takeTime alone; resolveItemFields.test.ts.
 *   - Checking the data against the manifest schema; the take step does that after.
 *   - Each rule of reading a path and of the overrides; the shared tests cover them.
 */
import type {
  DataSnapshot,
  Graphic,
  ItemFields,
  Override,
  SourcesForBindings,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildCarOverride,
  buildLiveBindingToTheSimulatorSession,
  buildSessionNameOverride,
  buildSimulatorSourceThatIsOn,
  readSimulatorSnapshotAtLap34,
} from './reducers/boundItemSlices.testSupport.js';
import { resolveItemFieldsIntoGraphicData } from './resolveItemFields.js';
import {
  buildPositionsBinding,
  buildPositionsTowerGraphic,
  buildRaceClockGraphic,
  buildSourcesAtLap34,
  buildTypedEnduroClockFields,
  momentOfTheTake,
  readSnapshotWithCar42Leading,
  readTypedEnduroClockData,
} from './resolveItemFieldsWithBindings.testSupport.js';
import { buildEmptyLibrary } from './resolveItemFieldsWithEntities.testSupport.js';

describe('resolveItemFieldsIntoGraphicData with bindings that resolve', () => {
  const resolvedScenarios: Array<{
    name: string;
    graphic: Graphic;
    fields: ItemFields;
    overrides: Override[];
    snapshot?: DataSnapshot;
    expectedData: Record<string, unknown>;
  }> = [
    // A literal title beside a flag that follows the simulator.
    {
      name: 'reads a literal and a binding together',
      graphic: buildRaceClockGraphic(),
      fields: {
        ...buildTypedEnduroClockFields(),
        state: buildLiveBindingToTheSimulatorSession('state'),
      },
      overrides: [],
      expectedData: { ...readTypedEnduroClockData(), state: 'green' },
    },
    // At the take there is no difference: "congelado" only means no refresh afterwards.
    {
      name: 'reads a live and a frozen binding alike at the take',
      graphic: buildRaceClockGraphic(),
      fields: {
        ...buildTypedEnduroClockFields(),
        state: buildLiveBindingToTheSimulatorSession('state'),
        sessionName: { ...buildLiveBindingToTheSimulatorSession('sessionName'), isLive: false },
      },
      overrides: [],
      expectedData: {
        ...readTypedEnduroClockData(),
        state: 'green',
        sessionName: 'Enduro de Resistência',
      },
    },
    // The leader has no gap: the clock's optional laps field is left out, as cleared.
    {
      name: 'leaves out an optional field whose bound value is absent',
      graphic: buildRaceClockGraphic(),
      fields: {
        ...buildTypedEnduroClockFields(),
        lapsCompletedByLeader: buildPositionsBinding('entries.0.gapToLeaderLaps'),
      },
      overrides: [],
      expectedData: readTypedEnduroClockData(),
    },
    // The organisers renamed the session; the correction reaches the title.
    {
      name: 'shows a corrected session name',
      graphic: buildRaceClockGraphic(),
      fields: {
        ...buildTypedEnduroClockFields(),
        sessionName: buildLiveBindingToTheSimulatorSession('sessionName'),
      },
      overrides: [buildSessionNameOverride('Enduro — Etapa Nacional')],
      expectedData: { ...readTypedEnduroClockData(), sessionName: 'Enduro — Etapa Nacional' },
    },
    // Car 42 now leads: the 1st place reads its corrected name, because the correction
    // belongs to the car and not to the 19th place it held when it was typed.
    {
      name: 'follows a car correction to the car new place',
      graphic: buildPositionsTowerGraphic(),
      fields: {
        title: buildPositionsBinding('entries.0.teamName'),
        entries: { kind: 'literal', value: [] },
      },
      overrides: [buildCarOverride(42, 'teamName', 'Jequitibá Racing Team')],
      snapshot: readSnapshotWithCar42Leading(),
      expectedData: { title: 'Jequitibá Racing Team', entries: [] },
    },
    // The correction is laid first, then the transform shortens it to fit.
    {
      name: 'applies a transform to the corrected value',
      graphic: buildPositionsTowerGraphic(),
      fields: {
        title: { kind: 'literal', value: 'Carro 42' },
        entries: { kind: 'literal', value: [] },
        leaderSchool: buildPositionsBinding('entryOfCar.schoolName', {
          carNumber: 42,
          transformId: 'shortenSchoolName',
          transformParameters: { maxLength: 24 },
        }),
      },
      overrides: [
        buildCarOverride(
          42,
          'schoolName',
          'Centro Federal de Educação Tecnológica de Minas Gerais',
        ),
      ],
      expectedData: { title: 'Carro 42', entries: [], leaderSchool: 'Centro Federal de…' },
    },
    // "Relógio da fonte": one binding on the time field fills all four clock fields.
    {
      name: 'fills the four clock fields from the whole clock',
      graphic: buildRaceClockGraphic(),
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: buildLiveBindingToTheSimulatorSession('state'),
        referenceTimeMs: buildLiveBindingToTheSimulatorSession('clock'),
      },
      overrides: [],
      expectedData: {
        sessionName: 'Enduro de Resistência',
        state: 'green',
        clockMode: 'remaining',
        referenceTimeMs: 4_559_052,
        referenceWallClockMs: 1_805_568_240_948,
        running: true,
      },
    },
    // A team card that follows car 42 reads car 42, not the 19th place by chance.
    {
      name: 'reads car 42 chosen by its number',
      graphic: buildPositionsTowerGraphic(),
      fields: {
        title: buildPositionsBinding('entryOfCar.teamName', { carNumber: 42 }),
        entries: { kind: 'literal', value: [] },
      },
      overrides: [],
      snapshot: readSnapshotWithCar42Leading(),
      expectedData: { title: 'Jequitibá Racing', entries: [] },
    },
  ];

  it.each(resolvedScenarios)('$name', ({ graphic, fields, overrides, snapshot, expectedData }) => {
    // Arrange: the simulator at lap 34 (or the snapshot of this row) and its overrides.
    const sources = buildSourcesAtLap34(overrides, snapshot);

    // Act: resolve the fields at the take.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic,
      momentOfTheTake,
      sources,
      entities: buildEmptyLibrary(),
    });

    // Assert: exactly this data for the graphic.
    expect(resolution, 'the fields must resolve to this data').toMatchObject({
      status: 'resolved',
      data: expectedData,
    });
    expect(
      resolution.status === 'resolved' ? Object.keys(resolution.data).sort() : [],
      'no other field may appear',
    ).toEqual(Object.keys(expectedData).sort());
  });

  it('keeps the first six cars of the positions for the tower', () => {
    // Arrange: a tower bound to the whole list, top six.
    const fields: ItemFields = {
      title: { kind: 'literal', value: 'Classificação' },
      entries: buildPositionsBinding('entries', {
        transformId: 'topN',
        transformParameters: { n: 6 },
      }),
    };

    // Act: resolve at the take.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildPositionsTowerGraphic(),
      momentOfTheTake,
      sources: buildSourcesAtLap34([]),
      entities: buildEmptyLibrary(),
    });

    // Assert: six cars, the leader first and car 47 (6th) last.
    const cars =
      resolution.status === 'resolved'
        ? (resolution.data.entries as Array<{ carNumber: number }>)
        : [];
    expect(
      cars.map((car) => car.carNumber),
      'the first six cars in order',
    ).toEqual([31, 38, 25, 78, 52, 47]);
  });

  it('reads the snapshot of a stale source', () => {
    // Arrange: the simulator late (its last poll failed), its lap-34 data kept.
    const staleSimulator = buildSimulatorSourceThatIsOn();
    staleSimulator.status = {
      ...staleSimulator.status,
      isStale: true,
      lastError: 'Tempo esgotado',
    };
    const sources: SourcesForBindings = {
      dataSources: [staleSimulator],
      dataSnapshots: [readSimulatorSnapshotAtLap34()],
      overrides: [],
      bracketMatchFocuses: [],
    };

    // Act: resolve the bound flag.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields: {
        ...buildTypedEnduroClockFields(),
        state: buildLiveBindingToTheSimulatorSession('state'),
      },
      graphic: buildRaceClockGraphic(),
      momentOfTheTake,
      sources,
      entities: buildEmptyLibrary(),
    });

    // Assert: read like any other; a stale source never blocks a take (concept §5.4).
    expect(resolution, 'a stale source must still resolve').toMatchObject({
      status: 'resolved',
      data: { state: 'green' },
    });
  });
});
