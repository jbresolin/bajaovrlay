/**
 * Error codes of the rundown and item commands (packages/shared)
 *
 * What this module is for:
 *   When the server refuses a command it answers with a stable code and a pt-BR message.
 *   The list of codes is closed, so the control page can react to a code without reading
 *   the text. The rundown and item commands add six ways of being refused.
 *
 * What these tests prove:
 *   - Each of the six new codes is accepted as a command error with its pt-BR message.
 *   - A code nobody defined is still refused, so the list stays closed.
 *
 * What these tests deliberately do not cover:
 *   - When the server answers with each code and the exact wording of its message; the
 *     reducer tests in apps/server do, and the messages live in the server's catalog.
 *   - The codes that existed before this task; this file lives beside the rundown
 *     schemas so that it never collides with a test file of the commands folder.
 */
import { describe, expect, it } from 'vitest';

import { CommandErrorSchema } from '../commands/commandError.js';

describe('CommandErrorSchema and the rundown error codes', () => {
  const rundownErrorScenarios = [
    // takeItem, updateItemFields, deleteItem or moveCursor named an item that was deleted.
    {
      name: 'accepts ITEM_NOT_FOUND',
      code: 'ITEM_NOT_FOUND',
      message: 'O item "b1f7c2d0" não existe.',
    },
    // createItem, reorderItems, moveCursor or takeNext named a rundown that does not exist.
    {
      name: 'accepts RUNDOWN_NOT_FOUND',
      code: 'RUNDOWN_NOT_FOUND',
      message: 'O roteiro "sessao-de-sabado" não existe.',
    },
    // moveCursor pointed a rundown's cursor at an item that lives in another rundown.
    {
      name: 'accepts ITEM_NOT_IN_RUNDOWN',
      code: 'ITEM_NOT_IN_RUNDOWN',
      message: 'O item "b1f7c2d0" não pertence ao roteiro "sessao-principal".',
    },
    // reorderItems sent a list that leaves an item out or names one from elsewhere.
    {
      name: 'accepts ITEMS_NOT_A_PERMUTATION',
      code: 'ITEMS_NOT_A_PERMUTATION',
      message: 'A nova ordem precisa conter todos os itens do roteiro, uma vez cada.',
    },
    // takeNext (the Space key) was pressed while the cursor was on nothing.
    {
      name: 'accepts RUNDOWN_CURSOR_EMPTY',
      code: 'RUNDOWN_CURSOR_EMPTY',
      message: 'Não há próximo item: o cursor do roteiro está vazio.',
    },
    // The resolver met a field value of a kind it cannot handle before M2.
    {
      name: 'accepts UNSUPPORTED_FIELD_KIND',
      code: 'UNSUPPORTED_FIELD_KIND',
      message: 'O campo "sessionName" usa um tipo de valor que só chega no M2.',
    },
  ];

  it.each(rundownErrorScenarios)('$name', ({ code, message }) => {
    // Arrange: the error as the server would answer it (from the table above).
    const errorFromTheServer = { code, message };

    // Act: check it against the schema.
    const result = CommandErrorSchema.safeParse(errorFromTheServer);

    // Assert: it is accepted unchanged, so the control page can show it.
    expect(result.success, 'a rundown error code must be part of the closed list').toBe(true);
    expect(result.data, 'the accepted error must not be altered').toEqual(errorFromTheServer);
  });

  it('still refuses a code that nobody defined', () => {
    // Arrange: an error with a code invented on the spot.
    const errorWithInventedCode = {
      code: 'ITEM_ALREADY_ON_AIR',
      message: 'O item já está no ar.',
    };

    // Act: check it against the schema.
    const result = CommandErrorSchema.safeParse(errorWithInventedCode);

    // Assert: it is refused; a new code must be added to the list on purpose.
    expect(result.success, 'the list of error codes must stay closed').toBe(false);
  });
});
