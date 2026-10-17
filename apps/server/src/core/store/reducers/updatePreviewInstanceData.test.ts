/**
 * "Atualizar prévia", "Tomar" after it, and a new take of a changed item (apps/server)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-37 "Edição rápida" only edits what is already up. A preview it has
 *   loaded is changed with "Atualizar prévia", which is an updateInstanceData aimed at
 *   the preview instance's id: the preview keeps its id and its item, so what "Tomar"
 *   sends to air is exactly what was seen, item included. And a change on air lasts only
 *   as long as that instance: taking the item again shows what the item gives, with an
 *   empty list of changed fields.
 *
 * What these tests prove:
 *   - An updateInstanceData of a preview instance changes it in place: same id, still on
 *     the preview output, still carrying its item and origin, new data, and the field
 *     listed as changed on air. The program output is left alone.
 *   - "Tomar" after it promotes the edited data, with the item's id and the list of
 *     changed fields, so the chip "alterado no ar" shows on program at once.
 *   - A moment typed into a field the preview had stamped survives "Tomar": the field
 *     leaves the preview's list of fields to stamp again (gate 2 of PR #15).
 *   - An automatic preview the operator edited becomes one asked for by hand, so the next
 *     automatic preview does not throw the edit away (gate 2 of PR #15).
 *   - takeItem of an item whose instance was changed on air puts up a new instance with
 *     the item's own data and no list at all.
 *
 * What these tests deliberately do not cover:
 *   - Which fields go on the list; updateInstanceDataFieldsChangedOnAir.test.ts does.
 *   - The rest of takePreview (stamps, cursor); takePreview.test.ts and
 *     takePreviewCursor.test.ts do.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagClockOnProgram,
  buildStartItemOnPreviewWithItsMomentStamped,
  contextOfTheLaterTake,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroStartItem,
  buildRaceDaySlicesWithRundown,
  buildRaceDaySlicesWithTheRaceClockSchema,
  buildTeam42ShortcutItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

const previewInstanceId = 'f3d1b8a6-4c2e-4e9f-a7b5-0d6c2e8f1a39';

/** Builds "Tarja — Baja UFPR" on the preview output of the lower third, asked for by hand. */
function buildTeam42LowerThirdItemOnPreview(): Instance {
  return {
    id: previewInstanceId,
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'preview',
    resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T14:20:00.000Z',
    previewOrigin: 'manual',
    itemId: 'item-atalho-tarja-baja-ufpr',
  };
}

describe('"Atualizar prévia": updateInstanceData of a preview instance', () => {
  it('changes the preview in place, keeping its id, its output, its item and its origin', () => {
    // Arrange: the clock on air, and the team 42 lower third of its item in preview.
    const slices = buildRaceDaySlicesWithRundown({
      items: [buildTeam42ShortcutItem(0)],
      instances: [buildGreenFlagClockOnProgram(), buildTeam42LowerThirdItemOnPreview()],
    });

    // Act: the operator retypes the team's name and presses "Atualizar prévia".
    const outcome = reduceCommand(
      slices,
      {
        type: 'updateInstanceData',
        instanceId: previewInstanceId,
        data: { teamName: 'Baja UFPR Racing' },
        takeTimeFieldKeys: [],
      },
      contextOfTheRundownCommand,
    );

    // Assert: the same preview, with the new name and the field listed; program untouched.
    expect(outcome.status, 'a preview instance may be updated like one on air').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : [];
    expect(instancesAfter, 'the preview must be changed in place, the clock left alone').toEqual([
      buildGreenFlagClockOnProgram(),
      {
        ...buildTeam42LowerThirdItemOnPreview(),
        resolvedData: { teamNumber: 42, teamName: 'Baja UFPR Racing' },
        fieldsChangedOnAir: ['teamName'],
      },
    ]);
  });

  it('lets "Tomar" promote exactly the edited preview, its item and its list included', () => {
    // Arrange: the team 42 preview, already changed by "Atualizar prévia".
    const editedPreview: Instance = {
      ...buildTeam42LowerThirdItemOnPreview(),
      resolvedData: { teamNumber: 42, teamName: 'Baja UFPR Racing' },
      fieldsChangedOnAir: ['teamName'],
    };
    const slices = buildRaceDaySlicesWithRundown({
      items: [buildTeam42ShortcutItem(0)],
      instances: [editedPreview],
    });

    // Act: the operator presses "Tomar" on the lower third's line under Prévia.
    const outcome = reduceCommand(
      slices,
      { type: 'takePreview', layerId: 'lower-third' },
      contextOfTheLaterTake,
    );

    // Assert: on program now is the edited name, from the same item, still marked changed.
    expect(outcome.status, 'the edited preview must be taken').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : [];
    expect(instancesAfter, 'program must show what Prévia showed, and the preview is gone').toEqual(
      [
        {
          id: contextOfTheLaterTake.newInstanceId,
          layerId: 'lower-third',
          graphicId: 'team-lower-third',
          target: 'program',
          resolvedData: { teamNumber: 42, teamName: 'Baja UFPR Racing' },
          currentStep: 0,
          status: 'loading',
          takenAt: contextOfTheLaterTake.now,
          itemId: 'item-atalho-tarja-baja-ufpr',
          fieldsChangedOnAir: ['teamName'],
        },
      ],
    );
  });
});

