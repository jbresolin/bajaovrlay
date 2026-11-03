/**
 * Who may send each command: the operator, or only the server itself (packages/shared)
 *
 * What this module is for:
 *   Every command is classed once, next to the command definitions: an operator may send
 *   it (from the control page, and since BAJAOVRLAY-28 from Companion or a script through
 *   POST /api/v1/commands), or only the server sends it (the renderer's report, a
 *   poller's results, the macro runner's bookkeeping, ...). The server's authorisation
 *   step reads this list for operators and API tokens alike.
 *
 * What these tests prove:
 *   - Every command in CommandSchema is classed, and nothing outside it is: a new command
 *     fails this test until someone decides who may send it.
 *   - The commands only the server sends are exactly the ten the briefs and the
 *     authorisation step name, and the buttons a pad drives are the operator's.
 *
 * What these tests deliberately do not cover:
 *   - Which server actor may send which of the server's commands; authorizeCommand.test.ts
 *     in apps/server.
 */
import { describe, expect, it } from 'vitest';

import { CommandSchema } from './command.js';
import {
  commandTypesOnlyTheServerSends,
  isCommandTypeOfTheOperator,
  senderOfEachCommandType,
} from './commandSenders.js';

/**
 * Reads the `type` of every command schema in the union. A few commands (upsertEntity,
 * importEntities) are unions of their own on the entity type; their first member names
 * the same type as the others.
 */
function readTypeOfEveryCommandInTheSchema(): string[] {
  const typesInTheSchema: string[] = [];
  for (const commandSchema of CommandSchema.options) {
    const schemaWithTheType = 'options' in commandSchema ? commandSchema.options[0] : commandSchema;
    typesInTheSchema.push(schemaWithTheType.shape.type.value);
  }
  return typesInTheSchema;
}

describe('the senders of each command', () => {
  it('classes every command the server accepts, and nothing else', () => {
    // Arrange: every command type the union lists.
    const typesInTheSchema = readTypeOfEveryCommandInTheSchema();

    // Act: list the types the classing names.
    const classedTypes = Object.keys(senderOfEachCommandType);

    // Assert: the same types, each once.
    expect(
      [...classedTypes].sort(),
      'every command must be classed as the operator’s or the server’s, and no stale name kept',
    ).toEqual([...typesInTheSchema].sort());
  });

  it('keeps exactly ten commands for the server alone', () => {
    // Arrange: the eight the authorisation step has always kept from operators, and the
    // two reports of the server's OBS connection (BAJAOVRLAY-27).
    const expectedServerCommands = [
      'advanceMacroRun',
      'endMacroRun',
      'recordDataSourcePoll',
      'recordDetectedEvents',
      'recordObsSceneSwitchAnswer',
      'recordObsState',
      'recordRecordingProgress',
      'recordUploadedMedia',
      'refreshBoundInstanceData',
      'reportInstanceStatus',
    ];

    // Act: read the list.
    const serverCommands = [...commandTypesOnlyTheServerSends].sort();

    // Assert: the same ten.
    expect(serverCommands, 'only these commands are the server’s own').toEqual(
      expectedServerCommands,
    );
  });

  const buttonsOfAPad = [
    // "Tomar" on a pad: the item under the rundown's cursor.
    { name: 'takeNext is the operator’s', commandType: 'takeNext' as const },
    // A macro button.
    { name: 'runMacro is the operator’s', commandType: 'runMacro' as const },
    // The panic button.
    { name: 'clearAll is the operator’s', commandType: 'clearAll' as const },
    // stopRecording is sent by both: the recorder adds a failure message, the operator never.
    { name: 'stopRecording is the operator’s', commandType: 'stopRecording' as const },
    // showEvent is sent by both: the inbox for an automatic rule, the operator by hand.
    { name: 'showEvent is the operator’s', commandType: 'showEvent' as const },
    // A pad's scene button (BAJAOVRLAY-27); a macro's obsScene step sends it too.
    { name: 'switchObsScene is the operator’s', commandType: 'switchObsScene' as const },
  ];

  it.each(buttonsOfAPad)('$name', ({ commandType }) => {
    // Arrange: the command a button sends (in the table above).

    // Act: ask whether an operator may send it.
    const isTheOperators = isCommandTypeOfTheOperator(commandType);

    // Assert: yes.
    expect(isTheOperators, `${commandType} must be open to operators and API tokens`).toBe(true);
  });

  it('says the renderer’s report is not the operator’s', () => {
    // Arrange: the report a renderer sends when a graphic is on screen.
    const commandType = 'reportInstanceStatus' as const;

    // Act: ask whether an operator may send it.
    const isTheOperators = isCommandTypeOfTheOperator(commandType);

    // Assert: no.
    expect(isTheOperators, 'only a renderer reports what is on screen').toBe(false);
  });
});
