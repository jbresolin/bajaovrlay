/**
 * Command error codes (packages/shared)
 *
 * What this module is for:
 *   When the server refuses a command it answers with a stable code and a pt-BR
 *   message. The codes are a closed list (CommandErrorCodeSchema), so the control page
 *   can react to a code without reading the text.
 *
 * What these tests prove:
 *   - The three codes added with in-place updates and the renderer's reports are in
 *     the list: an unknown instance, a sender that may not send the command, and data
 *     that the graphic's manifest schema refuses.
 *   - The older authorisation code is still in the list, because event-log rows
 *     written before it was replaced must still be readable.
 *   - A code that is not in the list is refused.
 *
 * What these tests deliberately do not cover:
 *   - The pt-BR messages, which live in the server's catalog
 *     (apps/server/src/core/messages/), and when each code is answered, which the
 *     server's store and reducer tests prove.
 */
import { describe, expect, it } from 'vitest';

import { CommandErrorSchema } from './commandError.js';

const commandErrorScenarios = [
  // updateInstanceData and reportInstanceStatus name an instance that may be gone.
  {
    name: 'accepts INSTANCE_NOT_FOUND for an instance that is not on any layer',
    error: {
      code: 'INSTANCE_NOT_FOUND',
      message: 'A instância "7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11" não está em nenhuma camada.',
    },
    isAccepted: true,
  },
  // Only a renderer may report a status; an operator who tries is told so.
  {
    name: 'accepts NOT_ALLOWED for a sender that may not send the command',
    error: { code: 'NOT_ALLOWED', message: 'Você não tem permissão para executar este comando.' },
    isAccepted: true,
  },
  // A flag the race clock does not have is refused by the server, naming the field.
  {
    name: 'accepts INVALID_GRAPHIC_DATA for data the manifest schema refuses',
    error: {
      code: 'INVALID_GRAPHIC_DATA',
      message: 'Dados inválidos para o gráfico "race-clock": o campo "state" tem um valor errado.',
    },
    isAccepted: true,
  },
  // Kept so an event log written before NOT_ALLOWED existed still passes its schema.
  {
    name: 'still accepts UNAUTHORIZED_COMMAND, which older event-log rows may carry',
    error: {
      code: 'UNAUTHORIZED_COMMAND',
      message: 'Você não tem permissão para executar este comando.',
    },
    isAccepted: true,
  },
  // The list is closed: a client must never meet a code it was not told about.
  {
    name: 'refuses a code that is not in the list',
    error: { code: 'INSTANCE_BUSY', message: 'A instância está ocupada.' },
    isAccepted: false,
  },
];

describe('CommandErrorSchema', () => {
  it.each(commandErrorScenarios)('$name', ({ error, isAccepted }) => {
    // Arrange: an error as the server would answer it (from the table above).
    const errorFromServer = error;

    // Act: check the error.
    const result = CommandErrorSchema.safeParse(errorFromServer);

    // Assert: it is accepted or refused as the row says.
    expect(result.success, 'the error code must be judged as the scenario says').toBe(isAccepted);
  });
});
