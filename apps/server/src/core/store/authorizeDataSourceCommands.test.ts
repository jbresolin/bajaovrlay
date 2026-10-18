/**
 * The authorisation hook for data-source commands (apps/server)
 *
 * What this module is for:
 *   `allowCommandForActorRole` decides by the role at the start of the actor name.
 *   BAJAOVRLAY-17 adds two jobs for the server itself: the poller of each source, which
 *   signs its results `sistema:fonte:<sourceId>`, and the recorder, `sistema:gravador`,
 *   which counts the lines it wrote and stops a recording it could not write or that
 *   reached its cap. A poller may only report polls of its own source; the recorder may
 *   only stop recordings and report their progress. Operators send every other
 *   data-source command but never a poll result nor a recording's progress (a page must
 *   not fake race data or a count), and their "Parar gravação" never carries a failure
 *   message: only the recorder says why a recording failed (gate 2 on PR #16).
 *
 * What these tests prove:
 *   - An operator may send each of the eight operator commands ("Reiniciar corrida"
 *     among them) and is refused recordDataSourcePoll, recordRecordingProgress, and a
 *     stopRecording that carries a failure message.
 *   - The poller of a source may send recordDataSourcePoll for that source, and is
 *     refused a poll of another source and every other command (pollDataSourceNow,
 *     restartSimulatedRace, setDataSourceEnabled, stopRecording, recordRecordingProgress,
 *     clearLayer).
 *   - The recorder may send stopRecording (with its failure message) and
 *     recordRecordingProgress, and is refused a poll and startRecording.
 *   - A renderer and the auto-out are refused every data-source command.
 *
 * What these tests deliberately do not cover:
 *   - The NOT_ALLOWED refusal and its failed event-log row through a real store;
 *     storeAuthorisation.test.ts shows that mechanism for every refused command.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';
import { buildDataSourcePollerActor, dataSourceRecorderActor } from './commandActors.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const rendererActor = 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12';
const autoOutActor = 'sistema:auto-out';
// The poller of the seeded simulator, and of a replay; no connection has these roles.
const enduroSimulatorPollerActor = buildDataSourcePollerActor('simulador-enduro');
const fridayReplayPollerActor = buildDataSourcePollerActor('reproducao-sexta');
// The recorder, which stops a recording it could not write.
const recorderActor = dataSourceRecorderActor;

const pollOfTheEnduroSimulator: Command = {
  type: 'recordDataSourcePoll',
  sourceId: 'simulador-enduro',
  result: { ok: false, error: 'Falha simulada.', attemptedAtMs: 1_786_717_925_000 },
};
const createTrainingSimulator: Command = {
  type: 'createDataSource',
  label: 'Simulador — Treino',
  kind: 'simulator',
  config: { seed: 7 },
  pollIntervalMs: 2_000,
};
const renameEnduroSimulator: Command = {
  type: 'updateDataSource',
  sourceId: 'simulador-enduro',
  label: 'Enduro simulado',
};
const deleteEnduroSimulator: Command = { type: 'deleteDataSource', sourceId: 'simulador-enduro' };
const turnOnEnduroSimulator: Command = {
  type: 'setDataSourceEnabled',
  sourceId: 'simulador-enduro',
  isEnabled: true,
};
const pollEnduroSimulatorNow: Command = { type: 'pollDataSourceNow', sourceId: 'simulador-enduro' };
// "Reiniciar corrida" on the simulator's row (gate 2, João).
const restartEnduroSimulatorRace: Command = {
  type: 'restartSimulatedRace',
  sourceId: 'simulador-enduro',
};
const startRecordingEnduroSimulator: Command = {
  type: 'startRecording',
  sourceId: 'simulador-enduro',
};
const stopRecordingEnduroSimulator: Command = {
  type: 'stopRecording',
  sourceId: 'simulador-enduro',
};
// The recorder's stop after a failed write, carrying the reason the operator reads.
const stopFailedRecordingOfEnduroSimulator: Command = {
  type: 'stopRecording',
  sourceId: 'simulador-enduro',
  failureMessage: 'A gravação parou: não foi possível escrever no disco.',
};
// The recorder has written the 63rd line of today's recording.
const progressOfTodaysRecording: Command = {
  type: 'recordRecordingProgress',
  recordingId: 'simulador-enduro/2027-08-14T14-30-00.000Z.jsonl',
  snapshotCount: 63,
};
const clearTheClockLayer: Command = { type: 'clearLayer', layerId: 'clock' };

const authorisationScenarios: Array<{
  name: string;
  command: Command;
  actor: string;
  expectedIsAllowed: boolean;
}> = [
  // The eight commands of the "Fontes" page.
  // "+ Fonte": an operator adds a training simulator.
  {
    name: 'allows an operator to create a source',
    command: createTrainingSimulator,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // "Editar": an operator renames the seeded simulator.
  {
    name: 'allows an operator to edit a source',
    command: renameEnduroSimulator,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // "Excluir", confirmed: deleting is the operator's call.
  {
    name: 'allows an operator to delete a source',
    command: deleteEnduroSimulator,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // The on/off switch belongs to the operator.
  {
    name: 'allows an operator to turn a source on',
    command: turnOnEnduroSimulator,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // "Atualizar agora": the operator asks; the poller answers through state.
  {
    name: 'allows an operator to ask for a poll now',
    command: pollEnduroSimulatorNow,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // "Reiniciar corrida": the operator decides when the simulated race starts again.
  {
    name: "allows an operator to restart a simulator's race",
    command: restartEnduroSimulatorRace,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // "Gravar": the operator decides what is recorded.
  {
    name: 'allows an operator to start recording',
    command: startRecordingEnduroSimulator,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // "Parar gravação": the same command the recorder sends, from the button.
  {
    name: 'allows an operator to stop recording',
    command: stopRecordingEnduroSimulator,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // A page must never fake race data.
  {
    name: 'refuses an operator a poll result',
    command: pollOfTheEnduroSimulator,
    actor: operatorActor,
    expectedIsAllowed: false,
  },
  // Only the recorder knows why a recording failed; a page must not fake that reason
  // (gate 2 on PR #16).
  {
    name: 'refuses an operator a stop that carries a failure message',
    command: stopFailedRecordingOfEnduroSimulator,
    actor: operatorActor,
    expectedIsAllowed: false,
  },
  // Only the recorder knows how many lines reached the disk; a page must not fake it.
  {
    name: "refuses an operator a recording's progress",
    command: progressOfTodaysRecording,
    actor: operatorActor,
    expectedIsAllowed: false,
  },
  // The poller reports its own source's polls.
  {
    name: 'allows the poller of a source a poll of that source',
    command: pollOfTheEnduroSimulator,
    actor: enduroSimulatorPollerActor,
    expectedIsAllowed: true,
  },
  // One source acting for another: a bug in one loop must not overwrite another's data.
  {
    name: 'refuses the poller of one source a poll of another source',
    command: pollOfTheEnduroSimulator,
    actor: fridayReplayPollerActor,
    expectedIsAllowed: false,
  },
  // The poller sending anything else: it reports, it never decides.
  {
    name: 'refuses the poller a poll-now request',
    command: pollEnduroSimulatorNow,
    actor: enduroSimulatorPollerActor,
    expectedIsAllowed: false,
  },
  // A poller must not move its own race; restarting it is the operator's button.
  {
    name: "refuses the poller restarting its simulator's race",
    command: restartEnduroSimulatorRace,
    actor: enduroSimulatorPollerActor,
    expectedIsAllowed: false,
  },
  // A poller must not start or stop its own loop; that is the operator's switch.
  {
    name: 'refuses the poller turning its own source on',
    command: turnOnEnduroSimulator,
    actor: enduroSimulatorPollerActor,
    expectedIsAllowed: false,
  },
  // Stopping a recording is the operator's or the recorder's, never the poller's.
  {
    name: 'refuses the poller stopping a recording',
    command: stopRecordingEnduroSimulator,
    actor: enduroSimulatorPollerActor,
    expectedIsAllowed: false,
  },
  // The generic system rule (clearLayer) must not reach the poller through its prefix.
  {
    name: 'refuses the poller clearing a layer, which other server timers may do',
    command: clearTheClockLayer,
    actor: enduroSimulatorPollerActor,
    expectedIsAllowed: false,
  },
  // The recorder stops a recording it could not write or that reached its cap, and
  // reports the lines it wrote; it does nothing else.
  // A failed write: the recorder stops the recording and says why (decision D9).
  {
    name: 'allows the recorder to stop a recording, saying why',
    command: stopFailedRecordingOfEnduroSimulator,
    actor: recorderActor,
    expectedIsAllowed: true,
  },
  // A line reached the disk: the recorder counts it in the list (gate 2 on PR #16).
  {
    name: "allows the recorder to report a recording's progress",
    command: progressOfTodaysRecording,
    actor: recorderActor,
    expectedIsAllowed: true,
  },
  // The poller reports polls; the count of written lines is the recorder's alone.
  {
    name: "refuses the poller a recording's progress",
    command: progressOfTodaysRecording,
    actor: enduroSimulatorPollerActor,
    expectedIsAllowed: false,
  },
  // The recorder writes files; it must never fake race data either.
  {
    name: 'refuses the recorder a poll result',
    command: pollOfTheEnduroSimulator,
    actor: recorderActor,
    expectedIsAllowed: false,
  },
  // Starting a recording is the operator's decision, never the server's.
  {
    name: 'refuses the recorder starting a recording',
    command: startRecordingEnduroSimulator,
    actor: recorderActor,
    expectedIsAllowed: false,
  },
  // The renderer and the auto-out keep their single command.
  // A renderer page in OBS must never fake race data.
  {
    name: 'refuses a renderer a poll result',
    command: pollOfTheEnduroSimulator,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // A renderer shows data; it never changes what is polled.
  {
    name: 'refuses a renderer turning a source on',
    command: turnOnEnduroSimulator,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // A renderer shows data; it never restarts the race behind it.
  {
    name: "refuses a renderer restarting a simulator's race",
    command: restartEnduroSimulatorRace,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // The auto-out is a system actor too; the poller's right must not leak to it.
  {
    name: 'refuses the auto-out a poll result',
    command: pollOfTheEnduroSimulator,
    actor: autoOutActor,
    expectedIsAllowed: false,
  },
];

describe('allowCommandForActorRole for data-source commands', () => {
  it.each(authorisationScenarios)('$name', ({ command, actor, expectedIsAllowed }) => {
    // Arrange: the command and actor of this row (built above).

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, actor);

    // Assert: allowed or refused as the row says.
    expect(isAllowed, 'each role keeps to its own data-source commands').toBe(expectedIsAllowed);
  });
});
