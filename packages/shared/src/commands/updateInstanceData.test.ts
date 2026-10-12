/**
 * The updateInstanceData command (packages/shared)
 *
 * What this module is for:
 *   `updateInstanceData` changes some of the data a graphic that is already on a layer
 *   shows, without taking it off: the operator changes the flag from green to yellow
 *   and the race clock stays on screen. The command names the instance and carries
 *   only the fields that change.
 *
 * What these tests prove:
 *   - An update carrying a single changed field is accepted, on its own schema and as
 *     one of the commands of CommandSchema; the only thing added to it is an empty
 *     `takeTimeFieldKeys` list, meaning "stamp no field".
 *   - An update may carry a field as null (the field is to leave the air) and may name
 *     fields the server stamps with the moment of the update, even with no other data.
 *   - A stamp list holding an empty key is refused, naming `takeTimeFieldKeys`.
 *   - An update that leaves out the instance or the data is refused, and the failure
 *     names the missing field.
 *   - Data that is not an object (a bare text) is refused, naming `data`.
 *
 * What these tests deliberately do not cover:
 *   - Whether the instance exists, and whether the merged data fits the graphic's
 *     manifest schema; both need the state, so the reducer in apps/server checks them.
 *   - An update with an empty `data` object: the schema accepts it and the server
 *     decides what it means.
 *   - What a null field and a stamped field do to the instance; the reducer's tests in
 *     apps/server (updateInstanceDataClearedAndStampedFields.test.ts) cover that.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from './command.js';
import { UpdateInstanceDataCommandSchema } from './updateInstanceData.js';

const raceClockInstanceId = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';

/** Builds the update the control page sends when the operator shows the yellow flag. */
function buildUpdateThatShowsTheYellowFlag() {
  return {
    type: 'updateInstanceData',
    instanceId: raceClockInstanceId,
    data: { state: 'yellow' },
  };
}

describe('UpdateInstanceDataCommandSchema', () => {
  it('accepts an update that changes only the flag, adding only an empty stamp list', () => {
    // Arrange: the race clock is on air and the operator changes the flag to yellow.
    const updateToYellowFlag = buildUpdateThatShowsTheYellowFlag();

    // Act: check the command.
    const result = UpdateInstanceDataCommandSchema.safeParse(updateToYellowFlag);

    // Assert: it is accepted, nothing is added to the data and no field is to be stamped.
    expect(result.success, 'an update with one changed field must be accepted').toBe(true);
    expect(
      result.data,
      'the update must carry only the fields that were sent, and stamp no field',
    ).toEqual({ ...updateToYellowFlag, takeTimeFieldKeys: [] });
  });

  const acceptedUpdateScenarios = [
    // "Limpar" on the laps field: null is how the page says the field leaves the air.
    {
      name: 'accepts an update that sends the leader laps as null, to take them off air',
      command: {
        type: 'updateInstanceData',
        instanceId: raceClockInstanceId,
        data: { lapsCompletedByLeader: null },
        takeTimeFieldKeys: [],
      },
    },
    // The clock is restarted from zero now: the page names the reference moment and the
    // server stamps it, so the page's own clock is never used.
    {
      name: 'accepts an update that leaves the reference moment to the server',
      command: {
        type: 'updateInstanceData',
        instanceId: raceClockInstanceId,
        data: { referenceTimeMs: 0, running: true },
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
    },
    // Stamping alone is a whole update: no other field has to change with it.
    {
      name: 'accepts an update with empty data that only names a field to stamp',
      command: {
        type: 'updateInstanceData',
        instanceId: raceClockInstanceId,
        data: {},
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
    },
  ];

  it.each(acceptedUpdateScenarios)('$name', ({ command }) => {
    // Arrange: the update as the control page sends it (from the table above).
    const updateFromControlPage = command;

    // Act: check the command.
    const result = UpdateInstanceDataCommandSchema.safeParse(updateFromControlPage);

    // Assert: it is accepted exactly as sent; clearing and stamping are the server's job.
    expect(result.success, 'the update must be accepted').toBe(true);
    expect(result.data, 'the update must reach the server exactly as sent').toEqual(command);
  });

  const refusedUpdateScenarios = [
    // Without the instance the server cannot know which graphic to change.
    {
      name: 'refuses an update that does not say which instance, naming instanceId',
      command: { type: 'updateInstanceData', data: { state: 'yellow' } },
      fieldNamedInTheFailure: 'instanceId',
    },
    // An empty id is the same mistake as a missing one (a form field left blank).
    {
      name: 'refuses an update with an empty instance id, naming instanceId',
      command: { type: 'updateInstanceData', instanceId: '', data: { state: 'yellow' } },
      fieldNamedInTheFailure: 'instanceId',
    },
    // Without data there is nothing to change; it must be said, not guessed.
    {
      name: 'refuses an update without data, naming data',
      command: { type: 'updateInstanceData', instanceId: raceClockInstanceId },
      fieldNamedInTheFailure: 'data',
    },
    // Data is a set of named fields; a bare value has no field to merge.
    {
      name: 'refuses data that is a text instead of an object, naming data',
      command: { type: 'updateInstanceData', instanceId: raceClockInstanceId, data: 'yellow' },
      fieldNamedInTheFailure: 'data',
    },
    // An empty key names no field: a form that lost a field name must not pass silently.
    {
      name: 'refuses a stamp list holding an empty key, naming takeTimeFieldKeys',
      command: {
        type: 'updateInstanceData',
        instanceId: raceClockInstanceId,
        data: {},
        takeTimeFieldKeys: [''],
      },
      fieldNamedInTheFailure: 'takeTimeFieldKeys',
    },
  ];

  it.each(refusedUpdateScenarios)('$name', ({ command, fieldNamedInTheFailure }) => {
    // Arrange: a broken update (from the table above).
    const brokenUpdate = command;

    // Act: check it and turn the failure into readable text.
    const result = UpdateInstanceDataCommandSchema.safeParse(brokenUpdate);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the field that is wrong.
    expect(result.success, 'a broken update must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the field that is wrong').toContain(
      fieldNamedInTheFailure,
    );
  });
});

describe('CommandSchema with an updateInstanceData', () => {
  it('accepts it as one of the commands the server runs', () => {
    // Arrange: the same yellow-flag update, as it arrives inside a command message.
    const updateToYellowFlag = buildUpdateThatShowsTheYellowFlag();

    // Act: check it against the list of every command.
    const result = CommandSchema.safeParse(updateToYellowFlag);

    // Assert: it is accepted, with nothing added but the empty stamp list.
    expect(result.success, 'updateInstanceData must be a known command').toBe(true);
    expect(result.data, 'the only default filled in must be the empty stamp list').toEqual({
      ...updateToYellowFlag,
      takeTimeFieldKeys: [],
    });
  });
});
