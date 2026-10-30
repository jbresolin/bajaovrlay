// Test support for webSocketHubScreensPerOutput.test.ts and
// webSocketHubChangesPerOutput.test.ts: the PiP output and its caption, a race clock item
// on the caption, a server with a clock on air on each output, and readers for what a
// screen was sent. Nothing here keeps state between calls.
import type { ServerMessage, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';

/** The operator connection every command in these tests comes from. */
export const operatorActor = 'operador:conexao-7';

/** The commands that add the PiP output and its caption. */
export const commandsThatSetUpThePip = [
  { type: 'createOutput', outputId: 'pip', name: 'PiP' },
  {
    type: 'createLayer',
    layerId: 'legenda-pip',
    outputId: 'pip',
    name: 'Legenda',
    zIndex: 20,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
];

/** A race clock item on the PiP's caption, ready to take. */
export const createClockOnTheCaption = {
  type: 'createItem',
  home: { kind: 'quickFire', panelId: 'atalhos' },
  graphicId: 'race-clock',
  layerId: 'legenda-pip',
  label: 'Relógio na PiP',
  fields: {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'elapsed' },
    referenceTimeMs: { kind: 'literal', value: 3_900_000 },
    referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
    running: { kind: 'literal', value: true },
  },
};

/**
 * A running server with the PiP and its caption, a clock item on the caption, and that
 * clock and a second one on program's clock layer both on air; answers the server.
 */
export async function startServerWithAClockOnEachOutput(logger?: ServerLogger) {
  const runningServer = await startServerOnARandomPort({ logger });
  const { stateStore } = runningServer;
  for (const command of commandsThatSetUpThePip) {
    stateStore.applyCommand(command, operatorActor);
  }
  const captionClock = stateStore.applyCommand(createClockOnTheCaption, operatorActor);
  const programClock = stateStore.applyCommand(
    { ...createClockOnTheCaption, layerId: 'clock', label: 'Relógio no programa' },
    operatorActor,
  );
  for (const created of [captionClock, programClock]) {
    if (created.ok && created.createdItemId !== undefined) {
      stateStore.applyCommand({ type: 'takeItem', itemId: created.createdItemId }, operatorActor);
    }
  }
  return runningServer;
}

/** The slices of a hello, or none for another message. */
export function readSlicesOfHello(message: ServerMessage): Slices | undefined {
  return message.type === 'hello' ? message.slices : undefined;
}

/** The layer ids a group of slices carries, bottom to top. */
export function readLayerIds(slices: Slices | undefined): string[] {
  return slices?.layers.map((layer) => layer.id) ?? [];
}

/** The layer of each instance a group of slices carries. */
export function readLayerIdsOfInstances(slices: Slices | undefined): string[] {
  return slices?.instances.map((instance) => instance.layerId) ?? [];
}
