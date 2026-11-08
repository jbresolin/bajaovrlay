/**
 * Stopping a running clock on air without making it jump, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   A race clock on air holds one reading ("at 9:45 it read 12:34") and counts on from
 *   it by itself. When the operator stops it, the control page sends the switch and
 *   nothing else: it knows no clock rule. It is the server that keeps the clock where it
 *   was (the race clock's manifest names the update rule `carryClockForward`): it writes
 *   the time the screen was showing as the new reading. Without that the clock would
 *   jump back to 12:34 in front of the audience. These tests stop a running clock in a
 *   real Chromium against the real server and the real renderer page, from both places
 *   an operator can do it.
 *
 *   As in takeAndClear.e2e.ts, a second browser page at `/render/` stands in for OBS: it
 *   is the program output, the truth about what the viewers see.
 *
 * What these tests prove:
 *   - From "Edição rápida": a clock made with "Novo gráfico…", taken running at 12:34 with
 *     "Salvar e disparar", loaded with its row's "Editar" and stopped with "Atualizar"
 *     once it shows 12:38 is held by the server at the time it had reached: 12:34 plus
 *     the time between the take and the stop, both moments as the server stamped them.
 *     Not 12:34. The program output shows that time, still a second and a half later,
 *     and still after a flag change with "Atualizar".
 *   - "Edição rápida" then shows that same time in its time field, with the switch off:
 *     the form follows what the server put on air.
 *   - From the item editor: the same stop with "Atualizar no ar" on an item fired from
 *     the rundown gives the same result on the program output.
 *
 *   Why the time held is checked against the clock's own two readings, and not against
 *   the 12:38 the program output showed before the stop (BAJAOVRLAY-61): that 12:38 was
 *   worked out from the machine's wall clock at one moment and the stop from it at a later
 *   one, and the wall clock can be set back between the two. Under load on WSL2 it once
 *   went back about a second (the server's `time` messages, sent every 10 s, came 8.97 s
 *   apart by their stamps), so the server stopped the clock at 12:37.8, which is right by
 *   its own reading. The sum below holds whatever the wall clock does.
 *
 * What these tests deliberately do not cover:
 *   - The exact time the server writes, a clock started again, a typed time, a change of
 *     the clock's direction and a countdown; the server's
 *     updateInstanceDataCarriesTheClock.test.ts has a row for each, with a fixed clock.
 *   - Which commands the two presses send; QuickEditPanelUpdate.test.tsx and
 *     ItemEditorPanelUpdateOnAir.test.tsx do.
 *   - That the stop changes the clock in place (same element); takeAndClear.e2e.ts and
 *     itemUpdateOnAir.e2e.ts prove that for an update.
 *   - OBS itself: its stand-in is the same `/render/` page in Chromium, not OBS's browser.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics and the program output is the built renderer.
 *
 * Sharing the server with the other tests:
 *   Every test in this folder runs against the same server. Before each test the server
 *   is emptied (nothing on air, no item in the rundown), so a test here passes whatever
 *   ran before it, in any order, and leaves its own item and clock behind without harm.
 */
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import { findItemEditorOwnTextField } from './itemEditorOwnFields';
import {
  chooseGraphicInTheItemEditor,
  openItemEditorWithNewGraphic,
  raceClockGraphicName,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';

// The clock is taken at 12:34 (754,000 ms) and left running until the program output
// shows 12:38 or later; only then is it stopped. So a clock that "stopped where it was"
// holds a few seconds more than 12:34, and one that "jumped back to its reference" holds
// 12:34 itself: the two cannot be mistaken for one another. The upper end, 12:49, leaves
// a slow machine eleven seconds. The spaces are the ones the graphic's markup has around
// the text.
const timeOfAClockThatHasRunLongEnough = /^\s*12:(3[89]|4\d)\s*$/;
const timeTheClockIsTakenAtMilliseconds = 754_000;

// How long the tests wait for the running clock to get there: four seconds of running,
// and as much again for a slow machine.
const timeAllowedForTheClockToRunInMilliseconds = 8_000;

// How long the tests then watch a stopped clock. The clock shows whole seconds, so a
// clock still running shows another time after a second and a half. This is waited out
// on purpose: checking at once would pass for a clock that is still counting.
const timeToSeeThatTheClockIsHeldInMilliseconds = 1_500;

/** Opens the control page and waits until it says it is connected to the server. */
async function openControlPageAndWaitUntilConnected(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before anything can be taken',
  ).toHaveText('Conectado');
}

/**
 * Opens the program output as OBS does: a page of its own at `/render/`, with nothing
 * after it. Returns once that page has drawn its layers, which it only does after the
 * server has sent it the state, so by then it is connected and ready to report.
 */
