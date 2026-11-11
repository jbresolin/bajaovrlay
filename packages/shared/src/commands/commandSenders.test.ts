/**
 * Who may send each command: the operator and which role, or only the server (packages/shared)
 *
 * What this module is for:
 *   Every command is classed once, next to the command definitions, in two columns. The
 *   first says who sends it: an operator (the control page, and since BAJAOVRLAY-28
 *   Companion or a script through POST /api/v1/commands), or only the server itself (the
 *   renderer's report, a poller's results, the macro runner's bookkeeping, ...). The second
 *   (BAJAOVRLAY-29) says whether the "Dados" role may send an operator's command: Dados
 *   prepares the show (Cadastros, Fontes and corrections, items and rundown, triggers and
 *   rules, outputs and layers) but never changes what is on program or preview; "Produtor"
 *   may send every operator command. The server's authorisation step reads both columns,
 *   and the control page reads the second to grey out what the role cannot press.
 *
 * What these tests prove:
 *   - Every command in CommandSchema is classed, and nothing outside it is: a new command
 *     fails this test until someone decides who may send it, and with which role.
 *   - The commands only the server sends are exactly the eleven the briefs and the
 *     authorisation step name, and the buttons a pad drives are the operator's.
 *   - The role table, command type by command type: the Produtor may send every operator
 *     command and Dados exactly the preparing ones; neither may send a server command.
 *
 * What these tests deliberately do not cover:
 *   - Which server actor may send which of the server's commands, and how an actor's role
 *     is read; authorizeCommand.test.ts and authorizeCommandsByRole.test.ts in apps/server.
 */
import { describe, expect, it } from 'vitest';