describe('"Atualizar prévia" on fields the preview stamped, and on an automatic preview', () => {
  it('keeps a moment typed into a stamped field when "Tomar" sends the preview to air', () => {
    // Arrange: "Largada do enduro" in preview, its reference moment stamped at 14:32:05
    // and remembered as a field to stamp again at the take. The operator types the
    // official start, 14:00:00, into that field with "Atualizar prévia".
    const officialStartInMilliseconds = Date.parse('2026-10-09T14:00:00.000Z');
    let slices = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildEnduroStartItem(0)],
      instances: [buildStartItemOnPreviewWithItsMomentStamped()],
    });
    const update = reduceCommand(
      slices,
      {
        type: 'updateInstanceData',
        instanceId: buildStartItemOnPreviewWithItsMomentStamped().id,
        data: { referenceWallClockMs: officialStartInMilliseconds },
        takeTimeFieldKeys: [],
      },
      contextOfTheRundownCommand,
    );
    slices = update.status === 'applied' ? update.slices : slices;

    // Act: "Tomar" on the clock's line under Prévia, fifteen minutes later.
    const outcome = reduceCommand(
      slices,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheLaterTake,
    );

    // Assert: program holds the typed moment, not the moment of the take.
    expect(outcome.status, 'the edited preview must be taken').toBe('applied');
    const programClock =
      outcome.status === 'applied'
        ? outcome.slices.instances.find((instance) => instance.target === 'program')
        : undefined;
    expect(
      programClock?.resolvedData.referenceWallClockMs,
      'a moment the operator typed must not be stamped over at the take',
    ).toBe(officialStartInMilliseconds);
  });

  it('turns an edited automatic preview into one asked for by hand, which the next automatic preview keeps', () => {
    // Arrange: team 42's lower third previewed automatically ("Prévia automática"), and
    // its name changed with "Atualizar prévia".
    const automaticPreview: Instance = {
      ...buildTeam42LowerThirdItemOnPreview(),
      previewOrigin: 'auto',
    };
    let slices = buildRaceDaySlicesWithRundown({
      items: [buildTeam42ShortcutItem(0), buildEnduroStartItem(0)],
      instances: [automaticPreview],
    });
    const update = reduceCommand(
      slices,
      {
        type: 'updateInstanceData',
        instanceId: previewInstanceId,
        data: { teamName: 'Baja UFPR Racing' },
        takeTimeFieldKeys: [],
      },
      contextOfTheRundownCommand,
    );
    slices = update.status === 'applied' ? update.slices : slices;
    const originAfterTheEdit = slices.instances.find(
      (instance) => instance.id === previewInstanceId,
    )?.previewOrigin;

    // Act: the cursor moves on and "Prévia automática" previews the start of the enduro.
    const outcome = reduceCommand(
      slices,
      { type: 'previewItem', itemId: 'item-largada-do-enduro', origin: 'auto' },
      contextOfTheLaterTake,
    );

    // Assert: the edited preview was marked manual, and it is still there with its edit.
    expect(originAfterTheEdit, 'an edited automatic preview must become manual').toBe('manual');
    const editedPreviewAfter =
      outcome.status === 'applied'
        ? outcome.slices.instances.find((instance) => instance.id === previewInstanceId)
        : undefined;
    expect(
      editedPreviewAfter?.resolvedData.teamName,
      'the next automatic preview must not throw the operator’s edit away',
    ).toBe('Baja UFPR Racing');
  });
});

describe('a new take of an item whose instance was changed on air', () => {
  it('shows what the item gives again, with no list of changed fields', () => {
    // Arrange: team 42's lower third on air with its name changed on air.
    const changedOnAir: Instance = {
      id: 'a7e3c915-2d4b-4f68-9b1e-6c0d8f2a4e57',
      layerId: 'lower-third',
      graphicId: 'team-lower-third',
      target: 'program',
      resolvedData: { teamNumber: 42, teamName: 'Baja UFPR Racing' },
      currentStep: 0,
      status: 'on-air',
      takenAt: '2026-10-09T14:00:00.000Z',
      itemId: 'item-atalho-tarja-baja-ufpr',
      fieldsChangedOnAir: ['teamName'],
    };
    const slices = buildRaceDaySlicesWithRundown({
      items: [buildTeam42ShortcutItem(0)],
      instances: [changedOnAir],
    });

    // Act: the operator fires the item's shortcut button again.
    const outcome = reduceCommand(
      slices,
      { type: 'takeItem', itemId: 'item-atalho-tarja-baja-ufpr' },
      contextOfTheLaterTake,
    );

    // Assert: a new instance with the item's own name and no list: the change was one-off.
    expect(outcome.status, 'the take of the item must be accepted').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : [];
    expect(instancesAfter, 'the new take must show the item as it is stored').toEqual([
      {
        id: contextOfTheLaterTake.newInstanceId,
        layerId: 'lower-third',
        graphicId: 'team-lower-third',
        target: 'program',
        resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
        currentStep: 0,
        status: 'loading',
        takenAt: contextOfTheLaterTake.now,
        itemId: 'item-atalho-tarja-baja-ufpr',
      },
    ]);
  });
});
