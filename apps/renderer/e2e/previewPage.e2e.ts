/**
 * The preview page: a renderer page that draws the screen as it will look after the take
 * (apps/renderer, Playwright)
 *
 * What this module is for:
 *   Before taking an item the operator looks at it. The server keeps the rehearsed item
 *   as an instance on the `preview` output, and the control page frames the renderer page
 *   at `/render/?target=preview&monitor=1` next to the program monitor. João's rule: it
 *   shows exactly what the screen will look like when the operator takes. So per layer it
 *   draws the preview instance, else nothing on a layer marked "will be cleared"
 *   (`previewClearedLayerIds`), else what is on air there. It is the same page OBS loads
 *   with one setting changed. It is not the program output, so it connects as an ordinary
 *   page (`/ws`, no `role=renderer`) and never sends `instanceStatus`. And because it is
 *   for looking at the next graphic, not for reviewing animations, a second rehearsal on
 *   a layer swaps in at once, whatever that layer's replace policy is on air.
 *
 * What these tests prove, with the real page in Chromium:
 *   - Opened at `/render/?target=preview`, and at the address the control page frames
 *     (`/render/?target=preview&monitor=1`): of a clock on air and another clock being
 *     rehearsed on the same layer, the page draws only the rehearsed one; it dials `/ws`
 *     with no role; the server hears nothing from it.
 *   - The preview page draws the clock on air together with a lower third rehearsed on
 *     another layer.
 *   - A layer marked "will be cleared" is emptied on the preview page while the page OBS
 *     loads, given the same slices, keeps the clock on air.
 *   - The page OBS loads (`/render/`), given a clock on air and one rehearsed, draws only
 *     the one on air and reports only that one.
 *   - On the preview page a second rehearsal on the clock layer, which animates
 *     out-then-in on air, is swapped like a cut: the new graphic is loaded behind the old
 *     one, both animations are skipped, and at no frame is the layer empty.
 *
 * How "heard nothing" is kept from passing by luck: as in programMonitor.e2e.ts, the
 * test discards the rehearsal afterwards and waits for the fake graphic's dispose. A
 * layer runs one operation at a time, so by then the operation that played the graphic
 * is over, and a report made inside it would already have been heard.
 *
 * What these tests deliberately do not cover:
 *   - Every spelling of the address and what it decides; src/rendererPageRole.test.ts.
 *   - Every change of the slices on a preview page (an update, a take of the rehearsed
 *     item, a marker coming and going, a rebuild); src/instanceReconciler.preview.test.ts,
 *     and the composition rule row by row in src/previewComposition.test.ts.
 *   - A graphic failing on a page that reports nothing; programMonitor.e2e.ts does that
 *     for the monitor, and the preview page has the very same player.
 *   - The commands that create and remove preview instances, and the control page that
 *     frames this address; the server's and the control page's own tests.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  makeFakeGraphicCallsTake,
  readFakeGraphicCallsAsSentences,
  readParamsOfCalls,
} from './fakeGraphicCalls.js';
import {
  openPreviewPageAndWaitForItsLayers,
  openRendererAndWaitForItsLayers,
  startFakeServerForPage,
} from './fakeServerForPage.js';
import {
  createEnduroInstance,
  createFinalInstance,
  createRehearsalOf,
  createTeamInstance,
  enduroInstanceId,
  feiInstanceId,
  finalInstanceId,
  instanceNames,
  ufprInstanceId,
} from './instancesOnTheFakeServer.js';
import { readWhatLayerShowed, watchWhatEachLayerShows } from './whatEachLayerShowed.js';

/** Waits until the fake graphic has written down this sentence, e.g. "Final: dispose finished". */
async function waitUntilTheFakeGraphicWroteDown(page: Page, sentence: string): Promise<void> {
  await expect
    .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
      message: `the fake graphic must have written down "${sentence}"`,
    })
    .toContain(sentence);
}

const previewPageAddressScenarios = [
  // The preview page on its own, as someone opening it in a browser tab would.
  {
    name: 'opened at /render/?target=preview',
    pageAddress: '/render/?target=preview',
  },
  // The address the control page frames as "Prévia": monitor=1 must change nothing here.
  {
    name: 'opened at /render/?target=preview&monitor=1, as the control page frames it',
    pageAddress: '/render/?target=preview&monitor=1',
  },
];

