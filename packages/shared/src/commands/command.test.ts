/**
 * Commands (packages/shared)
 *
 * What this module is for:
 *   A command is the only way state changes. CommandSchema lists every command the
 *   server accepts, told apart by their `type` field. For M0 there are three:
 *   `takeGraphic` (put a graphic on a layer), `clearLayer` and `clearAll`.
 *
 * What these tests prove:
 *   - A takeGraphic without a target goes to the program output (the on-air one).
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

    // Assert: it is accepted and its target is filled in as program.
    expect(result.success, 'a complete takeGraphic must be accepted').toBe(true);
    expect(result.data, 'the missing target must default to program').toEqual({
      ...takeRaceClock,
      target: 'program',
    });
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
    // Arrange: a command from a future version of the control page.
    const unknownCommand = { type: 'takeItem', itemId: 'volta-rapida-equipe-42' };

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
