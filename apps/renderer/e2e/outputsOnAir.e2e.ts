/**
 * One renderer page per output, on the real server (apps/renderer, Playwright)
 *
 * What this module is for:
 *   João's OBS scene with a picture-in-picture box carries its own overlay as a second
 *   browser source, /render/?output=pip (BAJAOVRLAY-49), while the main source stays
 *   /render/. Each page passes its output on to the server, which sends it only that
 *   output's layers and what is on them. These tests drive the real server, so what is
 *   proven is the whole chain: address, WebSocket, the server's filter and the stage.
 *
 * What these tests prove:
 *   - A clock taken on a layer of a new output is drawn by that output's page and not by
 *     /render/, which has no container for that layer at all.
 *   - The output's page reports the clock on air: the server holds it as on-air.
 *   - A layer added to the output while its page is open appears without a reload.
 *   - `target=preview`, `monitor=1` and `output` combine: the output's Prévia frame draws
 *     a preview of that output, and program's Prévia frame does not.
 *
 * What these tests deliberately do not cover:
 *   - The control page's settings page and monitors; apps/control and its e2e/ cover those.
 *   - Tidying the run's database: each run adds an output of its own (its id carries the
 *     run's time, so runs never meet), and nothing deletes it. Runs on CI start empty.
 *   - clearAll: the race clock and combo files clear the whole server, so this file runs
 *     after them (its own Playwright project) and never clears anything but its layers.
 */
import { expect, type Page, test } from '@playwright/test';

import { realServerPort, sendCommandToRealServer } from './realServer.js';

/** An output id of this run alone: lower-case letters, digits and hyphens. */
const outputIdOfThisRun = `pip-${Date.now().toString(36)}`;
const captionLayerId = `legenda-${outputIdOfThisRun}`;
const frameLayerId = `moldura-${outputIdOfThisRun}`;

/** The enduro under green, held at 1:05:00 so nothing moves while a test looks. */
const heldEnduroClockFields = {
  sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
  state: { kind: 'literal', value: 'green' },
  clockMode: { kind: 'literal', value: 'elapsed' },
  referenceTimeMs: { kind: 'literal', value: 3_900_000 },
  referenceWallClockMs: { kind: 'literal', value: Date.parse('2026-05-16T14:30:00.000Z') },
  running: { kind: 'literal', value: false },
};

/** Sends a command to the real server and fails the test if it is refused. */
async function sendOrFail(command: Record<string, unknown>): Promise<string | undefined> {
  const answer = await sendCommandToRealServer(command);
  if (!answer.ok) {
    throw new Error(`the real server refused ${String(command.type)}: ${answer.errorCode}`);
  }
  return answer.createdItemId;
}

/** Creates the held clock as an item on the run's caption layer and answers its id. */
async function createClockItemOnTheCaption(label: string): Promise<string> {
  const itemId = await sendOrFail({
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    layerId: captionLayerId,
    graphicId: 'race-clock',
    fields: heldEnduroClockFields,
    label,
  });
  if (itemId === undefined) {
    throw new Error('the real server created no clock item');
  }
  return itemId;
}

/** How many graphics the container of a layer holds on a page. */
function countGraphicsInLayer(page: Page, layerId: string) {
  return page.locator(`[data-layer-id="${layerId}"] > *`);
}

/** The status the real server holds for the program instance on a layer, or none. */
async function readProgramStatusOnLayer(layerId: string): Promise<string | undefined> {
  const response = await fetch(`http://127.0.0.1:${String(realServerPort)}/api/v1/state`);
  const slices = (await response.json()) as {
    instances: { layerId: string; target: string; status: string }[];
  };
  return slices.instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  )?.status;
}

// One output and its layers are shared by the tests below, so they run in order.
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // The run's output, with its caption layer, made as "Saídas e camadas" makes them.
  await sendOrFail({ type: 'createOutput', outputId: outputIdOfThisRun, name: 'PiP do teste' });
  await sendOrFail({
    type: 'createLayer',
    layerId: captionLayerId,
    outputId: outputIdOfThisRun,
    name: 'Legenda',
    zIndex: 20,
    replacePolicy: 'out-then-in',
    persistent: false,
  });
});

