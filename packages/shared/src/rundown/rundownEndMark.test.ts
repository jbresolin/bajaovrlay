/**
 * The rundown's "the last item was taken at the cursor" mark (packages/shared)
 *
 * What this module is for:
 *   A cursor on nothing can mean two things to an operator: "the rundown was played to
 *   its end" or "nobody has placed the cursor yet". The control page says something
 *   different for each, and it cannot tell them apart from the cursor alone. So a rundown
 *   may carry `wasLastItemTakenAtCursor`, which the server sets when the cursor ran off
 *   the end of the list by a take.
 *
 * What these tests prove:
 *   - A rundown with the mark set is accepted unchanged.
 *   - A rundown without the mark is still accepted, so a database written before the mark
 *     existed boots as before; leaving it out means "no".
 *   - A mark that is not true or false is refused, with the field named.
 *
 * What these tests deliberately do not cover:
 *   - When the server sets and clears the mark; takeItem.test.ts and moveCursor.test.ts
 *     in apps/server do.
 *   - What the control page says for each case; emptyCursorHint.test.ts in apps/control.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { RundownSchema } from './rundown.js';

/** Builds the main session's rundown after its last item was fired: the cursor on nothing. */
function buildMainSessionRundownWithCursorOnNothing() {
  return {
    id: 'sessao-principal',
    name: 'Sessão principal',
    sessionLabel: 'Enduro de Resistência — domingo',
    cursorItemId: null,
  };
}

describe('RundownSchema and the end-of-rundown mark', () => {
  it('accepts a rundown that says its last item was taken at the cursor, unchanged', () => {
    // Arrange: the main session played to its end.
    const rundownPlayedToItsEnd = {
      ...buildMainSessionRundownWithCursorOnNothing(),
      wasLastItemTakenAtCursor: true,
    };

    // Act: check it against the schema.
    const result = RundownSchema.safeParse(rundownPlayedToItsEnd);

    // Assert: it is accepted and comes back exactly as written.
    expect(result.success, 'a rundown carrying the mark must be accepted').toBe(true);
    expect(result.data, 'the accepted rundown must not be altered').toEqual(rundownPlayedToItsEnd);
  });

  it('accepts a rundown written before the mark existed, and does not add the mark', () => {
    // Arrange: a rundown as an older database holds it, with no mark at all.
    const rundownFromAnOlderDatabase = buildMainSessionRundownWithCursorOnNothing();

    // Act: check it against the schema.
    const result = RundownSchema.safeParse(rundownFromAnOlderDatabase);

    // Assert: accepted as it is, so a server with an older database still boots.
    expect(result.success, 'a rundown without the mark must still be accepted').toBe(true);
    expect(result.data, 'the schema must not invent a mark').toEqual(rundownFromAnOlderDatabase);
  });

  it('refuses a mark that is a text, naming wasLastItemTakenAtCursor', () => {
    // Arrange: a rundown whose mark was written as the word "sim" instead of true.
    const rundownWithAWordAsMark = {
      ...buildMainSessionRundownWithCursorOnNothing(),
      wasLastItemTakenAtCursor: 'sim',
    };

    // Act: check it and turn the failure into readable text.
    const result = RundownSchema.safeParse(rundownWithAWordAsMark);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the field is named.
    expect(result.success, 'the mark must be true or false, never a text').toBe(false);
    expect(failureMessage, 'the failure must name the field').toContain('wasLastItemTakenAtCursor');
  });
});
