/**
 * A screen's hello once a flex HTTP/JSON source exists (apps/server)
 *
 * What this module is for:
 *   An OBS browser source opened before an upgrade keeps the schemas of its old bundle.
 *   Before João's ruling at gate 2 of PR #17, a screen's hello carried the `dataSources`
 *   slice, so a renderer whose schemas know no `httpJson` kind refused every hello once
 *   an operator made a flex source, and never drew again until someone reloaded it. A
 *   screen is now sent only the slices it draws (core/ws/slicesSentToScreens.ts), so a
 *   data source of any kind never reaches it.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - Once an `httpJson` source exists, the hello a renderer receives passes the shared
 *     server-message schema the renderer parses with, carries no data source at all, and
 *     its text names neither the source's kind nor its address, so an older renderer,
 *     whose schemas refuse that kind, parses it too.
 *
 * What these tests deliberately do not cover:
 *   - Which slices a screen gets in every other message: webSocketHubScreenSlices.test.ts.
 *   - The renderer's own handling of a hello: apps/renderer/src/serverConnection*.test.ts.
 *   - Polling the flex source: modules/dataSources/flexSourceThroughTheStore.test.ts.
 */
import { ServerMessageSchema } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished } from 'vitest';
import { WebSocket } from 'ws';

import { readExampleConfigPointedAt } from '../../modules/dataSources/adapters/httpJson/timingSystemTestServer.testSupport.js';
import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';

// The operator who makes the flex source, as the control page's connection would be named.
const operatorActor = 'operador:5b8e2d14-7a3c-4f96-b0e1-2c9d4a6f8e37';

/**
 * Opens a renderer's socket by hand and resolves with the text of the first message it
 * gets (the hello), unparsed, so the test parses it itself as the renderer does.
 */
async function readTheHelloTextARendererReceives(port: number): Promise<string> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?role=renderer`);
  onTestFinished(() => socket.terminate());
  return new Promise((resolve, reject) => {
    socket.once('message', (data) => resolve(String(data)));
    socket.once('error', reject);
  });
}

describe('the hello of a renderer', () => {
  it('still parses as the renderer parses it once an httpJson source exists', async () => {
    // Arrange: a running server on which the operator made a flex source ("Cronometragem
    // — Enduro", the example preset pointed at the timing system's address on the LAN).
    const runningServer = await startServerOnARandomPort();
    runningServer.stateStore.applyCommand(
      {
        type: 'createDataSource',
        label: 'Cronometragem — Enduro',
        kind: 'httpJson',
        config: readExampleConfigPointedAt('http://192.168.0.40:4790/cronometragem/classificacao'),
        pollIntervalMs: 2_000,
      },
      operatorActor,
    );
    const kindsOfSourceOnTheServer = runningServer.stateStore
      .readAllSlices()
      .dataSources.map((source) => source.kind);

    // Act: a renderer connects, and its hello is parsed with the shared server-message
    // schema, the one the renderer's own parseServerMessage uses.
    const helloText = await readTheHelloTextARendererReceives(runningServer.port);
    const parsedHello = ServerMessageSchema.safeParse(JSON.parse(helloText));

    // Assert: the flex source exists on the server; the hello parses, has no data
    // source in it, and its text names neither the flex kind nor the address, so a
    // renderer opened before the upgrade (whose schemas know no httpJson) parses it too.
    expect(kindsOfSourceOnTheServer, 'the flex source must have been made').toContain('httpJson');
    expect(parsedHello.success, 'the renderer must be able to parse its hello').toBe(true);
    expect(
      parsedHello.data?.type === 'hello' ? parsedHello.data.slices.dataSources : undefined,
      'the renderer hello must carry no data source',
    ).toEqual([]);
    expect(helloText, 'the hello text must not name the flex kind').not.toContain('httpJson');
    expect(helloText, "the hello text must not carry the source's address").not.toContain(
      '192.168.0.40',
    );
  });
});
