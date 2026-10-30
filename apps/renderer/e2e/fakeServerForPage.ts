// Test support: a stand-in for the server, living inside one Playwright page. It answers
// the page's WebSocket at /ws?role=renderer like the real server (a hello with every slice,
// then slice messages; a program monitor or a preview page is answered at
// /ws?role=monitor), keeps every message the page sends, and serves the fake graphic's
// files at /graphics/fake-graphic/. Nothing leaves the browser, so a test decides exactly
// what the renderer hears and when, and reads back exactly what it said.
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
  {
    id: 'bug',
    outputId: 'program',
    name: 'Logo',
    zIndex: 10,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'clock',
    outputId: 'program',
    name: 'Relógio',
    zIndex: 30,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'lower-third',
    outputId: 'program',
    name: 'Legenda',
    zIndex: 40,
    replacePolicy: 'cut',
    persistent: false,
  },
  {
    id: 'fullscreen',
    outputId: 'program',
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
 * registered and then deleted from disk. Its module answers 404 until a test calls
 * `buildSponsorRollPackage`.
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
   * Sends a new `previewClearedLayerIds` slice, the layers marked "will be cleared" in
   * preview, as the real server does after "Prévia: limpar" or a discard.
   */
  sendPreviewClearedLayerIds: (previewClearedLayerIds: string[]) => void;
  /**
   * Drops the WebSocket from the server's side. The page reconnects by itself and is
   * greeted with a hello holding the instances sent last.
   */
  dropConnection: () => Promise<void>;
  /** How many times the page has connected so far. */
  countConnections: () => number;
  /** The WebSocket address of every connection the page made, oldest first. */
  readConnectionAddresses: () => string[];
  /** Every message the page has sent over its WebSocket so far, as parsed JSON, oldest first. */
  readMessagesFromThePage: () => unknown[];
  /**
   * Makes the sponsor roll's files exist from now on, as when someone builds the package
   * while the stream is running. The module served is the fake graphic's.
   */
  buildSponsorRollPackage: () => void;
  /**
   * The path of every request for a sponsor roll file, oldest first, followed by
   * `?retry=<n>` when the renderer asked for it as a retry.
   */
  readSponsorRollRequests: () => string[];
};

/**
 * Installs the stand-in server on a page. Call it before `page.goto`, so the page's very
 * first connection is already answered. `instancesOnAir` is what the first hello holds.
 * `pageMustDialAsAMonitor` is for the two pages that report nothing, the one
 * opened with `?monitor=1` and the one opened with `?target=preview` (see the comment below).
 */
export async function startFakeServerForPage(
  page: Page,
  options: { instancesOnAir: Instance[]; pageMustDialAsAMonitor?: boolean },
): Promise<FakeServerForPage> {
  const slices: Slices = {
    outputs: [{ outputId: 'program', name: 'Programa', order: 0 }],
    layers: layersOfTheFakeServer,
    graphics: [readFakeGraphicFromItsManifest(), sponsorRollWithoutFiles],
    instances: options.instancesOnAir,
    // The preview page reads this one; the first hello marks nothing "will be cleared".
    previewClearedLayerIds: [],
    // The renderer never reads these; they are here because every hello carries them.
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    dataSources: [],
    dataSnapshots: [],
    recordings: [],
    events: [],
    eventRules: [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
    instanceBindings: [],
    overrides: [],
    eventLog: [],
  };
  const connections: WebSocketRoute[] = [];
  const messagesFromThePage: unknown[] = [];
  const sponsorRollRequests: string[] = [];
  let isSponsorRollPackageBuilt = false;

  // Only a socket that says it is the renderer is answered, as the real server tells a
  // renderer from a monitor and an operator by this address. A page that dialled any
  // other address would get no hello here and every test would fail. Vite's own dev
  // socket has another address.
  //
  // For a test of the program monitor or of the preview page it is the other way round:
  // such a page must dial /ws?role=monitor. There both roles are answered, so that a page
  // wrongly dialling as a renderer is caught here, with its address and its messages
  // written down for the test to read, instead of slipping past to the real server behind
  // the dev server.
  const addressesThisServerAnswers =
    options.pageMustDialAsAMonitor === true
      ? /\/ws\?role=(renderer|monitor)$/
      : /\/ws\?role=renderer$/;
  await page.routeWebSocket(addressesThisServerAnswers, (connection) => {
    connections.push(connection);
    connection.onMessage((messageText) => {
      messagesFromThePage.push(JSON.parse(String(messageText)));
    });
    // As the real server does, each message says what the server's clock shows. Here the
    // "server" is this test process, on the same machine as the page, so the renderer
    // measures a difference of about zero.
    connection.send(JSON.stringify({ type: 'hello', slices, serverNowMs: Date.now() }));
  });

  await page.route('**/graphics/fake-graphic/*', (route) => {
    const fileName = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    return route.fulfill({ path: `${fakeGraphicFolder}${fileName}` });
  });
  await page.route('**/graphics/sponsor-roll/*', (route) => {
    // Only the path and the renderer's own `retry` number are kept. The Vite dev server
    // these tests run on adds a marker of its own (`?import`) to every dynamic import;
    // the built page OBS loads does not, so the marker is left out of what a test reads.
    const requestAddress = new URL(route.request().url());
    const retryNumber = requestAddress.searchParams.get('retry');
    const retryPartOfTheAddress = retryNumber === null ? '' : `?retry=${retryNumber}`;
    sponsorRollRequests.push(`${requestAddress.pathname}${retryPartOfTheAddress}`);
    if (isSponsorRollPackageBuilt) {
      return route.fulfill({ path: `${fakeGraphicFolder}fake-graphic.js` });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

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
        JSON.stringify({
          type: 'slice',
          name: 'instances',
          slice: instances,
          serverNowMs: Date.now(),
        }),
      );
    },
    sendPreviewClearedLayerIds: (previewClearedLayerIds) => {
      slices.previewClearedLayerIds = previewClearedLayerIds;
      latestConnection().send(
        JSON.stringify({
          type: 'slice',
          name: 'previewClearedLayerIds',
          slice: previewClearedLayerIds,
          serverNowMs: Date.now(),
        }),
      );
    },
    dropConnection: () => latestConnection().close(),
    countConnections: () => connections.length,
    readConnectionAddresses: () => connections.map((connection) => connection.url()),
    readMessagesFromThePage: () => [...messagesFromThePage],
    buildSponsorRollPackage: () => {
      isSponsorRollPackageBuilt = true;
    },
    readSponsorRollRequests: () => [...sponsorRollRequests],
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

/**
 * Opens the renderer page the way the control page frames it, as a program monitor
 * (`?monitor=1`), and waits for its layer containers like the function above.
 */
export async function openProgramMonitorAndWaitForItsLayers(page: Page): Promise<void> {
  await page.goto('/render/?monitor=1');
  await expect(
    page.locator('[data-layer-id="clock"]'),
    'the monitor must build the layer containers from the hello',
  ).toBeAttached();
}

/**
 * Opens the renderer page as a preview page and waits for its layer containers like the
 * functions above. `pageAddress` is `/render/?target=preview`, or the address the control
 * page frames, `/render/?target=preview&monitor=1`.
 */
export async function openPreviewPageAndWaitForItsLayers(
  page: Page,
  pageAddress: string,
): Promise<void> {
  await page.goto(pageAddress);
  await expect(
    page.locator('[data-layer-id="clock"]'),
    'the preview page must build the layer containers from the hello',
  ).toBeAttached();
}