async function openProgramOutputAsObsDoes(browserContext: BrowserContext): Promise<Page> {
  const programOutputPage = await browserContext.newPage();
  await programOutputPage.goto('/render/');
  await expect(
    programOutputPage.locator('[data-layer-id="clock"]'),
    'the OBS stand-in must be connected and have drawn its clock layer',
  ).toBeAttached();
  return programOutputPage;
}

/** Finds the race clock element on the clock layer of the program output (the OBS stand-in). */
function findRaceClockInProgramOutput(programOutputPage: Page): Locator {
  return programOutputPage.locator('[data-layer-id="clock"] > baja-graphic-race-clock');
}

/**
 * Finds the centre area of the control page, which holds "Edição rápida". Its fields are
 * looked up inside it, because the item editor draws the same labels when it is open.
 */
function findProgramAndQuickEditArea(page: Page): Locator {
  return page.getByRole('region', { name: 'Programa e edição rápida' });
}

/** Finds the item editor, whose fields carry the same labels as "Edição rápida". */
function findItemEditor(page: Page): Locator {
  return page.getByRole('region', { name: 'Editor de item' });
}

/** Finds the row of the "Relógio" layer in the layer panel. */
function findClockLayerRow(page: Page): Locator {
  return page.getByRole('region', { name: 'Camadas' }).getByRole('listitem', { name: 'Relógio' });
}

/**
 * Fills a generated race clock form (in "Edição rápida" or in the item editor) for the
 * endurance race, 12 min 34 s in, with the clock running. The moment the time refers to
 * is left as the form opens, "Momento da entrada no ar": the server writes it at the take.
 */
async function fillClockFormRunningFromTwelveThirtyFour(formArea: Locator): Promise<void> {
  await formArea.getByLabel('Título', { exact: true }).fill('Enduro — Bateria 1');
  await formArea.getByRole('switch', { name: 'Relógio correndo' }).click();
  await formArea.getByLabel('Tempo de referência', { exact: true }).fill('12:34');
}

/**
 * One reading of the race clock on the program output, as the server holds it: "at the
 * server's moment `referenceWallClockMs` the clock read `referenceTimeMs`", running or held.
 */
type ClockReadingOnTheServer = {
  referenceTimeMs: number;
  referenceWallClockMs: number;
  running: boolean;
};

/** What the tests read of GET /api/v1/state: the instances, with their data. */
type StateTheClockTestsRead = {
  instances: Array<{ layerId: string; target: string; resolvedData: Record<string, unknown> }>;
};

/** Reads the reading of the race clock on the program output from the real server. */
async function readClockReadingOnTheServer(): Promise<ClockReadingOnTheServer> {
  const response = await fetch(`http://127.0.0.1:${String(realServerPort)}/api/v1/state`);
  const state = (await response.json()) as StateTheClockTestsRead;
  const clockOnAir = state.instances.find(
    (instance) => instance.layerId === 'clock' && instance.target === 'program',
  );
  if (clockOnAir === undefined) {
    throw new Error('the server has no clock on the program output');
  }
  return {
    referenceTimeMs: Number(clockOnAir.resolvedData.referenceTimeMs),
    referenceWallClockMs: Number(clockOnAir.resolvedData.referenceWallClockMs),
    running: clockOnAir.resolvedData.running === true,
  };
}

/** Waits until the server holds the clock stopped, and returns that reading. */
async function readClockReadingOnceTheServerStoppedIt(): Promise<ClockReadingOnTheServer> {
  await expect
    .poll(async () => (await readClockReadingOnTheServer()).running, {
      message: 'the server must stop the clock once "Atualizar" is pressed',
    })
    .toBe(false);
  return readClockReadingOnTheServer();
}

/**
 * Checks that the stop held the clock at the time it had reached, by the clock's own
 * readings: the time read at the take, plus the time from the take's moment to the stop's
 * moment, both as the server stamped them. A clock that jumped back would hold the 12:34
 * it was taken with instead.
 */
function expectTheStopToHoldTheTimeTheClockHadReached(
  readingWhileRunning: ClockReadingOnTheServer,
  readingOnceStopped: ClockReadingOnTheServer,
): void {
  const timeFromTheTakeToTheStopMs =
    readingOnceStopped.referenceWallClockMs - readingWhileRunning.referenceWallClockMs;
  const timeTheClockHadReachedMs = readingWhileRunning.referenceTimeMs + timeFromTheTakeToTheStopMs;
  expect(
    readingOnceStopped.referenceTimeMs,
    'the server must hold the time the clock had reached at the stop, by its own reading',
  ).toBe(timeTheClockHadReachedMs);
  expect(
    readingOnceStopped.referenceTimeMs,
    'the clock must have run on from the 12:34 it was taken with, not jumped back to it',
  ).toBeGreaterThan(timeTheClockIsTakenAtMilliseconds);
}

