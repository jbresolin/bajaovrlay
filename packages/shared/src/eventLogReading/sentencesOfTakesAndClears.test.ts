/**
 * The history sentences of the commands that changes what is on air: takes, clears, "Próximo", undo, macros running, events shown and OBS scenes (packages/shared)
 *
 * What this module is for:
 *   The history page (#/historico, BAJAOVRLAY-30) reads every change of the show back in
 *   plain pt-BR, one named formatter per command type (sentencesOfTakesAndClears.ts), naming
 *   things as the operator reads them: item labels in quotes, a layer with its output.
 *
 * What these tests prove:
 *   - For each command type of this group, a real race-day command reads as the exact
 *     sentence below; what is gone since reads by its id with a word saying so.
 *   - Every command type of the group has a row here.
 *
 * What these tests deliberately do not cover:
 *   - That every command type has a formatter and a group at all;
 *     sentenceOfEachCommandType.test.ts checks the registry against CommandSchema.
 *   - Rows read from the event log (refusals, trimmed payloads, layers touched);
 *     describeEventLogEntry.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { type CommandInput, CommandSchema } from '../commands/command.js';
import { commandGroupOfEachCommandType } from './eventLogCommandGroups.js';
import { buildEventLogNamesOfRaceDay } from './eventLogNamesOfRaceDay.testSupport.js';
import { describeCommand } from './sentenceOfEachCommandType.js';

const sentenceScenarios: Array<{ name: string; command: CommandInput; expected: string }> = [
  // The brief's own example: an item, its layer and its output.
  {
    name: 'takeItem names the item, its layer and its output',
    command: { type: 'takeItem', itemId: 'item-tarja-ana-souza' },
    expected: 'Tomou "Tarja – Ana Souza" na camada Tarja (Programa)',
  },
  // Space on the rundown: which item is not in the command, only the rundown.
  {
    name: 'takeNext names the rundown',
    command: { type: 'takeNext', rundownId: 'sessao-principal' },
    expected: 'Tomou o próximo item do rundown "Sessão principal"',
  },
  // "Tomar" under the Prévia monitor names a layer.
  {
    name: 'takePreview names the layer',
    command: { type: 'takePreview', layerId: 'lower-third' },
    expected: 'Tomou a prévia da camada Tarja (Programa)',
  },
  // "Tomar tudo" has nothing to name.
  {
    name: 'takeAllPreviews reads as "Tomar tudo"',
    command: { type: 'takeAllPreviews' },
    expected: 'Tomou tudo o que estava em prévia',
  },
  // "Limpar" on a Camadas row clears both outputs.
  {
    name: 'clearLayer names the layer',
    command: { type: 'clearLayer', layerId: 'clock' },
    expected: 'Limpou a camada Relógio (Programa)',
  },
  // The auto-out clears program only, and says so differently.
  {
    name: 'clearLayer of program only reads as taking the layer off the air',
    command: { type: 'clearLayer', layerId: 'notice', target: 'program' },
    expected: 'Tirou do ar a camada Aviso (Programa)',
  },
  // The panic button.
  {
    name: 'clearAll reads as "Limpar tudo"',
    command: { type: 'clearAll' },
    expected: 'Limpou tudo',
  },
  // "Próximo" from the first step (0) moves to the second, as the operator counts.
  {
    name: 'nextOnLayer names the step it moved to, counted from 1',
    command: { type: 'nextOnLayer', layerId: 'fullscreen', fromStep: 0 },
    expected: 'Passou ao passo 2 na camada Tela cheia (Programa)',
  },
  // "Desfazer" on a Camadas row; the PiP layer proves the output is read.
  {
    name: 'undoOnLayer names the layer and its output',
    command: { type: 'undoOnLayer', layerId: 'camera-do-box' },
    expected: 'Desfez a camada Câmera do box (PiP)',
  },
  // "Desfazer última" and Ctrl+Z.
  {
    name: 'undoLastChangeOnProgram reads as "Desfazer última"',
    command: { type: 'undoLastChangeOnProgram' },
    expected: 'Desfez a última troca no ar',
  },
  // "Atualizar" in "Edição rápida": what is on air and which fields were sent.
  {
    name: 'updateInstanceData names what is on air and the fields sent',
    command: {
      type: 'updateInstanceData',
      instanceId: 'instancia-tarja-ana-souza',
      data: { personRole: 'Piloto · Baja UFPR' },
    },
    expected: 'Alterou no ar "Tarja – Ana Souza" na camada Tarja (Programa): personRole',
  },
  // A source's refresh of bound fields (logged only when it begins a spell of refusals).
  {
    name: 'refreshBoundInstanceData names what is on air',
    command: {
      type: 'refreshBoundInstanceData',
      instanceId: 'instancia-tarja-ana-souza',
      data: { personName: 'Ana Souza' },
    },
    expected: 'Atualizou com os dados da fonte "Tarja – Ana Souza" na camada Tarja (Programa)',
  },
  // The renderer could not show a graphic: the detail is the operator's only clue.
  {
    name: 'reportInstanceStatus of a failure carries the renderer’s detail',
    command: {
      type: 'reportInstanceStatus',
      instanceId: 'instancia-tarja-ana-souza',
      status: 'failed',
      detail: 'customElements.define falhou',
    },
    expected:
      'O renderizador não conseguiu mostrar "Tarja – Ana Souza" na camada Tarja (Programa): customElements.define falhou',
  },
  // A macro's run, by its label.
  {
    name: 'runMacro names the macro',
    command: { type: 'runMacro', macroId: 'macro-abertura' },
    expected: 'Rodou a macro "Abertura"',
  },
  // "Parar" (P).
  {
    name: 'stopMacro names the macro',
    command: { type: 'stopMacro', macroId: 'macro-abertura' },
    expected: 'Parou a macro "Abertura"',
  },
  // The runner's bookkeeping: step 1 (index 1) is the second step to the operator.
  {
    name: 'advanceMacroRun counts the step from 1',
    command: { type: 'advanceMacroRun', macroId: 'macro-abertura', currentStep: 1 },
    expected: 'A macro "Abertura" passou ao passo 2',
  },
  // A run that stopped at a refused step says where and why.
  {
    name: 'endMacroRun of a run stopped short says where and why',
    command: {
      type: 'endMacroRun',
      macroId: 'macro-abertura',
      stoppedAtStep: { stepIndex: 2, reason: 'O item "Patrocínio" não existe.' },
    },
    expected: 'A macro "Abertura" parou no passo 3: O item "Patrocínio" não existe.',
  },
  // "No ar" in the "Eventos" tab: the event by its kind and car.
  {
    name: 'showEvent names the event by its kind and car',
    command: { type: 'showEvent', eventId: 'evento-volta-31' },
    expected: 'Pôs no ar o evento volta mais rápida do carro 31',
  },
  // A macro step switching OBS's Program.
  {
    name: 'switchObsScene names the scene and OBS’s output',
    command: { type: 'switchObsScene', sceneName: 'Câmera da largada', target: 'program' },
    expected: 'Trocou a cena do OBS para "Câmera da largada" (Programa)',
  },
  // OBS refusing a switch: the reason is why the scene did not change.
  {
    name: 'recordObsSceneSwitchAnswer of a refusal carries OBS’s reason',
    command: {
      type: 'recordObsSceneSwitchAnswer',
      number: 4,
      isDone: false,
      refusalReason: 'A cena "Câmera da largada" não existe no OBS.',
    },
    expected: 'O OBS não fez a troca de cena nº 4: A cena "Câmera da largada" não existe no OBS.',
  },
  // A trigger's firing (BAJAOVRLAY-48) names the trigger as it was called then, and its
  // data, so a row still says what set it off after the trigger is renamed or deleted.
  {
    name: 'fireTrigger names the trigger and its data',
    command: {
      type: 'fireTrigger',
      triggerId: 'gatilho-penalidade',
      triggerName: 'Penalidade na tela',
      data: { carro: 47, motivo: 'Queima de largada' },
      causedBy: 'sistema:eventos',
    },
    expected: 'O gatilho "Penalidade na tela" disparou (carro: 47, motivo: Queima de largada)',
  },
  // A time of day carries no data, so the sentence ends at the firing.
  {
    name: 'fireTrigger with no data names only the trigger',
    command: {
      type: 'fireTrigger',
      triggerId: 'gatilho-abertura',
      triggerName: 'Abertura da transmissão',
      data: {},
      causedBy: 'sistema:gatilhos',
    },
    expected: 'O gatilho "Abertura da transmissão" disparou',
  },
  // "Rodar" on a waiting firing in the Eventos tab.
  {
    name: 'runTriggerFiring names the firing’s trigger',
    command: { type: 'runTriggerFiring', firingId: 'disparo-box-1' },
    expected: 'Rodou o disparo do gatilho "Entrou no box"',
  },
  // Firings are kept in memory, the newest 50: an older row's firing may be gone.
  {
    name: 'runTriggerFiring reads a firing no longer listed by its id',
    command: { type: 'runTriggerFiring', firingId: 'disparo-7' },
    expected: 'Rodou um disparo que já saiu da lista (disparo-7)',
  },
  // The match "agora" of a Super Prime chosen by hand: the match bug follows it on air.
  {
    name: 'setBracketMatchFocus names the match, the slot and the source',
    command: {
      type: 'setBracketMatchFocus',
      sourceId: 'simulador-enduro',
      sessionId: 'simulador-enduro-2027-super-prime',
      slot: 'current',
      matchId: 'r2-m1',
    },
    expected: 'Escolheu a partida r2-m1 para Partida agora na fonte "Simulador — Enduro"',
  },
  // "a seguir" emptied: the card shows nothing.
  {
    name: 'setBracketMatchFocus with no match says the slot was emptied',
    command: {
      type: 'setBracketMatchFocus',
      sourceId: 'simulador-enduro',
      sessionId: 'simulador-enduro-2027-super-prime',
      slot: 'upNext',
      matchId: null,
    },
    expected: 'Esvaziou Partida a seguir na fonte "Simulador — Enduro"',
  },
  // "Usar sugestão" after a match was decided.
  {
    name: 'acceptSuggestedBracketMatches names the source',
    command: {
      type: 'acceptSuggestedBracketMatches',
      sourceId: 'simulador-enduro',
      sessionId: 'simulador-enduro-2027-super-prime',
    },
    expected: 'Usou a sugestão para Partida agora e Partida a seguir na fonte "Simulador — Enduro"',
  },
];

describe('the sentences of the group "takesAndClears"', () => {
  it('has a row below for every command type of the group', () => {
    // Arrange: the command types the group holds.
    const typesOfTheGroup = Object.entries(commandGroupOfEachCommandType)
      .filter(([, group]) => group === 'takesAndClears')
      .map(([commandType]) => commandType);

    // Act: list the types the table covers.
    const typesInTheTable = new Set<string>(
      sentenceScenarios.map((scenario) => scenario.command.type),
    );

    // Assert: none is left without a row.
    const typesWithoutARow = typesOfTheGroup.filter(
      (commandType) => !typesInTheTable.has(commandType),
    );
    expect(typesWithoutARow, 'each command type of the group must have a row below').toEqual([]);
  });

  it.each(sentenceScenarios)('$name', ({ command, expected }) => {
    // Arrange: the command checked as the server checks it, and the race day's names.
    const validCommand = CommandSchema.parse(command);
    const names = buildEventLogNamesOfRaceDay();

    // Act: write its history sentence.
    const sentence = describeCommand(validCommand, names);

    // Assert: exactly the sentence the operator reads.
    expect(sentence, 'the history must read the command in these words').toBe(expected);
  });
});
