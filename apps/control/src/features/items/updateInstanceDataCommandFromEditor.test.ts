/**
 * Item editor: the on-air update of "Atualizar no ar" (apps/control)
 *
 * What this module is for:
 *   "Atualizar no ar" saves the item, then sends `updateInstanceData` to the item's
 *   instance on the program output with the values the operator typed.
 *   buildUpdateInstanceDataCommandFromChangedFields builds it from the fields the save
 *   found changed, without drawing anything.
 *
 * What these tests prove:
 *   - A changed value goes on air as that value and a cleared field as null.
 *   - A field left to be stamped at the take is never sent, and the server is asked to
 *     stamp nothing.
 *   - A field the form now reads from a source is never sent: it reaches the air at the
 *     next take (gate 2 of PR #18).
 *   - With no typed value to change on air, no command is built.
 *
 * What these tests deliberately do not cover:
 *   - Which keys the form reads from a source; fieldsReadFromASource.test.ts.
 *   - When the command is sent; ItemEditorPanelUpdateOnAir*.test.tsx.
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildUpdateInstanceDataCommandFromChangedFields } from './itemCommandsFromEditor';

describe('buildUpdateInstanceDataCommandFromChangedFields', () => {
  const idOfTheClockInstanceOnAir = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';

  it('sends each changed value as it is and a cleared field as null', () => {
    // Arrange: on the item whose clock is on air, the operator raised the green flag and
    // cleared the laps.
    const changedFields: ItemFields = {
      state: { kind: 'literal', value: 'green' },
      lapsCompletedByLeader: { kind: 'literal', value: null },
    };

    // Act: build the on-air update.
    const command = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: idOfTheClockInstanceOnAir,
      changedFields,
      keysReadFromASource: [],
    });

    // Assert: plain values for the graphic, null for the field to take off air, and no
    // field for the server to stamp.
    expect(command, 'the on-air update must carry the two changes as data').toEqual({
      type: 'updateInstanceData',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      data: { state: 'green', lapsCompletedByLeader: null },
      takeTimeFieldKeys: [],
    });
  });

  it('leaves out a field changed to "filled by the server at the take"', () => {
    // Arrange: the operator typed a new time and also switched the reference moment of
    // an older item from a stored number to "the moment of the take".
    const changedFields: ItemFields = {
      referenceTimeMs: { kind: 'literal', value: 5_400_000 },
      referenceWallClockMs: { kind: 'takeTime' },
    };

    // Act: build the on-air update.
    const command = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: idOfTheClockInstanceOnAir,
      changedFields,
      keysReadFromASource: [],
    });

    // Assert: only the typed time goes on air. The moment on air stays as it is, and the
    // server is not asked to stamp a new one.
    expect(command, 'a field left to the take must never be sent on air from the editor').toEqual({
      type: 'updateInstanceData',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      data: { referenceTimeMs: 5_400_000 },
      takeTimeFieldKeys: [],
    });
  });

  it('leaves out a field the form now reads from a source', () => {
    // Arrange: the operator switched the flag to "Fonte" (the item stores the binding;
    // the save made it a changed field) and typed a new title.
    const changedFields: ItemFields = {
      sessionName: { kind: 'literal', value: 'Enduro — Etapa Nacional' },
      state: {
        kind: 'binding',
        sourceId: 'simulador-enduro',
        shapeKey: 'session',
        path: 'state',
        isLive: true,
      },
    };

    // Act: build the on-air update, the flag named as read from a source.
    const command = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: idOfTheClockInstanceOnAir,
      changedFields,
      keysReadFromASource: ['state'],
    });

    // Assert: the typed title alone; the flag reaches the air at the next take.
    expect(command?.data, 'a field read from a source waits for the take').toEqual({
      sessionName: 'Enduro — Etapa Nacional',
    });
  });

  const scenariosWithNothingToChangeOnAir: Array<{ name: string; changedFields: ItemFields }> = [
    // A new label or colour changes the rundown row, not what the audience sees.
    { name: 'builds no command when no field changed', changedFields: {} },
    // The only change is a field now left to the take: nothing typed to put on air.
    {
      name: 'builds no command when the only change is a field left to the take',
      changedFields: { referenceWallClockMs: { kind: 'takeTime' } },
    },
  ];

  it.each(scenariosWithNothingToChangeOnAir)('$name', ({ changedFields }) => {
    // Arrange: the changed fields of this row.

    // Act: build the on-air update.
    const command = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: idOfTheClockInstanceOnAir,
      changedFields,
      keysReadFromASource: [],
    });

    // Assert: there is nothing to send to the instance on air.
    expect(command, 'with no typed value changed, nothing may be sent on air').toBeUndefined();
  });
});
