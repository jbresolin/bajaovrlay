/**
 * What a screen of one output is sent (apps/server)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-49 each output has its own renderer address: /render/ draws program
 *   (OBS setups made before outputs stay as they are), /render/?output=pip draws only the
 *   PiP. The page passes its output on to the WebSocket (`/ws?role=renderer&output=pip`)
 *   and the server filters what that connection receives: the layers of its output, and
 *   only the instances and "vai limpar" marks of those layers. Filtering on the server
 *   (João's preference in the brief) keeps OBS's work minimal and the renderer as dumb as
 *   it was: it draws whatever it is sent. It also settles who reports an instance's status:
 *   only a renderer of the instance's output ever sees it.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - The hello of a PiP renderer carries the PiP's layer and instance only; the hello of
 *     a renderer with no output carries program's, and neither carries the other's.
 *   - A take on the PiP reaches the PiP renderer with the instance, and the program
 *     renderer with an instances slice that does not have it.
 *   - A layer added to the PiP while its renderer is connected reaches it in its layers.
 *   - The PiP renderer's report puts the PiP's instance on air.
 *   - An output nobody created gives a screen no layer and no instance.
 *   - GET /api/v1/state with `role` and `output` answers the same copy as the hello.
 *
 * What these tests deliberately do not cover:
 *   - Which slices a screen gets at all; webSocketHubScreenSlices.test.ts.
 *   - The renderer drawing what it is sent; apps/renderer covers that.
 */
import type { ServerMessage, Slices } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import {
  connectAndWaitForHello,
  waitUntilTheScreenHasEverythingSentSoFar,
} from './webSocketHubWithAnnouncedChanges.testSupport.js';

const operatorActor = 'operador:conexao-7';

/** The commands that add the PiP output, its caption, and a clock item on the caption. */
const commandsThatSetUpThePip = [
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
const createClockOnTheCaption = {
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
async function startServerWithAClockOnEachOutput() {
  const runningServer = await startServerOnARandomPort();
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
function readSlicesOfHello(message: ServerMessage): Slices | undefined {
  return message.type === 'hello' ? message.slices : undefined;
}

/** The layer ids a group of slices carries, bottom to top. */
function readLayerIds(slices: Slices | undefined): string[] {
  return slices?.layers.map((layer) => layer.id) ?? [];
}

/** The layer of each instance a group of slices carries. */
function readLayerIdsOfInstances(slices: Slices | undefined): string[] {
  return slices?.instances.map((instance) => instance.layerId) ?? [];
}

describe('the hello of a screen of one output', () => {
  it("gives a PiP renderer the PiP's layer and instance, and a renderer with no output program's", async () => {
    // Arrange: a clock on air on each output.
    const runningServer = await startServerWithAClockOnEachOutput();

    // Act: OBS's PiP source and its main source connect.
    const { hello: helloOfThePip } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
      output: 'pip',
    });
    const { hello: helloOfProgram } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });

    // Assert: each has only its own output's layers and instance; both get every output
    // and every graphic.
    const slicesOfThePip = readSlicesOfHello(helloOfThePip);
    const slicesOfProgram = readSlicesOfHello(helloOfProgram);
    expect(readLayerIds(slicesOfThePip), "the PiP renderer gets the PiP's caption only").toEqual([
      'legenda-pip',
    ]);
    expect(
      readLayerIdsOfInstances(slicesOfThePip),
      "the PiP renderer gets the caption's clock only",
    ).toEqual(['legenda-pip']);
    expect(
      readLayerIds(slicesOfProgram),
      "the program renderer gets program's seven layers, not the caption",
    ).toEqual(['bug', 'ticker', 'clock', 'tower', 'lower-third', 'notice', 'fullscreen']);
    expect(
      readLayerIdsOfInstances(slicesOfProgram),
      "the program renderer gets program's clock only",
    ).toEqual(['clock']);
    expect(
      slicesOfThePip?.outputs.map((output) => output.outputId),
      'every screen gets the outputs',
    ).toEqual(['program', 'pip']);
    expect(slicesOfThePip?.graphics, 'every screen gets every graphic').toEqual(
      runningServer.stateStore.readAllSlices().graphics,
    );
  });

  it('gives a screen of an output nobody created no layer and no instance', async () => {
    // Arrange: a clock on air on each output.
    const runningServer = await startServerWithAClockOnEachOutput();

    // Act: a browser source with a typo in its address connects.
    const { hello } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
      output: 'pipp',
    });

    // Assert: it draws nothing rather than program's graphics in the wrong scene.
    expect(readLayerIds(readSlicesOfHello(hello)), 'no layer').toEqual([]);
    expect(readLayerIdsOfInstances(readSlicesOfHello(hello)), 'no instance').toEqual([]);
  });
});