test.describe('a renderer page per output', () => {
  test('draws a clock taken on the output in its page and not in /render/', async ({ browser }) => {
    // Arrange: the clock item on the caption, the output's page and the main page open.
    const itemId = await createClockItemOnTheCaption('Relógio na PiP do teste');
    const outputPage = await browser.newPage();
    const programPage = await browser.newPage();
    await outputPage.goto(`/render/?output=${outputIdOfThisRun}`);
    await programPage.goto('/render/');
    await expect(
      outputPage.locator(`[data-layer-id="${captionLayerId}"]`),
      "the output's page builds its caption layer",
    ).toBeAttached();
    await expect(
      programPage.locator('[data-layer-id="clock"]'),
      "the main page builds program's layers",
    ).toBeAttached();

    // Act: take the clock.
    await sendOrFail({ type: 'takeItem', itemId });

    // Assert: drawn on the output's page; the main page has no such layer, and the
    // output's page reported it on air.
    await expect(
      countGraphicsInLayer(outputPage, captionLayerId),
      "the clock is drawn in the output's caption",
    ).toHaveCount(1);
    await expect(
      programPage.locator(`[data-layer-id="${captionLayerId}"]`),
      "the main page never builds the output's layer",
    ).toHaveCount(0);
    await expect
      .poll(() => readProgramStatusOnLayer(captionLayerId), {
        message: "the output's page reports the clock on air",
      })
      .toBe('on-air');
  });

  test('shows a layer added to the output while its page is open, without a reload', async ({
    page,
  }) => {
    // Arrange: the output's page open, marked so a reload would show.
    await page.goto(`/render/?output=${outputIdOfThisRun}`);
    await expect(page.locator(`[data-layer-id="${captionLayerId}"]`)).toBeAttached();
    await page.evaluate(() => {
      document.body.dataset.semRecarregar = 'sim';
    });

    // Act: add a frame under the caption.
    await sendOrFail({
      type: 'createLayer',
      layerId: frameLayerId,
      outputId: outputIdOfThisRun,
      name: 'Moldura',
      zIndex: 10,
      replacePolicy: 'cut',
      persistent: true,
    });

    // Assert: the frame's container is there, under the caption, and the page was not
    // reloaded.
    await expect(
      page.locator(`[data-layer-id="${frameLayerId}"]`),
      'the new layer gets its container at once',
    ).toBeAttached();
    const layerIdsInStageOrder = await page
      .locator('[data-layer-id]')
      .evaluateAll((containers) => containers.map((container) => container.dataset.layerId));
    expect(layerIdsInStageOrder, 'the frame sits under the caption').toEqual([
      frameLayerId,
      captionLayerId,
    ]);
    expect(
      await page.evaluate(() => document.body.dataset.semRecarregar),
      'the page was not reloaded',
    ).toBe('sim');
  });

  test("draws the output's preview in its Prévia frame and not in program's", async ({
    browser,
  }) => {
    // Arrange: a second clock item on the caption, and both Prévia frames open.
    const itemId = await createClockItemOnTheCaption('Relógio na PiP do teste — prévia');
    const outputPreviewPage = await browser.newPage();
    const programPreviewPage = await browser.newPage();
    await outputPreviewPage.goto(`/render/?target=preview&monitor=1&output=${outputIdOfThisRun}`);
    await programPreviewPage.goto('/render/?target=preview&monitor=1');
    await expect(outputPreviewPage.locator(`[data-layer-id="${captionLayerId}"]`)).toBeAttached();
    await sendOrFail({ type: 'clearLayer', layerId: captionLayerId });

    // Act: preview the clock on the caption.
    await sendOrFail({ type: 'previewItem', itemId, origin: 'manual' });

    // Assert: the output's Prévia draws it; program's Prévia has no such layer.
    await expect(
      countGraphicsInLayer(outputPreviewPage, captionLayerId),
      "the output's Prévia frame draws the preview",
    ).toHaveCount(1);
    await expect(
      programPreviewPage.locator(`[data-layer-id="${captionLayerId}"]`),
      "program's Prévia frame never builds the output's layer",
    ).toHaveCount(0);
    await sendOrFail({ type: 'clearLayer', layerId: captionLayerId });
  });
});
