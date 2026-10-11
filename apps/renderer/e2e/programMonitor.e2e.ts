/**
 * The program monitor: a renderer page that watches and says nothing (apps/renderer, Playwright)
 *
 * What this module is for:
 *   The control page shows the operator the stream picture by framing the renderer page
 *   at `/render/?monitor=1`. It is the same page OBS loads and it draws the same graphics,
 *   but it is not what goes to the stream. Only the program output is the truth about
 *   what is on air (gate-2 ruling on BAJAOVRLAY-12), so a monitor connects to the server
 *   as an ordinary page (`/ws`, no `role=renderer`) and never sends `instanceStatus`. It
 *   does not try and get refused: it has nothing to send with.
 *
 * What these tests prove, with the real page in Chromium opened at `/render/?monitor=1`:
 *   - The page dials `/ws` with no role.
 *   - It still draws: a taken graphic is loaded and played.
 *   - After a graphic was played, the server has heard nothing from the page.
 *   - After a graphic failed to load, the server has heard nothing from the page either.
 *
 * How "heard nothing" is kept from passing by luck: a layer runs one operation at a time,
 * and the report (on the page OBS loads) is made inside the operation that plays or fails.
 * Each test therefore clears the layer afterwards and waits until the fake graphic has
 * written down its dispose. By then the operation before it is over, report and all, so
 * a message would already have been heard.
 *
 * What these tests deliberately do not cover:
 *   - The page OBS loads (`/render/` with no query), which must keep reporting;
 *     e2e/instanceStatus.e2e.ts.
 *   - Every spelling of the address and what it decides; src/rendererPageRole.test.ts.
 *   - The control page framing this address; the control page's own tests.
 *   - What the real server does with a connection that has no role; the server's tests.
 */
import { expect, type Page, test } from '@playwright/test';

import { readFakeGraphicCallsAsSentences } from './fakeGraphicCalls.js';
import {
  openProgramMonitorAndWaitForItsLayers,
  startFakeServerForPage,
} from './fakeServerForPage.js';
import {
  createEnduroInstance,
  createInstance,
  createTeamInstance,
  feiInstanceId,
  instanceNames,
  ufprInstanceId,
} from './instancesOnTheFakeServer.js';

/** Waits until the fake graphic has written down this sentence, e.g. "Enduro: dispose finished". */
async function waitUntilTheFakeGraphicWroteDown(page: Page, sentence: string): Promise<void> {
  await expect
    .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
      message: `the fake graphic must have written down "${sentence}"`,
    })
    .toContain(sentence);
}

test.describe('a renderer page opened as a program monitor (?monitor=1)', () => {
  test('dials /ws with no role, plays the graphic and sends the server nothing', async ({
    page,
  }) => {
    // Arrange: a monitor connected to a server with nothing on air.
    const fakeServer = await startFakeServerForPage(page, {
      instancesOnAir: [],
      pageIsAProgramMonitor: true,
    });
    await openProgramMonitorAndWaitForItsLayers(page);

    // Act: the operator takes the enduro clock and the monitor plays it; then the clock is
    // cleared, and its dispose proves the operation that played it is over.
    fakeServer.sendInstances([createEnduroInstance('green')]);
    await waitUntilTheFakeGraphicWroteDown(page, 'Enduro: playAction finished');
    fakeServer.sendInstances([]);
    await waitUntilTheFakeGraphicWroteDown(page, 'Enduro: dispose finished');

    // Assert: one connection, to plain /ws, and not one message from the page.
    expect(
      fakeServer.readConnectionAddresses(),
      'a monitor must connect to /ws with no role, so the server does not take it for a renderer',
    ).toEqual([expect.stringMatching(/\/ws$/)]);
    expect(
      fakeServer.readMessagesFromThePage(),
      'a monitor must send no instanceStatus (or anything else) after playing a graphic',
    ).toEqual([]);
  });

  test('sends the server nothing when a graphic fails to load', async ({ page }) => {
    // Arrange: a monitor connected to a server with nothing on air.
    const fakeServer = await startFakeServerForPage(page, {
      instancesOnAir: [],
      pageIsAProgramMonitor: true,
    });
    await openProgramMonitorAndWaitForItsLayers(page);
    const lowerThirdOfUfprWhoseLoadRejects = createInstance(
      ufprInstanceId,
      'lower-third',
      'fake-graphic',
      { teamNumber: 42, teamName: 'Baja UFPR', fakeGraphicLoadOutcome: 'rejects' },
    );

    // Act: team 42's lower third is taken and its load throws. Then FEI's lower third is
    // taken on the same layer and cleared: its play and its dispose prove the failed
    // operation before it is over.
    fakeServer.sendInstances([lowerThirdOfUfprWhoseLoadRejects]);
    await waitUntilTheFakeGraphicWroteDown(page, 'UFPR: load finished');
    fakeServer.sendInstances([createTeamInstance(feiInstanceId, 7, 'FEI Baja')]);
    await waitUntilTheFakeGraphicWroteDown(page, 'FEI: playAction finished');
    fakeServer.sendInstances([]);
    await waitUntilTheFakeGraphicWroteDown(page, 'FEI: dispose finished');

    // Assert: the failed graphic was never played, and the page said nothing about it or
    // about the one that did go on the monitor.
    expect(
      await readFakeGraphicCallsAsSentences(page, instanceNames),
      'the lower third whose load failed must not have been played',
    ).not.toContain('UFPR: playAction called');
    expect(
      fakeServer.readMessagesFromThePage(),
      'a monitor must send no instanceStatus, neither failed nor on-air',
    ).toEqual([]);
  });
});