/**
 * Writes a time as a counting-up race clock shows it: whole minutes and seconds, the part
 * of a second dropped (757,804 ms is "12:37"). Enough for these tests, which stay under
 * an hour.
 */
function writeTimeAsTheClockShowsIt(timeMs: number): string {
  const wholeSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Waits until "Edição rápida" shows the clock stopped at `timeShown`. With the clock
 * loaded, the form follows what the server holds for it, whoever changed it.
 */
async function expectQuickEditToShowTheClockStoppedAt(
  page: Page,
  timeShown: string,
): Promise<void> {
  const quickEditArea = findProgramAndQuickEditArea(page);
  await expect(
    quickEditArea.getByRole('switch', { name: 'Relógio correndo' }),
    '"Edição rápida" must show the switch off once the server has stopped the clock',
  ).not.toBeChecked();
  await expect(
    quickEditArea.getByLabel('Tempo de referência', { exact: true }),
    '"Edição rápida" must show the time the server holds the clock at',
  ).toHaveValue(timeShown);
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('stopping a running race clock that is on air', () => {
  test('"Atualizar" in "Edição rápida" stops the clock at the time it was showing, and a flag change leaves that time alone', async ({
    page,
    context,
  }) => {
    // Arrange: OBS is showing the program output (a second page at /render/ stands in
    // for it). The clock is made with "Novo gráfico…", taken running at 12:34 with
    // "Salvar e disparar", and is "No ar".
    const programOutputPage = await openProgramOutputAsObsDoes(context);
    await openControlPageAndWaitUntilConnected(page);
    const quickEditArea = findProgramAndQuickEditArea(page);
    const itemEditor = await openItemEditorWithNewGraphic(page, 'Relógio — Bateria 1');
    await fillClockFormRunningFromTwelveThirtyFour(itemEditor);
    await saveAndTakeTheItemInTheEditor(itemEditor);
    await expect(
      findClockLayerRow(page),
      'the layer panel must say "No ar" within 3 seconds of the take, once the program output has reported the clock',
    ).toContainText('No ar', { timeout: 3_000 });
    const clockTimeInProgramOutput =
      findRaceClockInProgramOutput(programOutputPage).getByTestId('race-clock-time');
    // The clock is left running until the program output shows 12:38: see the constant.
    await expect(
      clockTimeInProgramOutput,
      'a clock taken running at 12:34 must have counted on to 12:38 on the program output',
    ).toHaveText(timeOfAClockThatHasRunLongEnough, {
      timeout: timeAllowedForTheClockToRunInMilliseconds,
    });
    // The reading the server took the clock with: 12:34 at the moment of the take.
    const readingWhileRunning = await readClockReadingOnTheServer();

    // Act: load the clock with its row's "Editar", switch "Relógio correndo" off, changing
    // nothing else, and press "Atualizar".
    await findClockLayerRow(page).getByRole('button', { name: 'Editar', exact: true }).click();
    await quickEditArea.getByRole('switch', { name: 'Relógio correndo' }).click();
    await quickEditArea.getByRole('button', { name: 'Atualizar', exact: true }).click();

    // Assert: the server held the clock at the time it had reached, by its own reading,
    // and the form shows that time. Had the clock jumped, this would read 12:34.
    const readingOnceStopped = await readClockReadingOnceTheServerStoppedIt();
    expectTheStopToHoldTheTimeTheClockHadReached(readingWhileRunning, readingOnceStopped);
    const timeTheClockWasStoppedAt = writeTimeAsTheClockShowsIt(readingOnceStopped.referenceTimeMs);
    await expectQuickEditToShowTheClockStoppedAt(page, timeTheClockWasStoppedAt);
    // The program output shows that very time...
    await expect(
      clockTimeInProgramOutput,
      'the program output must show the clock stopped at the time it had reached, the one the form now shows',
    ).toHaveText(timeTheClockWasStoppedAt);
    // ...and still shows it a second and a half later, so the clock is really held.
    await page.waitForTimeout(timeToSeeThatTheClockIsHeldInMilliseconds);
    await expect(
      clockTimeInProgramOutput,
      'a stopped clock must still show the same time a second and a half later',
    ).toHaveText(timeTheClockWasStoppedAt);

    // Act: a yellow flag comes out. Change only the flag and press "Atualizar".
    await quickEditArea.getByRole('combobox', { name: 'Bandeira', exact: true }).click();
    await page.getByRole('option', { name: 'Amarela', exact: true }).click();
    await quickEditArea.getByRole('button', { name: 'Atualizar', exact: true }).click();

    // Assert: the flag changed on the program output and the stopped time did not.
    await expect(
      findRaceClockInProgramOutput(programOutputPage).getByTestId('race-clock-flag-label'),
      'after "Atualizar" the program output must show the yellow flag',
    ).toHaveText('AMARELA');
    await expect(
      clockTimeInProgramOutput,
      'a flag change must leave the stopped clock at the time it was stopped at',
    ).toHaveText(timeTheClockWasStoppedAt);

    // Tidy up: close OBS's stand-in. The clock is left on air on purpose: the next test,
    // whichever it is, empties the server before it starts.
    await programOutputPage.close();
  });

  test('"Atualizar no ar" in the item editor stops the clock of an item at the time it was showing', async ({
    page,
    context,
  }) => {
    // Arrange: OBS's stand-in is open. A clock item running from 12:34 is made in the
    // item editor, fired from the rundown with "Disparar", and is "No ar".
    const programOutputPage = await openProgramOutputAsObsDoes(context);
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = findItemEditor(page);
    await page.getByRole('button', { name: '+ Item' }).click();
    await chooseGraphicInTheItemEditor(page, itemEditor, raceClockGraphicName);
    await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill('Enduro em andamento');
    await fillClockFormRunningFromTwelveThirtyFour(itemEditor);
    await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
    await expect(
      itemEditor,
      'the editor must close once the server has accepted the item',
    ).toBeHidden();
    const enduranceRow = page
      .getByRole('region', { name: 'Rundown' })
      .getByRole('listitem', { name: 'Enduro em andamento' });
    await enduranceRow.getByRole('button', { name: 'Disparar' }).click();
    await expect(
      findClockLayerRow(page),
      'the layer panel must say "No ar" within 3 seconds of the take, once the program output has reported the clock',
    ).toContainText('No ar', { timeout: 3_000 });
    const clockTimeInProgramOutput =
      findRaceClockInProgramOutput(programOutputPage).getByTestId('race-clock-time');
    // The clock is left running until the program output shows 12:38: see the constant.
    await expect(
      clockTimeInProgramOutput,
      'a clock taken running at 12:34 must have counted on to 12:38 on the program output',
    ).toHaveText(timeOfAClockThatHasRunLongEnough, {
      timeout: timeAllowedForTheClockToRunInMilliseconds,
    });
    // The reading the server took the clock with: 12:34 at the moment of the take.
    const readingWhileRunning = await readClockReadingOnTheServer();

    // Act: open the item, switch "Relógio correndo" off and press "Atualizar no ar".
    await enduranceRow.getByRole('button', { name: 'Editar item', exact: true }).click();
    await itemEditor.getByRole('switch', { name: 'Relógio correndo' }).click();
    await itemEditor.getByRole('button', { name: 'Atualizar no ar' }).click();

    // Assert: the editor closed, so the save and the on-air update were both accepted.
    await expect(
      itemEditor,
      'the editor must close once the save and the on-air update were both accepted',
    ).toBeHidden();
    // The item editor sent the switch alone, as "Edição rápida" does, and the server held
    // the clock at the time it had reached, by its own reading. Had the clock jumped back
    // to what the item stores, it would hold 12:34.
    const readingOnceStopped = await readClockReadingOnceTheServerStoppedIt();
    expectTheStopToHoldTheTimeTheClockHadReached(readingWhileRunning, readingOnceStopped);
    const timeTheClockWasStoppedAt = writeTimeAsTheClockShowsIt(readingOnceStopped.referenceTimeMs);
    // Loaded into "Edição rápida" with "Editar" on its "Camadas" row, the clock shows there
    // stopped at that time.
    await findClockLayerRow(page).getByRole('button', { name: 'Editar', exact: true }).click();
    await expectQuickEditToShowTheClockStoppedAt(page, timeTheClockWasStoppedAt);
    await expect(
      clockTimeInProgramOutput,
      'the program output must show the clock stopped at the time it had reached, not at the 12:34 the item stores',
    ).toHaveText(timeTheClockWasStoppedAt);
    // And it still shows that time a second and a half later, so the clock is really held.
    await page.waitForTimeout(timeToSeeThatTheClockIsHeldInMilliseconds);
    await expect(
      clockTimeInProgramOutput,
      'a stopped clock must still show the same time a second and a half later',
    ).toHaveText(timeTheClockWasStoppedAt);

    // Tidy up: close OBS's stand-in. The item and the clock are left behind on purpose:
    // the next test, whichever it is, empties the server before it starts.
    await programOutputPage.close();
  });
});
