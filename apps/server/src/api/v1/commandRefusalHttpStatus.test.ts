/**
 * The HTTP status of each command refusal (apps/server)
 *
 * What this module is for:
 *   POST /api/v1/commands and the shortcuts answer a refused command with the store's
 *   own code and pt-BR message (BAJAOVRLAY-28), and with an HTTP status a tool can branch
 *   on without reading the code: 400 the command is malformed, 403 this sender may not
 *   send it, 422 it names something that does not exist or carries content that cannot
 *   be used, 409 the state right now is in the way (pressing again later may work), 500
 *   the server broke. Every code is classed once, so a new code must be classed too.
 *
 * What these tests prove:
 *   - Every code in the shared list gets one of those five statuses.
 *   - One code per status, as the brief's examples read: a bad field 400, not allowed
 *     403, an unknown item 422, a cursor on nothing 409, a broken save 500.
 *
 * What these tests deliberately do not cover:
 *   - That the routes use this table; commandsRoute.test.ts and commandShortcutRoutes.test.ts.
 */
import { CommandErrorCodeSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { chooseHttpStatusOfCommandRefusal } from './commandRefusalHttpStatus.js';

describe('chooseHttpStatusOfCommandRefusal', () => {
  it('gives every refusal code one of the five statuses', () => {
    // Arrange: every code the server can answer with.
    const everyCode = CommandErrorCodeSchema.options;

    // Act: read the status of each.
    const statuses = new Set(everyCode.map((code) => chooseHttpStatusOfCommandRefusal(code)));

    // Assert: nothing outside 400, 403, 409, 422 and 500.
    expect([...statuses].sort(), 'only the five statuses are used').toEqual([
      400, 403, 409, 422, 500,
    ]);
  });

  const oneCodePerStatus = [
    // A takeItem without its itemId: the command itself is wrong.
    { name: 'answers a malformed command with 400', code: 'INVALID_COMMAND' as const, status: 400 },
    // The renderer's report sent by a pad.
    { name: 'answers a command of the server with 403', code: 'NOT_ALLOWED' as const, status: 403 },
    // A pad holding the id of a deleted item.
    { name: 'answers an unknown item with 422', code: 'ITEM_NOT_FOUND' as const, status: 422 },
    // "Tomar" with the cursor on nothing: move the cursor and press again.
    {
      name: 'answers a cursor on nothing with 409',
      code: 'RUNDOWN_CURSOR_EMPTY' as const,
      status: 409,
    },
    // A macro button pressed while another macro runs.
    {
      name: 'answers a macro already running with 409',
      code: 'MACRO_RUNNING' as const,
      status: 409,
    },
    // The disk filled up while saving.
    {
      name: 'answers a broken save with 500',
      code: 'UNEXPECTED_SERVER_ERROR' as const,
      status: 500,
    },
  ];

  it.each(oneCodePerStatus)('$name', ({ code, status }) => {
    // Arrange: the code in the table.

    // Act: read its status.
    const httpStatus = chooseHttpStatusOfCommandRefusal(code);

    // Assert: the status in the table.
    expect(httpStatus, `${code} must answer ${status}`).toBe(status);
  });
});