test.describe('a renderer page opened as a preview page (?target=preview)', () => {
  for (const { name, pageAddress } of previewPageAddressScenarios) {
    test(`${name}: draws the rehearsed clock, not the one on air, and sends the server nothing`, async ({
      page,
    }) => {
      // Arrange: a preview page at the address of this row, connected to a server with
      // nothing on air and nothing rehearsed.
      const fakeServer = await startFakeServerForPage(page, {
        instancesOnAir: [],
        pageMustDialWithoutTheRendererRole: true,
      });
      await openPreviewPageAndWaitForItsLayers(page, pageAddress);

      // Act: the enduro clock goes on air and the final clock is rehearsed, both on the
      // clock layer. Then everything is cleared, and the rehearsal's dispose proves the
      // operation that played it is over. (Discarding the rehearsal alone would bring the
      // enduro clock onto this page, the screen after such a take.)
      fakeServer.sendInstances([
        createEnduroInstance('green'),
        createRehearsalOf(createFinalInstance()),
      ]);
      await waitUntilTheFakeGraphicWroteDown(page, 'Final: playAction finished');
      fakeServer.sendInstances([]);
      await waitUntilTheFakeGraphicWroteDown(page, 'Final: dispose finished');

      // Assert: only the rehearsed clock was ever touched; one connection, to plain /ws;
      // not one message from the page.
      expect(
        await readFakeGraphicCallsAsSentences(page, instanceNames),
        'the preview page must load, play, stop and dispose the rehearsed clock only; a previewed layer never shows its clock on air',
      ).toEqual([
        'Final: load called',
        'Final: load finished',
        'Final: playAction called',
        'Final: playAction finished',
        'Final: stopAction called',
        'Final: stopAction finished',
        'Final: dispose called',
        'Final: dispose finished',
      ]);
      expect(
        fakeServer.readConnectionAddresses(),
        'a preview page must connect to /ws with no role, so the server does not take it for a renderer',
      ).toEqual([expect.stringMatching(/\/ws$/)]);
      expect(
        fakeServer.readMessagesFromThePage(),
        'a preview page must send no instanceStatus (or anything else) after playing a graphic',
      ).toEqual([]);
    });
  }

  test('a second rehearsal on a layer that animates out-then-in on air is swapped at once', async ({
    page,
  }) => {
    // Arrange: every call of the graphic takes 100 ms, so each step lasts several frames;
    // the layers are watched frame by frame; the enduro clock is being rehearsed on the
    // clock layer, whose replace policy on air is out-then-in.
    await makeFakeGraphicCallsTake(page, 100);
    await watchWhatEachLayerShows(page);
    const fakeServer = await startFakeServerForPage(page, {
      instancesOnAir: [],
      pageMustDialWithoutTheRendererRole: true,
    });
    await openPreviewPageAndWaitForItsLayers(page, '/render/?target=preview&monitor=1');
    fakeServer.sendInstances([createRehearsalOf(createEnduroInstance('green'))]);
    await waitUntilTheFakeGraphicWroteDown(page, 'Enduro: playAction finished');

    // Act: the operator moves the cursor, and the final clock is rehearsed on the same layer.
    fakeServer.sendInstances([createRehearsalOf(createFinalInstance())]);
    await waitUntilTheFakeGraphicWroteDown(page, 'Final: playAction finished');

    // Assert: the new clock finished loading before the old one was touched, both
    // animations were skipped, and frame by frame the layer always showed a visible clock.
    expect(
      await readFakeGraphicCallsAsSentences(page, instanceNames),
      'the new clock must be loaded first, then the old one stopped and disposed, then the new one played',
    ).toEqual([
      'Enduro: load called',
      'Enduro: load finished',
      'Enduro: playAction called',
      'Enduro: playAction finished',
      'Final: load called',
      'Final: load finished',
      'Enduro: stopAction called',
      'Enduro: stopAction finished',
      'Enduro: dispose called',
      'Enduro: dispose finished',
      'Final: playAction called',
      'Final: playAction finished',
    ]);
    expect(
      await readParamsOfCalls(page, enduroInstanceId, 'stopAction'),
      'on the preview page the old clock must stop without its out-animation',
    ).toEqual([{ skipAnimation: true }]);
    expect(
      await readParamsOfCalls(page, finalInstanceId, 'playAction'),
      'on the preview page the new clock must play without its in-animation',
    ).toEqual([{ goto: 0, skipAnimation: true }]);
    expect(
      await readWhatLayerShowed(page, 'clock', instanceNames),
      'every frame after the first rehearsal must show a visible clock; out-then-in would have left the layer empty in between',
    ).toEqual(['nothing', 'Enduro visible', 'Enduro visible + Final hidden', 'Final visible']);
    expect(
      fakeServer.readMessagesFromThePage(),
      'a preview page must send the server nothing during a replace either',
    ).toEqual([]);
  });
});

