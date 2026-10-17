/**
 * Saving what was changed on air back into the item: saveOnAirChangesIntoItem
 * (packages/shared)
 *
 * What this module is for:
 *   An instance of an item changed on air ("Atualizar" in "Edição rápida") shows the chip
 *   "alterado no ar" in Camadas. "Salvar no item" sends `saveOnAirChangesIntoItem`: the
 *   server writes the changed fields, as they are on air, into the item, so the next take
 *   shows them too. A clock's wall-clock moment needs a choice the operator makes in a
 *   dialog, and the command carries it in `wallClockFields`: `keepMoment` saves the moment
 *   as a fixed number ("Continuar este relógio"), `atTake` saves it as the moment of each
 *   take ("Começar na entrada no ar").
 *
 * What these tests prove:
 *   - The command is accepted with either choice, and nothing is added to it.
 *   - It is refused, naming the part, without an instance id, without the choice, or with
 *     a choice that is neither of the two words.
 *   - The two refusals only this command gives, INSTANCE_WITHOUT_ITEM (the instance was
 *     put on air by hand before BAJAOVRLAY-37) and NOTHING_CHANGED_ON_AIR (nothing to
 *     save), are part of the closed list of error codes.
 *
 * What these tests deliberately do not cover:
 *   - What the server writes into the item, and when it refuses; the reducer tests in
 *     apps/server do.
 *   - When the page asks for the choice; the Camadas tests in apps/control do.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandErrorSchema } from '../commands/commandError.js';
import { CommandSchema } from '../commands/command.js';

const openingLowerThirdInstanceId = '3f9b2d71-8c4e-4a06-b5d2-7e1a0c9f8b34';

describe('saveOnAirChangesIntoItem in its real shape', () => {
  const acceptedScenarios = [
    // "Salvar no item" for a lower third, or "Continuar este relógio" for a clock.
    {
      name: 'accepts the command that keeps a clock moment as a fixed number',
      command: {
        type: 'saveOnAirChangesIntoItem',
        instanceId: openingLowerThirdInstanceId,
        wallClockFields: 'keepMoment',
      },
    },
    // "Começar na entrada no ar": the clock's moment becomes the moment of each take.
    {
      name: 'accepts the command that saves a clock moment as the moment of the take',
      command: {
        type: 'saveOnAirChangesIntoItem',
        instanceId: openingLowerThirdInstanceId,
        wallClockFields: 'atTake',
      },
    },
  ];

  it.each(acceptedScenarios)('$name', ({ command }) => {
    // Arrange: the command as Camadas sends it (from the table above).
    const commandFromCamadas = command;

    // Act: check it.
    const result = CommandSchema.safeParse(commandFromCamadas);

    // Assert: it is accepted exactly as sent.
    expect(result.success, 'a complete saveOnAirChangesIntoItem must be accepted').toBe(true);
    expect(result.data, 'the command has no defaults to fill in').toEqual(command);
  });
});

describe('saveOnAirChangesIntoItem with a part missing or wrong', () => {
  const refusedScenarios = [
    // An empty id names no instance; the server could only answer "not found".
    {
      name: 'refuses an empty instance id, naming instanceId',
      command: { type: 'saveOnAirChangesIntoItem', instanceId: '', wallClockFields: 'atTake' },
      fieldNamedInTheFailure: 'instanceId',
    },
    // The choice is the operator's: the server never picks one for a clock by itself.
    {
      name: 'refuses the command without the clock choice, naming wallClockFields',
      command: { type: 'saveOnAirChangesIntoItem', instanceId: openingLowerThirdInstanceId },
      fieldNamedInTheFailure: 'wallClockFields',
    },
    // A word the server does not know must not be read as either choice.
    {
      name: 'refuses a clock choice that is neither keepMoment nor atTake',
      command: {
        type: 'saveOnAirChangesIntoItem',
        instanceId: openingLowerThirdInstanceId,
        wallClockFields: 'manter',
      },
      fieldNamedInTheFailure: 'wallClockFields',
    },
  ];

  it.each(refusedScenarios)('$name', ({ command, fieldNamedInTheFailure }) => {
    // Arrange: a broken command (from the table above).
    const brokenCommand = command;

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(brokenCommand);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused, and the message names the part that is wrong.
    expect(result.success, 'a broken saveOnAirChangesIntoItem must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the part that is wrong').toContain(
      fieldNamedInTheFailure,
    );
  });
});

describe('CommandErrorSchema and the codes of saving back into the item', () => {
  const errorScenarios = [
    // A Camadas row "sem item" has no item to save into; it offers "Salvar como item".
    {
      name: 'accepts INSTANCE_WITHOUT_ITEM with its pt-BR message',
      error: {
        code: 'INSTANCE_WITHOUT_ITEM',
        message: 'O que está no ar na camada Tarja não veio de um item.',
      },
    },
    // A second "Salvar no item" pressed by another operator finds nothing left to save.
    {
      name: 'accepts NOTHING_CHANGED_ON_AIR with its pt-BR message',
      error: {
        code: 'NOTHING_CHANGED_ON_AIR',
        message: 'Nada foi alterado no ar desde que o item entrou.',
      },
    },
  ];

  it.each(errorScenarios)('$name', ({ error }) => {
    // Arrange: the refusal as the server sends it (from the table above).
    const refusalFromTheServer = error;

    // Act: check it.
    const result = CommandErrorSchema.safeParse(refusalFromTheServer);

    // Assert: the code is in the closed list, so the page can read it.
    expect(result.success, 'the code must be in the closed list of error codes').toBe(true);
  });
});
