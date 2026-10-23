/**
 * The bindings a manifest suggests for a new item (apps/control)
 *
 * What this module is for:
 *   A graphic's manifest may say, on a property, where its value usually comes from:
 *   `v_baja.suggestedBinding: { shapeKey, path, isLive }` (packages/graphics/README.md).
 *   The item editor pre-fills that field's "Fonte" for a new item when exactly one
 *   enabled source has that shape in its last good data, so the operator does not pick
 *   the same source and path for every tower. With no such source, or with two, nothing
 *   is pre-filled: guessing between sources would put the wrong race on air.
 *
 * What these tests prove:
 *   - With exactly one enabled source holding positions, the cars get a live binding to
 *     that source's whole positions list, with no transform.
 *   - With two enabled sources holding positions, nothing is pre-filled.
 *   - With the one source holding positions turned off, nothing is pre-filled.
 *   - With the one enabled source having no data yet, or data without positions,
 *     nothing is pre-filled.
 *   - A hint the server would refuse at the save (not an object, an unknown shape, a
 *     path not offered, a path that needs a car number, a value that does not fit the
 *     field) is ignored, and never throws.
 *
 * What these tests deliberately do not cover:
 *   - Filling the form with the pre-filled binding and saving it: the item editor's
 *     ItemEditorPanelSuggestedBinding.test.tsx.
 *   - A source's `isEnabled`, snapshots and shapes themselves: packages/shared.
 */
import type { DataSnapshot, DataSource } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSnapshotAtLap34,
  buildRehearsalReplayThatIsOk,
  buildSeededSimulatorThatIsOff,
  buildSimulatorThatIsOk,
  rehearsalReplayId,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  buildPositionsTowerFixtureDataSchema,
  buildPositionsTowerFixtureDataSchemaWithHint,
} from './positionsTowerFixtureSchema.testSupport';
import { buildSuggestedBindingsForNewItem } from './suggestedBindingsOfDataSchema';

/** The simulator's last data with the session only: it sent no positions. */
function buildSnapshotWithTheSessionOnly(sourceId: string): DataSnapshot {
  const snapshotAtLap34 = buildEnduroSnapshotAtLap34(sourceId);
  return { ...snapshotAtLap34, shapes: { session: snapshotAtLap34.shapes.session } };
}

/** The binding the tower's hint makes on the simulator: its whole positions list, live. */
function buildLiveBindingToTheSimulatorPositions() {
  return {
    kind: 'binding',
    sourceId: seededSimulatorId,
    shapeKey: 'positions',
    path: 'entries',
    isLive: true,
  };
}

describe('buildSuggestedBindingsForNewItem, with the tower hint', () => {
  it('pre-fills the cars with the one enabled source that has positions, live and with no transform', () => {
    // Arrange: the simulator on, with its lap-34 data, and nothing else.
    const sources = {
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    };

    // Act: read what the tower's schema suggests against those sources.
    const suggestedBindings = buildSuggestedBindingsForNewItem(
      buildPositionsTowerFixtureDataSchema(),
      sources,
    );

    // Assert: the cars read the simulator's whole positions list, live, as they are.
    expect(suggestedBindings, 'the cars must be pre-filled from the simulator').toEqual({
      entries: buildLiveBindingToTheSimulatorPositions(),
    });
  });

  const sourcesWithNoSingleAnswer: Array<{
    name: string;
    dataSources: DataSource[];
    dataSnapshots: DataSnapshot[];
  }> = [
    // Two sources with positions: choosing one would be a guess.
    {
      name: 'two enabled sources have positions',
      dataSources: [buildSimulatorThatIsOk(), buildRehearsalReplayThatIsOk()],
      dataSnapshots: [
        buildEnduroSnapshotAtLap34(seededSimulatorId),
        buildEnduroSnapshotAtLap34(rehearsalReplayId),
      ],
    },
    // The only source with positions is off: nothing would reach the air from it.
    {
      name: 'the one source with positions is turned off',
      dataSources: [buildSeededSimulatorThatIsOff()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    },
    // The source is on but never polled: it is not known to produce positions yet.
    {
      name: 'the one enabled source has no data yet',
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [],
    },
    // The source sends the session only: positions are not among its shapes.
    {
      name: 'the one enabled source has data without positions',
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildSnapshotWithTheSessionOnly(seededSimulatorId)],
    },
    // No source at all: a fresh server before the operator turned anything on.
    { name: 'there is no source at all', dataSources: [], dataSnapshots: [] },
  ];

  it.each(sourcesWithNoSingleAnswer)(
    'pre-fills nothing when $name',
    ({ dataSources, dataSnapshots }) => {
      // Arrange: the sources of this row.
      const sources = { dataSources, dataSnapshots };

      // Act: read what the tower's schema suggests against them.
      const suggestedBindings = buildSuggestedBindingsForNewItem(
        buildPositionsTowerFixtureDataSchema(),
        sources,
      );

      // Assert: nothing; the form opens plain.
      expect(suggestedBindings, 'without exactly one source nothing is pre-filled').toEqual({});
    },
  );
});

describe('buildSuggestedBindingsForNewItem, with a hint the manifest got wrong', () => {
  const wrongHints = [
    // The hint is not even an object.
    { name: 'a hint written as a text', hint: 'positions.entries' },
    // A shape the canonical data does not have.
    {
      name: 'a shape nobody produces',
      hint: { shapeKey: 'placar', path: 'entries', isLive: true },
    },
    // A path the picker does not list for the shape.
    {
      name: 'a path not offered for the shape',
      hint: { shapeKey: 'positions', path: 'entries.99.teamName', isLive: true },
    },
    // A path that follows a car by number, which a hint cannot name.
    {
      name: 'a path that needs a car number',
      hint: { shapeKey: 'positions', path: 'entryOfCar.teamName', isLive: true },
    },
    // A value of the wrong type for the field: one team's name on a list field.
    {
      name: 'a value that does not fit the field',
      hint: { shapeKey: 'positions', path: 'entries.0.teamName', isLive: true },
    },
    // "Live" left out: the editor must not decide that for the manifest.
    { name: 'a hint without isLive', hint: { shapeKey: 'positions', path: 'entries' } },
  ];

  it.each(wrongHints)('ignores $name', ({ hint }) => {
    // Arrange: the simulator on with its lap-34 data, so only the hint can be at fault.
    const sources = {
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    };

    // Act: read what a tower schema carrying this hint suggests.
    const suggestedBindings = buildSuggestedBindingsForNewItem(
      buildPositionsTowerFixtureDataSchemaWithHint(hint),
      sources,
    );

    // Assert: nothing, and no error: a manifest's mistake never stops the editor.
    expect(suggestedBindings, 'a wrong hint must be ignored, not shown').toEqual({});
  });

  it('suggests nothing for a graphic without a data schema', () => {
    // Arrange: the simulator on with its data, and a graphic that takes no data.
    const sources = {
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    };

    // Act: read what no schema suggests.
    const suggestedBindings = buildSuggestedBindingsForNewItem(undefined, sources);

    // Assert: nothing.
    expect(suggestedBindings, 'no schema, no suggestion').toEqual({});
  });
});
