/**
 * The data-source commands (packages/shared)
 *
 * What this module is for:
 *   Operators create, change, delete, turn on and off, poll and record data sources from
 *   the "Fontes" page; the server's poller reports every poll with recordDataSourcePoll.
 *   These schemas decide what shape each command must have before the server looks at it.
 *
 * What these tests prove:
 *   - Every operator command is accepted in its realistic form; the poll interval is
 *     bounded to 500–60 000 ms and the kind is one of the two the server knows.
 *   - recordDataSourcePoll carries either a good result (shapes left unchecked here) or
 *     a failure with its error (even an empty one), never something in between.
 *   - recordRecordingProgress (the recorder's count of the lines it wrote) names a
 *     recording and a whole, non-negative count.
 *
 * What these tests deliberately do not cover:
 *   - The config, which is checked by the server against its kind's schema, and the
 *     shapes of a poll: the reducers in apps/server cover both.
 *   - Who may send which command; the authorisation hook in apps/server covers it.
 */
import { describe, expect, it } from 'vitest';

import { CommandSchema } from '../commands/command.js';

describe('the data source commands', () => {
  const acceptedCommandScenarios = [
    // "+ Fonte": a second simulator with a different seed, config left to the server.
    {
      name: 'accepts createDataSource',
      command: {
        type: 'createDataSource',
        label: 'Simulador — Treino',
        kind: 'simulator',
        config: { seed: 7 },
        pollIntervalMs: 2_000,
      },
    },
    // "Editar": only the label changes.
    {
      name: 'accepts updateDataSource with only a label',
      command: { type: 'updateDataSource', sourceId: 'simulador-enduro', label: 'Enduro' },
    },
    // "Excluir", confirmed.
    {
      name: 'accepts deleteDataSource',
      command: { type: 'deleteDataSource', sourceId: 'simulador-enduro' },
    },
    // The on/off switch.
    {
      name: 'accepts setDataSourceEnabled',
      command: { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
    },
    // "Atualizar agora".
    {
      name: 'accepts pollDataSourceNow',
      command: { type: 'pollDataSourceNow', sourceId: 'simulador-enduro' },
    },
    // "Gravar".
    {
      name: 'accepts startRecording',
      command: { type: 'startRecording', sourceId: 'simulador-enduro' },
    },
    // The recorder stopping a recording it could not write, with the reason.
    {
      name: 'accepts stopRecording with a failure message',
      command: {
        type: 'stopRecording',
        sourceId: 'simulador-enduro',
        failureMessage: 'Disco cheio.',
      },
    },
    // A good poll; the shapes are checked by the server, not here.
    {
      name: 'accepts a good recordDataSourcePoll',
      command: {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: { ok: true, shapes: { session: {} }, receivedAtMs: 1_805_568_240_948 },
      },
    },
    // A failed poll, with the error the operator reads.
    {
      name: 'accepts a failed recordDataSourcePoll',
      command: {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: { ok: false, error: 'Falha simulada.', attemptedAtMs: 1_805_568_240_948 },
      },
    },
    // An adapter that threw an error with no message: the poll must still reach the
    // server, or the source would never go stale; the server shows a pt-BR fallback.
    {
      name: 'accepts a failed recordDataSourcePoll whose error is empty',
      command: {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: { ok: false, error: '', attemptedAtMs: 1_805_568_240_948 },
      },
    },
    // The recorder wrote its 63rd line of today's recording (gate 2 on PR #16).
    {
      name: 'accepts recordRecordingProgress',
      command: {
        type: 'recordRecordingProgress',
        recordingId: 'simulador-enduro/2027-08-14T14-30-00.000Z.jsonl',
        snapshotCount: 63,
      },
    },
  ];

  it.each(acceptedCommandScenarios)('$name', ({ command }) => {
    // Arrange: the command of this row (built above).

    // Act: check it.
    const result = CommandSchema.safeParse(command);

    // Assert: accepted unchanged.
    expect(result.success, 'this command must be accepted').toBe(true);
    expect(result.data, 'the accepted command must not be altered').toEqual(command);
  });

  const refusedCommandScenarios = [
    // Polling faster than twice a second would hammer the source.
    {
      name: 'refuses createDataSource polling every 499 ms',
      command: {
        type: 'createDataSource',
        label: 'Simulador — Treino',
        kind: 'simulator',
        config: {},
        pollIntervalMs: 499,
      },
      badField: 'pollIntervalMs',
    },
    // Slower than once a minute is not live data any more.
    {
      name: 'refuses updateDataSource polling every 60 001 ms',
      command: { type: 'updateDataSource', sourceId: 'simulador-enduro', pollIntervalMs: 60_001 },
      badField: 'pollIntervalMs',
    },
    // A kind the server has no adapter for.
    {
      name: 'refuses createDataSource of an unknown kind',
      command: {
        type: 'createDataSource',
        label: 'Planilha',
        kind: 'spreadsheet',
        config: {},
        pollIntervalMs: 2_000,
      },
      badField: 'kind',
    },
    // A good poll must say when it was received.
    {
      name: 'refuses a good poll without receivedAtMs',
      command: {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: { ok: true, shapes: {} },
      },
      badField: 'result',
    },
    // A failure must say what failed; the chip's tooltip shows it.
    {
      name: 'refuses a failed poll without its error',
      command: {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: { ok: false, attemptedAtMs: 1_805_568_240_948 },
      },
      badField: 'result',
    },
    // The recorder counts whole lines written; a negative count is a bug, not a recording.
    {
      name: 'refuses recordRecordingProgress with a negative count',
      command: {
        type: 'recordRecordingProgress',
        recordingId: 'simulador-enduro/2027-08-14T14-30-00.000Z.jsonl',
        snapshotCount: -1,
      },
      badField: 'snapshotCount',
    },
  ];

  it.each(refusedCommandScenarios)('$name', ({ command, badField }) => {
    // Arrange: the command of this row (built above).

    // Act: check it.
    const result = CommandSchema.safeParse(command);

    // Assert: refused, naming the field.
    expect(result.success, 'this command must be refused').toBe(false);
    expect(result.error?.issues[0]?.path[0], 'the refusal must name the bad field').toBe(badField);
  });
});
