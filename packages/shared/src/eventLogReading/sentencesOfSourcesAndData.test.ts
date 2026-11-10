/**
 * The history sentences of the commands that changes the data the show reads: sources, recordings, corrections, the event inbox, the library and the images (packages/shared)
 *
 * What this module is for:
 *   The history page (#/historico, BAJAOVRLAY-30) reads every change of the show back in
 *   plain pt-BR, one named formatter per command type (sentencesOfSourcesAndData.ts), naming
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
import { buildFakeMediaId } from '../media/fakeMediaIds.testSupport.js';
import type { EventLogDetails } from '../slices/eventLogEntry.js';
import { commandGroupOfEachCommandType } from './eventLogCommandGroups.js';
import { buildEventLogNamesOfRaceDay } from './eventLogNamesOfRaceDay.testSupport.js';
import { describeCommand } from './sentenceOfEachCommandType.js';

// The media id of "logo-petrobras.png": a SHA-256, as the media store names its files.
const petrobrasLogoMediaId = buildFakeMediaId(17);

const sentenceScenarios: Array<{
  name: string;
  command: CommandInput;
  details?: EventLogDetails;
  expected: string;
}> = [
  // A new source reads by the label given.
  {
    name: 'createDataSource names the label given',
    command: {
      type: 'createDataSource',
      label: 'Cronometragem oficial',
      kind: 'httpJson',
      config: {},
      pollIntervalMs: 2_000,
    },
    expected: 'Criou a fonte "Cronometragem oficial"',
  },
  // The source's "Salvar".
  {
    name: 'updateDataSource names the source',
    command: { type: 'updateDataSource', sourceId: 'simulador-enduro', pollIntervalMs: 5_000 },
    expected: 'Editou a fonte "Simulador — Enduro"',
  },
  // A deleted source reads by its id.
  {
    name: 'deleteDataSource reads the source by its id, since it is gone',
    command: { type: 'deleteDataSource', sourceId: 'cronometragem-oficial' },
    expected: 'Excluiu a fonte fonte excluída (cronometragem-oficial)',
  },
  // The source's switch, off.
  {
    name: 'setDataSourceEnabled off reads as turning the source off',
    command: { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: false },
    expected: 'Desligou a fonte "Simulador — Enduro"',
  },
  // "Ler agora".
  {
    name: 'pollDataSourceNow names the source',
    command: { type: 'pollDataSourceNow', sourceId: 'simulador-enduro' },
    expected: 'Pediu uma leitura agora da fonte "Simulador — Enduro"',
  },
  // The simulator's "Reiniciar corrida".
  {
    name: 'restartSimulatedRace names the source',
    command: { type: 'restartSimulatedRace', sourceId: 'simulador-enduro' },
    expected: 'Reiniciou a corrida simulada da fonte "Simulador — Enduro"',
  },
  // "Gravar".
  {
    name: 'startRecording names the source',
    command: { type: 'startRecording', sourceId: 'simulador-enduro' },
    expected: 'Começou a gravar a fonte "Simulador — Enduro"',
  },
  // The recorder stopping on its cap says why.
  {
    name: 'stopRecording by the recorder carries its reason',
    command: {
      type: 'stopRecording',
      sourceId: 'simulador-enduro',
      failureMessage: 'A gravação chegou a 6 horas.',
    },
    expected: 'A gravação da fonte "Simulador — Enduro" parou: A gravação chegou a 6 horas.',
  },
  // A whole poll (the log keeps it trimmed; describeEventLogEntry.test.ts reads that).
  {
    name: 'recordDataSourcePoll of a failure carries the error',
    command: {
      type: 'recordDataSourcePoll',
      sourceId: 'simulador-enduro',
      result: { ok: false, error: 'Tempo esgotado após 5 s.', attemptedAtMs: 1_791_557_525_000 },
    },
    expected: 'A fonte "Simulador — Enduro" falhou: Tempo esgotado após 5 s.',
  },
  // The recorder's count of lines.
  {
    name: 'recordRecordingProgress counts the readings',
    command: {
      type: 'recordRecordingProgress',
      recordingId: 'simulador-enduro-2026-10-09T14-00-00',
      snapshotCount: 1_800,
    },
    expected: 'A gravação simulador-enduro-2026-10-09T14-00-00 tem 1800 leituras',
  },
  // A car's correction: the field, the car, the value and the reason.
  {
    name: 'setOverride of a car names the field, the car, the value and the reason',
    command: {
      type: 'setOverride',
      sourceId: 'simulador-enduro',
      scope: 'car',
      carNumber: 42,
      field: 'teamName',
      value: 'Baja UFPR',
      reason: 'A equipe pediu a correção na secretaria de prova.',
    },
    expected:
      'Corrigiu o campo "teamName" do carro 42 na fonte "Simulador — Enduro" para "Baja UFPR" (motivo: A equipe pediu a correção na secretaria de prova.)',
  },
  // A session correction cleared.
  {
    name: 'clearOverride of the session names the field',
    command: {
      type: 'clearOverride',
      sourceId: 'simulador-enduro',
      scope: 'session',
      field: 'sessionName',
    },
    expected: 'Desfez a correção do campo "sessionName" da sessão na fonte "Simulador — Enduro"',
  },
  // "Descartar" in the "Eventos" tab.
  {
    name: 'dismissEvent names the event by its kind and car',
    command: { type: 'dismissEvent', eventId: 'evento-ocorrencia-47' },
    expected: 'Descartou o evento ocorrência do carro 47',
  },
  // "Aprovar" on a Super Chat (BAJAOVRLAY-35): named by its viewer and amount, never a car.
  {
    name: 'approveEvent names the Super Chat by its viewer and amount',
    command: { type: 'approveEvent', eventId: 'youtube-ao-vivo:superChat:mensagem-pequi-0001' },
    expected: 'Aprovou o Super Chat de Torcida Pequi Off-Road (R$ 20,00)',
  },
  // "Descartar" on a Super Chat: the same name, since it has no car.
  {
    name: 'dismissEvent names a Super Chat by its viewer and amount',
    command: { type: 'dismissEvent', eventId: 'youtube-ao-vivo:superChat:mensagem-pequi-0001' },
    expected: 'Descartou o evento Super Chat de Torcida Pequi Off-Road (R$ 20,00)',
  },
  // "Restaurar" in the history of the "Eventos" page.
  {
    name: 'restoreEvent names the event by its kind and car',
    command: { type: 'restoreEvent', eventId: 'evento-ocorrencia-47' },
    expected: 'Restaurou o evento ocorrência do carro 47',
  },
  // "Mostrar de novo" (BAJAOVRLAY-67): the row says the event had already been shown.
  {
    name: 'restoreEvent of a shown event says it was shown before',
    command: { type: 'restoreEvent', eventId: 'evento-ocorrencia-47' },
    details: { restoredFrom: 'shown' },
    expected: 'Trouxe de volta para mostrar de novo o evento ocorrência do carro 47, já exibido',
  },
  // "Mostrar de novo" on an event that expired before anyone showed it.
  {
    name: 'restoreEvent of an expired event says it had expired',
    command: { type: 'restoreEvent', eventId: 'evento-volta-31' },
    details: { restoredFrom: 'expired' },
    expected: 'Trouxe de volta para mostrar de novo o evento volta mais rápida do carro 31, expirado',
  },
  // A general notice in the inbox reads as one, not as an event of no car.
  {
    name: 'restoreEvent names a general notice as "aviso geral"',
    command: { type: 'restoreEvent', eventId: 'manual:aviso-largada-adiada' },
    expected: 'Restaurou o evento aviso geral',
  },
  // "+ Evento": a penalty, its car and reason.
  {
    name: 'createManualEvent of a penalty names the car and the reason',
    command: {
      type: 'createManualEvent',
      noticeKind: 'penalty',
      carNumber: 47,
      reason: 'Queima de largada',
      penaltyText: '+30 segundos',
    },
    expected: 'Digitou uma penalidade para o carro 47: Queima de largada',
  },
  // "+ Evento" with "Sem equipe (aviso geral)" (BAJAOVRLAY-67): a notice about no car.
  {
    name: 'createManualEvent of a notice with no car reads as a general notice',
    command: {
      type: 'createManualEvent',
      noticeKind: 'notice',
      reason: 'Largada adiada em 15 minutos',
    },
    expected: 'Digitou um aviso geral: Largada adiada em 15 minutos',
  },
  // "Regras".
  {
    name: 'updateEventRule names the kind of event',
    command: { type: 'updateEventRule', kind: 'fastestLap', mode: 'auto' },
    expected: 'Mudou a regra dos eventos de volta mais rápida',
  },
  // What the detectors found, each by its kind and car.
  {
    name: 'recordDetectedEvents lists each event by its kind and car',
    command: {
      type: 'recordDetectedEvents',
      events: [
        {
          eventId: 'evento-volta-12',
          kind: 'fastestLap',
          sourceId: 'simulador-enduro',
          detectedAtMs: 1_791_557_520_000,
          payload: { carNumber: 12, lapTimeText: '1:41.902' },
        },
        {
          eventId: 'evento-lider-31',
          kind: 'leaderChanged',
          sourceId: 'simulador-enduro',
          detectedAtMs: 1_791_557_520_000,
          payload: { carNumber: 31 },
        },
      ],
    },
    expected: 'Detectou 2 eventos: volta mais rápida do carro 12, troca de líder do carro 31',
  },
  // A team saved in Cadastros, by car and name.
  {
    name: 'upsertEntity of a team names the car and the team',
    command: {
      type: 'upsertEntity',
      entityType: 'team',
      record: { carNumber: 42, teamName: 'Baja UFPR', schoolName: 'UFPR' },
    },
    expected: 'Salvou a equipe 42 "Baja UFPR"',
  },
  // A deleted person reads by the key, the only thing the command has.
  {
    name: 'deleteEntity of a person names the key',
    command: { type: 'deleteEntity', entityType: 'person', personId: 'ana-souza' },
    expected: 'Excluiu a pessoa "ana-souza"',
  },
  // A whole import (the log keeps it trimmed; describeEventLogEntry.test.ts reads that).
  {
    name: 'importEntities counts the records of their kind',
    command: {
      type: 'importEntities',
      entityType: 'sponsor',
      records: [{ sponsorId: 'petrobras', name: 'Petrobras', tier: 'ouro', rollWeight: 3 }],
    },
    expected: 'Importou 1 patrocinador',
  },
  // An image the upload route wrote, by its file name.
  {
    name: 'recordUploadedMedia names the file',
    command: {
      type: 'recordUploadedMedia',
      media: {
        mediaId: petrobrasLogoMediaId,
        fileName: 'logo-petrobras.png',
        contentType: 'image/png',
        sizeBytes: 48_213,
        widthPx: 800,
        heightPx: 300,
      },
    },
    expected: 'Enviou a imagem "logo-petrobras.png"',
  },
  // A deleted image has only its id left.
  {
    name: 'deleteMedia names the image by its id',
    command: { type: 'deleteMedia', mediaId: petrobrasLogoMediaId },
    expected: `Excluiu a imagem ${petrobrasLogoMediaId}`,
  },
  // "Descartar" on a waiting trigger firing, as on an event (BAJAOVRLAY-48).
  {
    name: 'dismissTriggerFiring names the firing’s trigger',
    command: { type: 'dismissTriggerFiring', firingId: 'disparo-box-1' },
    expected: 'Descartou o disparo do gatilho "Entrou no box"',
  },
  // Its "Desfazer" makes the firing wait again.
  {
    name: 'restoreTriggerFiring names the firing’s trigger',
    command: { type: 'restoreTriggerFiring', firingId: 'disparo-box-1' },
    expected: 'Restaurou o disparo do gatilho "Entrou no box"',
  },
];

describe('the sentences of the group "sourcesAndData"', () => {
  it('has a row below for every command type of the group', () => {
    // Arrange: the command types the group holds.
    const typesOfTheGroup = Object.entries(commandGroupOfEachCommandType)
      .filter(([, group]) => group === 'sourcesAndData')
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

  it.each(sentenceScenarios)('$name', ({ command, details, expected }) => {
    // Arrange: the command checked as the server checks it, and the race day's names.
    const validCommand = CommandSchema.parse(command);
    const names = buildEventLogNamesOfRaceDay();

    // Act: write its history sentence, with the row's details when it has some.
    const sentence = describeCommand(validCommand, names, details);

    // Assert: exactly the sentence the operator reads.
    expect(sentence, 'the history must read the command in these words').toBe(expected);
  });
});
