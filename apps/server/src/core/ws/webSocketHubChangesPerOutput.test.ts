/**
 * What a change sends the screens of each output (apps/server)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-49 each output has its own renderer address (/render/ draws program,
 *   /render/?output=pip the PiP), and the server sends each screen only its own output's
 *   layers, instances and "vai limpar" marks. After the hello, a change reaches a screen
 *   only when that screen's copy of a slice changed, so OBS's main source parses nothing
 *   for a take on the PiP (gate 2 of PR #32).
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - A take on the PiP reaches the PiP renderer with the instance and sends program's
 *     renderer nothing at all, since its instances did not change; program's own take
 *     still reaches it.
 *   - A layer added to the PiP while its renderer is connected reaches it in its layers.
 *   - The PiP renderer's report puts the PiP's instance on air.
 *
 * What these tests deliberately do not cover:
 *   - What a screen of one output gets in its hello, the monitors of one output and the
 *     state read; webSocketHubScreensPerOutput.test.ts.
 *   - A command applied by a listener during another change;
 *     webSocketHubNestedChanges.test.ts.
 *   - The renderer drawing what it is sent; apps/renderer covers that.
 */
import { describe, expect, it } from 'vitest';

import {
  commandsThatSetUpThePip,
  createClockOnTheCaption,
  operatorActor,
  readSlicesOfHello,
  startServerWithAClockOnEachOutput,
} from './screensOfEachOutput.testSupport.js';
import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import {
  connectAndWaitForHello,
  waitUntilTheScreenHasEverythingSentSoFar,
} from './webSocketHubWithAnnouncedChanges.testSupport.js';

describe('changes reaching the screens of each output', () => {
  it("sends a take on the PiP to the PiP renderer only, and program's own take to program's", async () => {
    // Arrange: the PiP and its caption, a clock item ready on each output, nothing on air
    // yet, and both renderers connected.
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
    const { client: pipRenderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
      output: 'pip',
    });
    const { client: programRenderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });

    // Act: take the clock on the caption; once program's renderer has everything sent so
    // far, count what it got; then take program's clock.
    stateStore.applyCommand(
      { type: 'takeItem', itemId: captionClock.ok ? captionClock.createdItemId : '' },
      operatorActor,
    );
    const instancesOnThePip = await pipRenderer.waitForMessage(
      'the instances with the caption clock',
      (message) => message.type === 'slice' && message.name === 'instances',
    );
    await waitUntilTheScreenHasEverythingSentSoFar(programRenderer);
    const changesProgramGotForThePipTake = programRenderer
      .readReceivedMessages()
      .filter((message) => message.type === 'slice' || message.type === 'slices');
    stateStore.applyCommand(
      { type: 'takeItem', itemId: programClock.ok ? programClock.createdItemId : '' },
      operatorActor,
    );
    const instancesOnProgram = await programRenderer.waitForMessage(
      "the instances with program's clock",
      (message) => message.type === 'slice' && message.name === 'instances',
    );

    // Assert: the PiP sees its clock; program's renderer is sent nothing for the PiP's
    // take (its instances did not change, so OBS's main source parses nothing), and then
    // gets its own take.
    expect(
      instancesOnThePip.type === 'slice' &&
        instancesOnThePip.name === 'instances' &&
        instancesOnThePip.slice.map((instance) => instance.layerId),
      'the PiP renderer gets the take',
    ).toEqual(['legenda-pip']);
    expect(
      changesProgramGotForThePipTake,
      "program's renderer is sent nothing for a take on the PiP",
    ).toEqual([]);
    expect(
      instancesOnProgram.type === 'slice' &&
        instancesOnProgram.name === 'instances' &&
        instancesOnProgram.slice.map((instance) => instance.layerId),
      "program's renderer gets program's take",
    ).toEqual(['clock']);
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
