/**
 * The authorisation hook and a device of the command API (apps/server)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-28 Companion, a Stream Deck or a script sends commands over HTTP,
 *   signed `api:<token name>`. Such a device stands where an operator stands: it may send
 *   every command an operator may (the shared list, whoMaySendEachCommandType), and none of
 *   the commands only the server sends. The operator's own rule reads the same list, so
 *   the two can never drift apart.
 *
 * What these tests prove:
 *   - A device may take, clear, run a macro and stop a recording by hand, as an operator.
 *   - A device is refused every command only the server sends, and a stopRecording that
 *     carries a failure message, exactly as an operator is.
 *
 * What these tests deliberately do not cover:
 *   - The other actors (renderer, monitor, the server's own); authorizeCommand.test.ts and
 *     its siblings.
 *   - How a request gets its actor name; apiTokenAuth.test.ts in api/v1.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';

const companionActor = 'api:companion';
const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';

const commandsOfAPad: Array<{ name: string; command: Command; expectedIsAllowed: boolean }> = [
  // "Tomar" of one item.
  {
    name: 'allows takeItem',
    command: { type: 'takeItem', itemId: 'item-relogio-do-enduro' },
    expectedIsAllowed: true,
  },
  // The panic button.
  { name: 'allows clearAll', command: { type: 'clearAll' }, expectedIsAllowed: true },
  // A macro button.
  {
    name: 'allows runMacro',
    command: { type: 'runMacro', macroId: 'macro-abrir-sessao' },
    expectedIsAllowed: true,
  },
  // A script stopping a recording at the end of the session.
  {
    name: 'allows stopRecording without a failure message',
    command: { type: 'stopRecording', sourceId: 'cronometragem' },
    expectedIsAllowed: true,
  },
  // The renderer's report: a pad must not claim a graphic is on screen.
  {
    name: 'refuses reportInstanceStatus',
    command: { type: 'reportInstanceStatus', instanceId: 'instancia-1', status: 'on-air' },
    expectedIsAllowed: false,
  },
  // The macro runner's bookkeeping.
  {
    name: 'refuses advanceMacroRun',
    command: { type: 'advanceMacroRun', macroId: 'macro-abrir-sessao', currentStep: 1 },
    expectedIsAllowed: false,
  },
  // Only the recorder says why a recording failed.
  {
    name: 'refuses stopRecording with a failure message',
    command: { type: 'stopRecording', sourceId: 'cronometragem', failureMessage: 'Disco cheio.' },
    expectedIsAllowed: false,
  },
  // A list of uploaded images with no file behind them.
  {
    name: 'refuses recordUploadedMedia',
    command: {
      type: 'recordUploadedMedia',
      media: {
        mediaId: 'a'.repeat(64),
        fileName: 'logo-ufpr.png',
        contentType: 'image/png',
        sizeBytes: 20_480,
        widthPx: 256,
        heightPx: 128,
      },
    },
    expectedIsAllowed: false,
  },
];

describe('allowCommandForActorRole for a device of the command API', () => {
  it.each(commandsOfAPad)('$name', ({ command, expectedIsAllowed }) => {
    // Arrange: the command in the table, sent by Companion and by an operator.

    // Act: ask the hook for both.
    const isAllowedForCompanion = allowCommandForActorRole(command, companionActor);
    const isAllowedForAnOperator = allowCommandForActorRole(command, operatorActor);

    // Assert: the answer the table expects, the same for both.
    expect(isAllowedForCompanion, 'a device may send what the table says').toBe(expectedIsAllowed);
    expect(isAllowedForAnOperator, 'an operator gets the same answer as a device').toBe(
      expectedIsAllowed,
    );
  });
});