test.describe('the preview page draws the screen as it will look after the take', () => {
  test('draws the clock on air together with a lower third rehearsed on another layer', async ({
    page,
  }) => {
    // Arrange: the preview page as the control page frames it, nothing on air yet.
    const fakeServer = await startFakeServerForPage(page, {
      instancesOnAir: [],
      pageMustDialWithoutTheRendererRole: true,
    });
    await openPreviewPageAndWaitForItsLayers(page, '/render/?target=preview&monitor=1');

    // Act: the enduro clock is on air on the clock layer, and team 7's lower third is
    // rehearsed on the lower-third layer.
    fakeServer.sendInstances([
      createEnduroInstance('green'),
      createRehearsalOf(createTeamInstance(feiInstanceId, 7, 'FEI Baja')),
    ]);
    await waitUntilTheFakeGraphicWroteDown(page, 'Enduro: playAction finished');
    await waitUntilTheFakeGraphicWroteDown(page, 'FEI: playAction finished');

    // Assert: both are on the page, each on its own layer, and the page said nothing.
    await expect(
      page.locator(`[data-layer-id="clock"] [data-instance-id="${enduroInstanceId}"]`),
      'the clock on air stays after the take, so the preview page must show it',
    ).toBeAttached();
    await expect(
      page.locator(`[data-layer-id="lower-third"] [data-instance-id="${feiInstanceId}"]`),
      'the rehearsed lower third is what the take adds, so the preview page must show it',
    ).toBeAttached();
    expect(
      fakeServer.readMessagesFromThePage(),
      'a preview page must send no instanceStatus about a clock on air it draws',
    ).toEqual([]);
  });

  test('empties a layer marked "will be cleared" while the page OBS loads keeps it on air', async ({
    page,
    context,
  }) => {
    // Arrange: the preview page and the page OBS loads, side by side, each with its own
    // stand-in server; both show the enduro clock on air.
    const previewPage = page;
    const programPage = await context.newPage();
    const serverOfThePreviewPage = await startFakeServerForPage(previewPage, {
      instancesOnAir: [],
      pageMustDialWithoutTheRendererRole: true,
    });
    const serverOfTheProgramPage = await startFakeServerForPage(programPage, {
      instancesOnAir: [],
    });
    await openPreviewPageAndWaitForItsLayers(previewPage, '/render/?target=preview&monitor=1');
    await openRendererAndWaitForItsLayers(programPage);
    serverOfThePreviewPage.sendInstances([createEnduroInstance('green')]);
    serverOfTheProgramPage.sendInstances([createEnduroInstance('green')]);
    await waitUntilTheFakeGraphicWroteDown(previewPage, 'Enduro: playAction finished');
    await waitUntilTheFakeGraphicWroteDown(programPage, 'Enduro: playAction finished');

    // Act: the operator presses "Prévia: limpar" on the clock layer, and both servers send
    // the marker. Then team 42's lower third goes on air: the program page plays it only
    // after it has handled the marker, so its play proves the marker was not missed.
    serverOfThePreviewPage.sendPreviewClearedLayerIds(['clock']);
    serverOfTheProgramPage.sendPreviewClearedLayerIds(['clock']);
    serverOfTheProgramPage.sendInstances([
      createEnduroInstance('green'),
      createTeamInstance(ufprInstanceId, 42, 'Baja UFPR'),
    ]);
    await waitUntilTheFakeGraphicWroteDown(previewPage, 'Enduro: dispose finished');
    await waitUntilTheFakeGraphicWroteDown(programPage, 'UFPR: playAction finished');

    // Assert: the preview page animated the clock out and its layer is empty; the program
    // page never touched the clock, which is still on its clock layer.
    expect(
      await readParamsOfCalls(previewPage, enduroInstanceId, 'stopAction'),
      'a marked layer must empty with the out-animation; only a replace skips it on the preview page',
    ).toEqual([{}]);
    await expect(
      previewPage.locator('[data-layer-id="clock"] [data-instance-id]'),
      'after "Prévia: limpar" the clock layer of the preview page must be empty',
    ).toHaveCount(0);
    expect(
      await readFakeGraphicCallsAsSentences(programPage, instanceNames),
      'the page OBS loads must ignore the marker: the clock stays on air until the take',
    ).not.toContain('Enduro: stopAction called');
    await expect(
      programPage.locator(`[data-layer-id="clock"] [data-instance-id="${enduroInstanceId}"]`),
      'the clock must still be on the clock layer of the page OBS loads',
    ).toBeAttached();
  });
});

test.describe('the page OBS loads (/render/), given the same two clocks', () => {
  test('draws the clock on air, not the rehearsed one, and reports only the one on air', async ({
    page,
  }) => {
    // Arrange: the program renderer connected to a server with nothing on air.
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);

    // Act: the enduro clock goes on air and the final clock is rehearsed, both on the
    // clock layer. Then everything is cleared, and the enduro clock's dispose proves the
    // operation that played it is over.
    fakeServer.sendInstances([
      createEnduroInstance('green'),
      createRehearsalOf(createFinalInstance()),
    ]);
    await waitUntilTheFakeGraphicWroteDown(page, 'Enduro: playAction finished');
    fakeServer.sendInstances([]);
    await waitUntilTheFakeGraphicWroteDown(page, 'Enduro: dispose finished');

    // Assert: only the clock on air was ever touched, and it is the only one reported.
    expect(
      await readFakeGraphicCallsAsSentences(page, instanceNames),
      'the program page must load, play, stop and dispose the clock on air only; the final clock is a rehearsal',
    ).toEqual([
      'Enduro: load called',
      'Enduro: load finished',
      'Enduro: playAction called',
      'Enduro: playAction finished',
      'Enduro: stopAction called',
      'Enduro: stopAction finished',
      'Enduro: dispose called',
      'Enduro: dispose finished',
    ]);
    expect(
      fakeServer.readMessagesFromThePage(),
      'the program page must report the clock on air and say nothing about the rehearsal',
    ).toEqual([{ type: 'instanceStatus', instanceId: enduroInstanceId, status: 'on-air' }]);
  });
});