describe('changes reaching the screens of each output', () => {
  it("sends a take on the PiP to the PiP renderer, and program's renderer an instances slice without it", async () => {
    // Arrange: the PiP and its caption with a clock item ready, nothing on air yet, and
    // both renderers connected.
    const runningServer = await startServerOnARandomPort();
    const { stateStore } = runningServer;
    for (const command of commandsThatSetUpThePip) {
      stateStore.applyCommand(command, operatorActor);
    }
    const created = stateStore.applyCommand(createClockOnTheCaption, operatorActor);
    const { client: pipRenderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
      output: 'pip',
    });
    const { client: programRenderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });

    // Act: take the clock on the caption.
    stateStore.applyCommand(
      { type: 'takeItem', itemId: created.ok ? created.createdItemId : '' },
      operatorActor,
    );
    const instancesOnThePip = await pipRenderer.waitForMessage(
      'the instances with the caption clock',
      (message) => message.type === 'slice' && message.name === 'instances',
    );
    const instancesOnProgram = await programRenderer.waitForMessage(
      'the instances of program',
      (message) => message.type === 'slice' && message.name === 'instances',
    );

    // Assert: the PiP sees the clock; program sees none.
    expect(
      instancesOnThePip.type === 'slice' &&
        instancesOnThePip.name === 'instances' &&
        instancesOnThePip.slice.map((instance) => instance.layerId),
      'the PiP renderer gets the take',
    ).toEqual(['legenda-pip']);
    expect(
      instancesOnProgram.type === 'slice' &&
        instancesOnProgram.name === 'instances' &&
        instancesOnProgram.slice,
      "program's renderer never sees the PiP's clock",
    ).toEqual([]);
  });

  it('sends a layer added to the PiP to its renderer while it is connected', async () => {
    // Arrange: the PiP and its caption, and the PiP renderer connected.
    const runningServer = await startServerOnARandomPort();
    for (const command of commandsThatSetUpThePip) {
      runningServer.stateStore.applyCommand(command, operatorActor);
    }
    const { client: pipRenderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
      output: 'pip',
    });

    // Act: João adds the frame under the caption on "Saídas e camadas".
    runningServer.stateStore.applyCommand(
      {
        type: 'createLayer',
        layerId: 'moldura-pip',
        outputId: 'pip',
        name: 'Moldura',
        zIndex: 10,
        replacePolicy: 'cut',
        persistent: true,
      },
      operatorActor,
    );
    const layersMessage = await pipRenderer.waitForMessage(
      'the layers with the frame',
      (message) => message.type === 'slice' && message.name === 'layers',
    );

    // Assert: the frame arrives under the caption, without a reload.
    expect(
      layersMessage.type === 'slice' &&
        layersMessage.name === 'layers' &&
        layersMessage.slice.map((layer) => layer.id),
      'the new layer reaches the connected renderer, bottom to top',
    ).toEqual(['moldura-pip', 'legenda-pip']);
  });

  it("puts the PiP's instance on air when the PiP renderer reports it", async () => {
    // Arrange: a clock on air on each output, and the PiP renderer connected.
    const runningServer = await startServerWithAClockOnEachOutput();
    const { client: pipRenderer, hello } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
      output: 'pip',
    });
    const captionClockId = readSlicesOfHello(hello)?.instances[0]?.id ?? '';

    // Act: the PiP renderer says the caption clock is on screen.
    pipRenderer.sendJson({ type: 'instanceStatus', instanceId: captionClockId, status: 'on-air' });
    await waitUntilTheScreenHasEverythingSentSoFar(pipRenderer);

    // Assert: the caption clock is on air; program's is still loading.
    const statusByLayer = runningServer.stateStore
      .readAllSlices()
      .instances.map((instance) => `${instance.layerId}:${instance.status}`);
    expect(statusByLayer, "the PiP's renderer reports the PiP's instance").toEqual([
      'legenda-pip:on-air',
      'clock:loading',
    ]);
  });
});

describe('GET /api/v1/state for a screen of one output', () => {
  it('answers the same copy as the hello of that screen', async () => {
    // Arrange: a clock on air on each output, and the hello a PiP renderer gets.
    const runningServer = await startServerWithAClockOnEachOutput();
    const { hello } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
      output: 'pip',
    });

    // Act: the PiP page reads the state, as it does when its hello is late.
    const response = await fetch(
      `http://127.0.0.1:${runningServer.port}/api/v1/state?role=renderer&output=pip`,
    );
    const body: unknown = await response.json();

    // Assert: the same slices as the hello.
    expect(response.status, 'the state read answers 200').toBe(200);
    expect(body, 'the state read carries what the hello carried').toEqual(readSlicesOfHello(hello));
  });
});
