/**
 * What "Edição rápida" is doing right now (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" either edits ONE instance, loaded by a "Camadas" row's "Editar" (or
 *   "Editar prévia"), or makes a new entry that changes no instance and no item. The panel
 *   remembers the instance it was told to edit (its id, graphic, layer and output); this
 *   pure function looks that id up in the server's instances slice and says which of the
 *   two the panel is doing. When the instance is no longer there, the panel goes back to
 *   making a new entry and says why in one line: the instance left its output, or another
 *   instance replaced it on the same layer and output. It never moves to that other
 *   instance by itself.
 *
 * What these tests prove:
 *   - With nothing loaded the panel makes a new entry and has nothing to report.
 *   - A loaded instance still in the slice is edited, in its newest copy from the server.
 *   - A loaded instance that left its output gives a new entry with "left"; one replaced
 *     by another instance on the same layer and output gives "replaced", on program and
 *     on preview alike.
 *   - An instance on the OTHER output of the same layer is not a replacement.
 *
 * What these tests deliberately do not cover:
 *   - The words of the line and of the header: QuickEditPanelTarget.test.tsx.
 *   - How a row's "Editar" loads an instance: QuickEditPanelTarget.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { findQuickEditMode, type QuickEditMode, type QuickEditTarget } from './quickEditMode';

// Saturday of the endurance race: the clock on the "Relógio" layer went on air at 10:00.
const momentTheClockWentOnAir = '2026-10-10T13:00:00.000Z';
const idOfTheClockOnAir = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';
const idOfTheClockThatReplacedIt = 'a90c2e61-1f4b-4d7e-b3a8-6c5d4e3f2a10';

/** A race clock instance on the "Relógio" layer, on this output, with this id. */
function buildRaceClockInstance(instanceId: string, output: Instance['target']): Instance {
  return {
    id: instanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: output,
    resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
    currentStep: 0,
    status: output === 'program' ? 'on-air' : 'loading',
    takenAt: momentTheClockWentOnAir,
  };
}

/** What the panel remembers after "Editar" on the clock row (or "Editar prévia"). */
function buildTargetOfTheClock(output: Instance['target']): QuickEditTarget {
  return { instanceId: idOfTheClockOnAir, graphicId: 'race-clock', layerId: 'clock', output };
}

const modeScenarios: Array<{
  name: string;
  target: QuickEditTarget | null;
  instances: Instance[];
  expectedMode: QuickEditMode;
}> = [
  // The page has just opened, or the operator pressed "Nova entrada": nothing is loaded.
  {
    name: 'makes a new entry with nothing to report when nothing is loaded',
    target: null,
    instances: [buildRaceClockInstance(idOfTheClockOnAir, 'program')],
    expectedMode: { kind: 'newTake', lostTarget: undefined },
  },
  // The everyday case: the clock loaded from its row is still on air.
  {
    name: 'edits the loaded instance while it is still on its output',
    target: buildTargetOfTheClock('program'),
    instances: [buildRaceClockInstance(idOfTheClockOnAir, 'program')],
    expectedMode: {
      kind: 'editingInstance',
      instanceBeingEdited: buildRaceClockInstance(idOfTheClockOnAir, 'program'),
    },
  },
  // Someone pressed "Limpar" on the clock layer: the clock left the air.
  {
    name: 'goes back to a new entry, "left", when the loaded instance left the air',
    target: buildTargetOfTheClock('program'),
    instances: [],
    expectedMode: {
      kind: 'newTake',
      lostTarget: { layerId: 'clock', output: 'program', wasReplaced: false },
    },
  },
  // A take from the rundown put another clock on the same layer: a new id, so a new
  // instance, which the panel must not start editing on its own.
  {
    name: 'goes back to a new entry, "replaced", when another instance took its place on air',
    target: buildTargetOfTheClock('program'),
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'program')],
    expectedMode: {
      kind: 'newTake',
      lostTarget: { layerId: 'clock', output: 'program', wasReplaced: true },
    },
  },
  // A preview on the same layer is not on air, so it does not replace what was on air.
  {
    name: 'says "left", not "replaced", when only a preview is on that layer now',
    target: buildTargetOfTheClock('program'),
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'preview')],
    expectedMode: {
      kind: 'newTake',
      lostTarget: { layerId: 'clock', output: 'program', wasReplaced: false },
    },
  },
  // The previewed clock was taken or discarded: the preview output of the layer is empty.
  {
    name: 'goes back to a new entry, "left", when the loaded preview left the preview output',
    target: buildTargetOfTheClock('preview'),
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'program')],
    expectedMode: {
      kind: 'newTake',
      lostTarget: { layerId: 'clock', output: 'preview', wasReplaced: false },
    },
  },
  // Someone previewed another item on the same layer: a new preview took its place.
  {
    name: 'goes back to a new entry, "replaced", when another preview took its place',
    target: buildTargetOfTheClock('preview'),
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'preview')],
    expectedMode: {
      kind: 'newTake',
      lostTarget: { layerId: 'clock', output: 'preview', wasReplaced: true },
    },
  },
];

describe('what "Edição rápida" is doing', () => {
  it.each(modeScenarios)('$name', ({ target, instances, expectedMode }) => {
    // Arrange: what the panel remembers and what the server lists (the row's data).

    // Act: work out the mode.
    const mode = findQuickEditMode(target, instances);

    // Assert: the panel edits the instance, or makes a new entry and says why.
    expect(mode, 'the mode must follow the loaded instance, and only that one').toEqual(
      expectedMode,
    );
  });

  it('edits the newest copy the server sent of the loaded instance', () => {
    // Arrange: another operator changed the flag of the loaded clock on air.
    const clockAfterTheOtherOperatorsChange: Instance = {
      ...buildRaceClockInstance(idOfTheClockOnAir, 'program'),
      resolvedData: { sessionName: 'Enduro de Resistência', state: 'yellow' },
    };

    // Act: work out the mode from the newer slice.
    const mode = findQuickEditMode(buildTargetOfTheClock('program'), [
      clockAfterTheOtherOperatorsChange,
    ]);

    // Assert: the panel works on the copy holding the yellow flag.
    expect(mode, 'the panel must edit what is on air now, not what was loaded').toEqual({
      kind: 'editingInstance',
      instanceBeingEdited: clockAfterTheOtherOperatorsChange,
    });
  });
});