import { CommandSchema } from './command.js';
import {
  commandTypesOnlyTheServerSends,
  isCommandTypeOfTheOperator,
  isCommandTypeOpenToTheRole,
  whoMaySendEachCommandType,
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
    const classedTypes = Object.keys(whoMaySendEachCommandType);

    // Assert: the same types, each once.
    expect(
      [...classedTypes].sort(),
      'every command must be classed as the operator’s or the server’s, and no stale name kept',
    ).toEqual([...typesInTheSchema].sort());
  });

  it('keeps exactly twelve commands for the server alone', () => {
    // Arrange: the eight the authorisation step has always kept from operators, the two
    // reports of the server's OBS connection (BAJAOVRLAY-27), a trigger's firing
    // (BAJAOVRLAY-48), which only the trigger service sees happen, and a finished backup
    // (BAJAOVRLAY-33), which only the backup knows went out whole.
    const expectedServerCommands = [
      'advanceMacroRun',
      'endMacroRun',
      'fireTrigger',
      'recordBackup',
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

    // Assert: the same twelve.
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

/**
 * The role table of BAJAOVRLAY-29, one row per command type, written out by hand so a
 * reader can check every decision here without opening commandSenders.ts. `produtor` and
 * `dados` say whether each role may send it.
 */
const roleTable = [
  // --- What is on program or preview: the producer's alone. ---
  // An edit of what is on air ("Edição rápida") changes program in place.
  { commandType: 'updateInstanceData', produtor: true, dados: false },
  { commandType: 'clearLayer', produtor: true, dados: false },
  { commandType: 'clearAll', produtor: true, dados: false },
  // "Próximo": the next step of a graphic on air.
  { commandType: 'nextOnLayer', produtor: true, dados: false },
  { commandType: 'undoOnLayer', produtor: true, dados: false },
  { commandType: 'undoLastChangeOnProgram', produtor: true, dados: false },
  { commandType: 'takeItem', produtor: true, dados: false },
  { commandType: 'takeNext', produtor: true, dados: false },
  { commandType: 'previewItem', produtor: true, dados: false },
  { commandType: 'stopPreview', produtor: true, dados: false },
  { commandType: 'takePreview', produtor: true, dados: false },
  { commandType: 'previewClearLayer', produtor: true, dados: false },
  // "Tomar tudo".
  { commandType: 'takeAllPreviews', produtor: true, dados: false },
  { commandType: 'previewMacro', produtor: true, dados: false },
  // The rundown's cursor is what Space and a pad's "take next" put on air next, so moving
  // it is the producer's (a decision the brief left open, taken the conservative way).
  { commandType: 'moveCursor', produtor: true, dados: false },
  // "Salvar no item" reads what is on air from Camadas; the producer's, conservatively.
  { commandType: 'saveOnAirChangesIntoItem', produtor: true, dados: false },
  // Running and stopping a macro is running it, not editing it.
  { commandType: 'runMacro', produtor: true, dados: false },
  { commandType: 'stopMacro', produtor: true, dados: false },
  // An OBS switch changes what goes out.
  { commandType: 'switchObsScene', produtor: true, dados: false },
  // An event's "No ar", and the rest of the inbox's triage, which the brief does not give Dados.
  { commandType: 'showEvent', produtor: true, dados: false },
  // A Super Chat's moderation is Dados's (BAJAOVRLAY-35): approve, and dismiss. The type is
  // open to Dados; the store refuses Dados's dismissal of any other kind (server tests).
  { commandType: 'approveEvent', produtor: true, dados: true },
  { commandType: 'dismissEvent', produtor: true, dados: true },
  // Restoring a discarded Super Chat only makes it wait again: moderation (gate 2 of PR #54).
  { commandType: 'restoreEvent', produtor: true, dados: true },
  { commandType: 'createManualEvent', produtor: true, dados: false },
  // Firing, pausing and the waiting firings of triggers: not editing them.
  { commandType: 'setTriggersPaused', produtor: true, dados: false },
  { commandType: 'runTriggerFiring', produtor: true, dados: false },
  { commandType: 'dismissTriggerFiring', produtor: true, dados: false },
  { commandType: 'restoreTriggerFiring', produtor: true, dados: false },

  // --- Preparing the show: both roles. ---
  // Items, the rundown and the quick-fire panels.
  { commandType: 'createItem', produtor: true, dados: true },
  { commandType: 'updateItemFields', produtor: true, dados: true },
  { commandType: 'deleteItem', produtor: true, dados: true },
  { commandType: 'reorderItems', produtor: true, dados: true },
  { commandType: 'moveItemToHome', produtor: true, dados: true },
  { commandType: 'createQuickFirePanel', produtor: true, dados: true },
  { commandType: 'renameQuickFirePanel', produtor: true, dados: true },
  { commandType: 'deleteQuickFirePanel', produtor: true, dados: true },
  // Macros, edited.
  { commandType: 'createMacro', produtor: true, dados: true },
  { commandType: 'updateMacro', produtor: true, dados: true },
  { commandType: 'deleteMacro', produtor: true, dados: true },
  // Data sources and their recordings ("Fontes").
  { commandType: 'createDataSource', produtor: true, dados: true },
  { commandType: 'updateDataSource', produtor: true, dados: true },
  { commandType: 'deleteDataSource', produtor: true, dados: true },
  { commandType: 'setDataSourceEnabled', produtor: true, dados: true },
  { commandType: 'pollDataSourceNow', produtor: true, dados: true },
  { commandType: 'restartSimulatedRace', produtor: true, dados: true },
  { commandType: 'startRecording', produtor: true, dados: true },
  { commandType: 'stopRecording', produtor: true, dados: true },
  // Corrections of a source's values.
  { commandType: 'setOverride', produtor: true, dados: true },
  { commandType: 'clearOverride', produtor: true, dados: true },
  // The match "agora" and "a seguir" of a Super Prime: the bug on air follows "agora", so
  // only the Produtor moves them (BAJAOVRLAY-65).
  { commandType: 'setBracketMatchFocus', produtor: true, dados: false },
  { commandType: 'acceptSuggestedBracketMatches', produtor: true, dados: false },
  // The rules of the event inbox.
  { commandType: 'updateEventRule', produtor: true, dados: true },
  // "Cadastros": entities and their images.
  { commandType: 'upsertEntity', produtor: true, dados: true },
  { commandType: 'deleteEntity', produtor: true, dados: true },
  { commandType: 'importEntities', produtor: true, dados: true },
  { commandType: 'deleteMedia', produtor: true, dados: true },
  // Outputs and layers ("Saídas e camadas").
  { commandType: 'createOutput', produtor: true, dados: true },
  { commandType: 'renameOutput', produtor: true, dados: true },
  { commandType: 'deleteOutput', produtor: true, dados: true },
  { commandType: 'reorderOutputs', produtor: true, dados: true },
  { commandType: 'createLayer', produtor: true, dados: true },
  { commandType: 'updateLayer', produtor: true, dados: true },
  { commandType: 'moveLayerToOutput', produtor: true, dados: true },
  { commandType: 'reorderLayers', produtor: true, dados: true },
  { commandType: 'deleteLayer', produtor: true, dados: true },
  // Triggers and their rules, edited.
  { commandType: 'createTrigger', produtor: true, dados: true },
  { commandType: 'updateTrigger', produtor: true, dados: true },
  { commandType: 'deleteTrigger', produtor: true, dados: true },

  // --- The server's own: no role at all. ---
  { commandType: 'reportInstanceStatus', produtor: false, dados: false },
  { commandType: 'advanceMacroRun', produtor: false, dados: false },
  { commandType: 'endMacroRun', produtor: false, dados: false },
  { commandType: 'recordDataSourcePoll', produtor: false, dados: false },
  { commandType: 'recordRecordingProgress', produtor: false, dados: false },
  { commandType: 'refreshBoundInstanceData', produtor: false, dados: false },
  { commandType: 'recordDetectedEvents', produtor: false, dados: false },
  { commandType: 'recordUploadedMedia', produtor: false, dados: false },
  { commandType: 'recordObsState', produtor: false, dados: false },
  { commandType: 'recordObsSceneSwitchAnswer', produtor: false, dados: false },
  { commandType: 'fireTrigger', produtor: false, dados: false },
  // The server writes it once a backup's zip went out; a role downloads the backup (both
  // may), but never claims one was made.
  { commandType: 'recordBackup', produtor: false, dados: false },
] as const;

describe('the role table', () => {
  it('has one row for every command type, so a new command must be put in it', () => {
    // Arrange: every command type the union lists.
    const typesInTheSchema = readTypeOfEveryCommandInTheSchema();

    // Act: list the types the table above names.
    const typesInTheTable = roleTable.map((row) => row.commandType);

    // Assert: the same types, each once.
    expect(
      [...typesInTheTable].sort(),
      'every command type must have a row in this test’s role table',
    ).toEqual([...typesInTheSchema].sort());
  });

  it.each(roleTable)('$commandType: Produtor $produtor, Dados $dados', (row) => {
    // Arrange: the row of the table above.

    // Act: ask the shared list about each role.
    const mayTheProducerSend = isCommandTypeOpenToTheRole(row.commandType, 'produtor');
    const mayTheDataRoleSend = isCommandTypeOpenToTheRole(row.commandType, 'dados');

    // Assert: both answers are the table's.
    expect(mayTheProducerSend, `the Produtor's answer for ${row.commandType}`).toBe(row.produtor);
    expect(mayTheDataRoleSend, `the Dados answer for ${row.commandType}`).toBe(row.dados);
  });
});
