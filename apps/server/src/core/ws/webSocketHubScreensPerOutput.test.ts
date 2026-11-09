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
 *   - An output nobody created gives a screen no layer and no instance, and the server logs
 *     a warning naming it, so a typo in an OBS source is found in the log (gate 2); a
 *     screen of an output that exists logs no such line.
 *   - The PiP's Prévia frame (`role=monitor&output=pip`) gets only the PiP's "vai limpar"
 *     marks, and the program Prévia frame only program's (gate 2).
 *   - A monitor of the PiP (`role=monitor&output=pip`, what the monitor picker loads) gets
 *     the PiP's layer and instance in its hello and the PiP's take afterwards (gate 2).
 *   - GET /api/v1/state with `role` and `output` answers the same copy as the hello.
 *
 * What these tests deliberately do not cover:
 *   - Which slices a screen gets at all; webSocketHubScreenSlices.test.ts.
 *   - What a change sends the screens of each output (the PiP's take, a layer added on
 *     air, the PiP's status report); webSocketHubChangesPerOutput.test.ts.
 *   - The renderer drawing what it is sent; apps/renderer covers that.
 */
import { describe, expect, it } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  commandsThatSetUpThePip,
  createClockOnTheCaption,
  operatorActor,
  readLayerIds,
  readLayerIdsOfInstances,
  readSlicesOfHello,
  startServerWithAClockOnEachOutput,
} from './screensOfEachOutput.testSupport.js';
import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import { connectAndWaitForHello } from './webSocketHubWithAnnouncedChanges.testSupport.js';

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
      "the program renderer gets program's eight layers, not the caption",
    ).toEqual([
      'bug',
      'channel-logo',
      'ticker',
      'clock',
      'tower',
      'lower-third',
      'notice',
      'fullscreen',
    ]);
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

  it('logs a warning naming an output nobody created, and none for one that exists', async () => {
    // Arrange: a clock on air on each output, and a logger we can read.
    const { logger, readRecordedLines } = createRecordingLogger();
    const runningServer = await startServerWithAClockOnEachOutput(logger);

    // Act: a source with a typo in its address connects, then the PiP's own.
    await connectAndWaitForHello(runningServer.port, { role: 'renderer', output: 'pipp' });
    await connectAndWaitForHello(runningServer.port, { role: 'renderer', output: 'pip' });

    // Assert: one warning, naming "pipp".
    const warningsAboutOutputs = readRecordedLines().filter(
      (line) => line.message === 'screen connected for an output that does not exist',
    );
    expect(warningsAboutOutputs, 'one warning, for the output nobody created').toEqual([
      expect.objectContaining({ level: 'warn', output_id: 'pipp' }),
    ]);
  });
});

describe('the monitors of one output', () => {
  it('give the PiP\'s Prévia frame only the PiP\'s "vai limpar" marks', async () => {
    // Arrange: a clock on air on each output, both marked "vai limpar" in Prévia.
    const runningServer = await startServerWithAClockOnEachOutput();
    for (const layerId of ['legenda-pip', 'clock']) {
      runningServer.stateStore.applyCommand({ type: 'previewClearLayer', layerId }, operatorActor);
    }

    // Act: the two Prévia frames connect, the PiP's and program's.
    const { hello: helloOfThePipPreview } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
      output: 'pip',
    });
    const { hello: helloOfTheProgramPreview } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
    });

    // Assert: each frame gets the marks of its own output's layers only.
    expect(
      readSlicesOfHello(helloOfThePipPreview)?.previewClearedLayerIds,
      "the PiP's Prévia gets the caption's mark alone",
    ).toEqual(['legenda-pip']);
    expect(
      readSlicesOfHello(helloOfTheProgramPreview)?.previewClearedLayerIds,
      "program's Prévia gets the clock's mark alone",
    ).toEqual(['clock']);
  });

  it("gives a monitor of the PiP the PiP's layer and instance, and then the PiP's take", async () => {
    // Arrange: the PiP and its caption with a clock item ready, nothing on air.
    const runningServer = await startServerOnARandomPort();
    for (const command of commandsThatSetUpThePip) {
      runningServer.stateStore.applyCommand(command, operatorActor);
    }
    const created = runningServer.stateStore.applyCommand(createClockOnTheCaption, operatorActor);

    // Act: the "Programa" monitor switched to the PiP connects, then the clock is taken.
    const { client: pipMonitor, hello } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
      output: 'pip',
    });
    runningServer.stateStore.applyCommand(
      { type: 'takeItem', itemId: created.ok ? created.createdItemId : '' },
      operatorActor,
    );
    const instancesMessage = await pipMonitor.waitForMessage(
      'the instances with the caption clock',
      (message) => message.type === 'slice' && message.name === 'instances',
    );

    // Assert: the PiP's layer in the hello, the PiP's clock after the take.
    expect(readLayerIds(readSlicesOfHello(hello)), "the monitor gets the PiP's caption").toEqual([
      'legenda-pip',
    ]);
    expect(
      instancesMessage.type === 'slice' &&
        instancesMessage.name === 'instances' &&
        instancesMessage.slice.map((instance) => instance.layerId),
      "the monitor gets the PiP's take",
    ).toEqual(['legenda-pip']);
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
