/**
 * What "Edição rápida" is doing right now (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" either edits ONE instance, loaded by a "Camadas" row's "Editar" (or
 *   "Editar prévia"), or has nothing loaded (since BAJAOVRLAY-37 it makes no new entry:
 *   a new graphic is a new item). The panel
 *   remembers the instance it was told to edit (its id, graphic, layer and output); this
 *   pure function looks that id up in the server's instances slice and says which of the
 *   two the panel is doing. When the instance is no longer there, the panel has nothing
 *   loaded and says why in one line: the instance left its output, or another
 *   instance replaced it on the same layer and output. It never moves to that other
 *   instance by itself.
 *
 * What these tests prove:
 *   - With nothing loaded the panel has nothing loaded and nothing to report.
 *   - A loaded instance still in the slice is edited, in its newest copy from the server.
 *   - A loaded instance that left its output gives "nothing loaded" with "left"; one replaced
 *     by another instance on the same layer and output gives "replaced", on program and
 *     on preview alike.
 *   - An instance on the OTHER output of the same layer is not a replacement.
 *   - A loaded instance whose graphic the server no longer lists gives "nothing loaded" with
 *     "graphic no longer listed": the form is made from that graphic's manifest.
 *   - Once the panel has written down what became of its instance (`lossAsFirstSeen`),
 *     that is what it says, whatever comes to the layer afterwards.
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
  graphicsListed: string[];
  expectedMode: QuickEditMode;
}> = [
  // The page has just opened, or the operator pressed "Nova entrada": nothing is loaded.
  {
    name: 'has nothing loaded and nothing to report when no instance was loaded',
    target: null,
    instances: [buildRaceClockInstance(idOfTheClockOnAir, 'program')],
    graphicsListed: ['race-clock'],
    expectedMode: { kind: 'nothingLoaded', lostTarget: undefined },
  },
  // The everyday case: the clock loaded from its row is still on air.
  {
    name: 'edits the loaded instance while it is still on its output',
    target: buildTargetOfTheClock('program'),
    instances: [buildRaceClockInstance(idOfTheClockOnAir, 'program')],
    graphicsListed: ['race-clock'],
    expectedMode: {
      kind: 'editingInstance',
      instanceBeingEdited: buildRaceClockInstance(idOfTheClockOnAir, 'program'),
    },
  },
  // Someone pressed "Limpar" on the clock layer: the clock left the air.
  {
    name: 'lets go of it, "left", when the loaded instance left the air',
    target: buildTargetOfTheClock('program'),
    instances: [],
    graphicsListed: ['race-clock'],
    expectedMode: {
      kind: 'nothingLoaded',
      lostTarget: { layerId: 'clock', output: 'program', whatHappened: 'left' },
    },
  },
  // A take from the rundown put another clock on the same layer: a new id, so a new
  // instance, which the panel must not start editing on its own.
  {
    name: 'lets go of it, "replaced", when another instance took its place on air',
    target: buildTargetOfTheClock('program'),
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'program')],
    graphicsListed: ['race-clock'],
    expectedMode: {
      kind: 'nothingLoaded',
      lostTarget: { layerId: 'clock', output: 'program', whatHappened: 'replaced' },
    },
  },
  // A preview on the same layer is not on air, so it does not replace what was on air.
  {
    name: 'says "left", not "replaced", when only a preview is on that layer now',
    target: buildTargetOfTheClock('program'),
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'preview')],
    graphicsListed: ['race-clock'],
    expectedMode: {
      kind: 'nothingLoaded',
      lostTarget: { layerId: 'clock', output: 'program', whatHappened: 'left' },
    },
  },
  // The previewed clock was taken or discarded: the preview output of the layer is empty.
  {
    name: 'lets go of it, "left", when the loaded preview left the preview output',
    target: buildTargetOfTheClock('preview'),
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'program')],
    graphicsListed: ['race-clock'],
    expectedMode: {
      kind: 'nothingLoaded',
      lostTarget: { layerId: 'clock', output: 'preview', whatHappened: 'left' },
    },
  },
  // Someone previewed another item on the same layer: a new preview took its place.
  {
    name: 'lets go of it, "replaced", when another preview took its place',
    target: buildTargetOfTheClock('preview'),
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'preview')],
    graphicsListed: ['race-clock'],
    expectedMode: {
      kind: 'nothingLoaded',
      lostTarget: { layerId: 'clock', output: 'preview', whatHappened: 'replaced' },
    },
  },
  // The clock left the air and the panel wrote that down when it first saw it; a take
  // made later on the same layer did not replace the edited clock, which was gone by
  // then, so the line must keep saying "left".
  {
    name: 'keeps saying "left" as first seen, although another instance came to that layer later',
    target: {
      ...buildTargetOfTheClock('program'),
      lossAsFirstSeen: { layerId: 'clock', output: 'program', whatHappened: 'left' },
    },
    instances: [buildRaceClockInstance(idOfTheClockThatReplacedIt, 'program')],
    graphicsListed: ['race-clock'],
    expectedMode: {
      kind: 'nothingLoaded',
      lostTarget: { layerId: 'clock', output: 'program', whatHappened: 'left' },
    },
  },
  // The server stopped listing the race clock (its package was removed and the server
  // restarted): its form cannot be drawn, so the panel lets go of the clock and says why,
  // although the clock is still on air.
  {
    name: 'lets go of it, "graphic no longer listed", when its graphic is gone',
    target: buildTargetOfTheClock('program'),
    instances: [buildRaceClockInstance(idOfTheClockOnAir, 'program')],
    graphicsListed: ['team-lower-third'],
    expectedMode: {
      kind: 'nothingLoaded',
      lostTarget: { layerId: 'clock', output: 'program', whatHappened: 'graphicNoLongerListed' },
    },
  },
];

describe('what "Edição rápida" is doing', () => {
  it.each(modeScenarios)('$name', ({ target, instances, graphicsListed, expectedMode }) => {
    // Arrange: what the panel remembers, the instances and the graphic ids the server
    // lists (the row's data).

    // Act: work out the mode.
    const mode = findQuickEditMode(target, instances, graphicsListed);

    // Assert: the panel edits the instance, or has nothing loaded and says why.
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
    const mode = findQuickEditMode(
      buildTargetOfTheClock('program'),
      [clockAfterTheOtherOperatorsChange],
      ['race-clock'],
    );

    // Assert: the panel works on the copy holding the yellow flag.
    expect(mode, 'the panel must edit what is on air now, not what was loaded').toEqual({
      kind: 'editingInstance',
      instanceBeingEdited: clockAfterTheOtherOperatorsChange,
    });
  });
});
