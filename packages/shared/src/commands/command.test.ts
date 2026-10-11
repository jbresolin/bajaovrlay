/**
 * Commands (packages/shared)
 *
 * What this module is for:
 *   A command is the only way state changes. CommandSchema lists every command the
 *   server accepts, told apart by their `type` field. M0 had three, covered here:
 *   `takeGraphic` (put a graphic on a layer), `clearLayer` and `clearAll`. The two
 *   added since, `updateInstanceData` and `reportInstanceStatus`, each have a test
 *   file of their own next to their schema.
 *
 * What these tests prove:
 *   - A takeGraphic without a target goes to the program output (the on-air one), and
 *     one that names no field to stamp gets an empty `takeTimeFieldKeys` list.
 *   - A takeGraphic may name the fields the server stamps with the moment of the take
 *     and may carry a cleared field as null; a field key that is empty or not a text is
 *     refused, naming `takeTimeFieldKeys`.
 *   - clearLayer and clearAll are accepted in their real shape.
 *   - A command type the server does not know is refused, naming `type`.
 *   - A takeGraphic without a layer is refused, naming `layerId`.
 *
 * What these tests deliberately do not cover:
 *   - Whether the layer or graphic exists; that needs the state, so the reducers
 *     in apps/server check it.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from './command.js';

describe('CommandSchema', () => {
  it('sends a takeGraphic without a target to the program output', () => {
    // Arrange: the operator takes the race clock and does not say where.
    const takeRaceClock = {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: { sessionName: 'Enduro de Resistência', state: 'green' },
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(takeRaceClock);

    // Assert: it is accepted; its target is filled in as program and no field is stamped.
    expect(result.success, 'a complete takeGraphic must be accepted').toBe(true);
    expect(
      result.data,
      'the missing target must default to program and the missing stamp list to empty',
    ).toEqual({
      ...takeRaceClock,
      target: 'program',
      takeTimeFieldKeys: [],
    });
  });

  it('accepts a takeGraphic that leaves the reference moment to the server and clears the laps', () => {
    // Arrange: the operator takes the race clock running from zero. The page does not
    // read its own clock: it names the field the server must stamp, and it sends the
    // laps field, which the operator cleared, as null.
    const takeRaceClockStartingNow = {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        running: true,
        lapsCompletedByLeader: null,
      },
      target: 'program',
      takeTimeFieldKeys: ['referenceWallClockMs'],
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(takeRaceClockStartingNow);

    // Assert: it is accepted exactly as sent; stamping and clearing are the server's job.
    expect(result.success, 'a take naming a field to stamp must be accepted').toBe(true);
    expect(result.data, 'the command must reach the server exactly as sent').toEqual(
      takeRaceClockStartingNow,
    );
  });

  const refusedStampListScenarios = [
    // An empty key names no field: a form that lost a field name must not pass silently.
    { name: 'refuses a takeGraphic whose stamp list holds an empty key', takeTimeFieldKeys: [''] },
    // A single text instead of a list is a client mistake the server must not guess around.
    {
      name: 'refuses a takeGraphic whose stamp list is a text instead of a list',
      takeTimeFieldKeys: 'referenceWallClockMs',
    },
  ];

  it.each(refusedStampListScenarios)('$name', ({ takeTimeFieldKeys }) => {
    // Arrange: a take of the race clock with a broken stamp list (from the table above).
    const takeWithBrokenStampList = {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: { sessionName: 'Enduro de Resistência' },
      takeTimeFieldKeys,
    };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(takeWithBrokenStampList);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the stamp list.
    expect(result.success, 'a broken stamp list must be refused').toBe(false);
    expect(failureMessage, 'the failure must name takeTimeFieldKeys').toContain(
      'takeTimeFieldKeys',
    );
  });

  const acceptedClearCommandScenarios = [
    // Clearing one layer, as the operator does to take the lower third off air.
    {
      name: 'accepts clearLayer for the lower third',
      command: { type: 'clearLayer', layerId: 'lower-third' },
    },
    // The panic button: everything off air at once.
    { name: 'accepts clearAll with no other field', command: { type: 'clearAll' } },
  ];

  it.each(acceptedClearCommandScenarios)('$name', ({ command }) => {
    // Arrange: the command as the control page sends it (from the table above).
    const commandFromControlPage = command;

    // Act: check the command.
    const result = CommandSchema.safeParse(commandFromControlPage);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a valid clear command must be accepted').toBe(true);
    expect(result.data, 'a clear command has no defaults to fill in').toEqual(command);
  });

  it('refuses a command type the server does not know, naming the type field', () => {
    // Arrange: a command from a future version of the control page. (Until BAJAOVRLAY-13
    // this example was takeItem, which the server now knows; macros are still to come.)
    const unknownCommand = { type: 'runMacro', macroId: 'abertura-do-enduro' };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(unknownCommand);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at `type`.
    expect(result.success, 'an unknown command type must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the type field').toContain('type');
  });

  it('refuses a takeGraphic without a layer, naming layerId', () => {
    // Arrange: a takeGraphic that forgot to say which layer.
    const takeWithoutLayer = {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      data: { sessionName: 'Enduro de Resistência' },
    };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(takeWithoutLayer);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at layerId.
    expect(result.success, 'a takeGraphic without a layer must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the missing field').toContain('layerId');
  });
});
