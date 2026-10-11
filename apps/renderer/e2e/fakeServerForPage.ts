// Test support: a stand-in for the server, living inside one Playwright page. It answers
// the page's WebSocket at /ws like the real server (a hello with every slice, then slice
// messages) and serves the fake graphic's files at /graphics/fake-graphic/. Nothing leaves
// the browser, so a test decides exactly what the renderer hears and when.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Graphic, Instance, Layer, Slices } from '@bajaovrlay/shared';
import { expect, type Page, type WebSocketRoute } from '@playwright/test';

const fakeGraphicFolder = fileURLToPath(new URL('../test-fixtures/fake-graphic/', import.meta.url));

/**
 * The layers the stand-in server announces. The clock layer swaps out-then-in like every
 * seeded layer; the lower third cuts and fullscreen crossfades, so the tests can watch
 * all three replace policies. There is no `ticker` layer, on purpose: one test takes a
 * graphic on it to see what the renderer does with a layer it was never told about.
 */
export const layersOfTheFakeServer: Layer[] = [
  { id: 'bug', name: 'Logo', zIndex: 10, replacePolicy: 'out-then-in', persistent: true },
  { id: 'clock', name: 'Relógio', zIndex: 30, replacePolicy: 'out-then-in', persistent: true },
  { id: 'lower-third', name: 'Legenda', zIndex: 40, replacePolicy: 'cut', persistent: false },
  {
    id: 'fullscreen',
    name: 'Tela cheia',
    zIndex: 50,
    replacePolicy: 'crossfade',
    persistent: false,
  },
];

/** The fake graphic, registered from its real manifest file in test-fixtures/. */
function readFakeGraphicFromItsManifest(): Graphic {
  const manifestText = readFileSync(`${fakeGraphicFolder}fake-graphic.ograf.json`, 'utf8');
  return {
    id: 'fake-graphic',
    manifest: JSON.parse(manifestText) as Graphic['manifest'],
    defaultLayerId: 'clock',
    category: 'other',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/**
 * A graphic the server lists but whose files do not exist, like a package that was
 * registered and then deleted from disk. Its module answers 404.
 */
const sponsorRollWithoutFiles: Graphic = {
  id: 'sponsor-roll',
  manifest: { id: 'baja-sponsor-roll', name: 'Patrocinadores', main: 'sponsor-roll.js' },
  defaultLayerId: 'lower-third',
  category: 'other',
  thumbnailUrl: null,
  defaultFields: {},
};

/** What a test can make the stand-in server do. */
export type FakeServerForPage = {
  /** Sends a new `instances` slice, as the real server does after a take or a clear. */
  sendInstances: (instances: Instance[]) => void;
  /**
   * Drops the WebSocket from the server's side. The page reconnects by itself and is
   * greeted with a hello holding the instances sent last.
   */
  dropConnection: () => Promise<void>;
  /** How many times the page has connected so far. */
  countConnections: () => number;
};

/**
 * Installs the stand-in server on a page. Call it before `page.goto`, so the page's very
 * first connection is already answered. `instancesOnAir` is what the first hello holds.
 */
export async function startFakeServerForPage(
  page: Page,
  options: { instancesOnAir: Instance[] },
): Promise<FakeServerForPage> {
  const slices: Slices = {
    layers: layersOfTheFakeServer,
    graphics: [readFakeGraphicFromItsManifest(), sponsorRollWithoutFiles],
    instances: options.instancesOnAir,
    // The renderer never reads these two; they are here because every hello carries them.
    rundowns: [],
    items: [],
    eventLog: [],
  };
  const connections: WebSocketRoute[] = [];

  // Only the renderer's socket ends in /ws; Vite's own dev socket has another address.
  await page.routeWebSocket(/\/ws$/, (connection) => {
    connections.push(connection);
    connection.send(JSON.stringify({ type: 'hello', slices }));
  });

  await page.route('**/graphics/fake-graphic/*', (route) => {
    const fileName = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    return route.fulfill({ path: `${fakeGraphicFolder}${fileName}` });
  });
  await page.route('**/graphics/sponsor-roll/*', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  );

  /** The connection opened most recently; a test that uses it expects the page connected. */
  function latestConnection(): WebSocketRoute {
    const connection = connections.at(-1);
    if (connection === undefined) {
      throw new Error('the page has not connected to the fake server yet');
    }
    return connection;
  }

  return {
    sendInstances: (instances) => {
      slices.instances = instances;
      latestConnection().send(
        JSON.stringify({ type: 'slice', name: 'instances', slice: instances }),
      );
    },
    dropConnection: () => latestConnection().close(),
    countConnections: () => connections.length,
  };
}

/**
 * Opens the renderer and waits until it has heard the stand-in server's hello and built
 * its layer containers, so the next thing a test sends finds the page ready.
 */
export async function openRendererAndWaitForItsLayers(page: Page): Promise<void> {
  await page.goto('/render/');
  await expect(
    page.locator('[data-layer-id="clock"]'),
    'the renderer must build the layer containers from the hello',
  ).toBeAttached();
}
