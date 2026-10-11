/**
 * Take and clear, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   An operator must be able to open the control page, put the race clock on air, change
 *   it while it is on air without it leaving the screen, and take it off again, with the
 *   server as the only owner of the state. These tests walk that path in a real Chromium
 *   against the real server, the real renderer page and a real SQLite file.
 *
 *   The form they fill is "Edição rápida", in the centre of the page. Nothing in the page
 *   is written for the race clock: the fields are generated from the clock's manifest, so
 *   their labels here are the manifest's titles.
 *
 *   Two renderer pages take part, and they are not equals. The program output is the
 *   page OBS loads, `/render/`; here a second browser page opened at that address stands
 *   in for OBS. The program monitor is the small frame on the control page,
 *   `/render/?monitor=1`. Only the program output is the truth about what is on air: it
 *   alone tells the server "the clock is on screen". The monitor draws and says nothing.
 *
 * What these tests prove:
 *   - With OBS (its stand-in) connected, pressing "Colocar no ar" makes the layer panel
 *     say "No ar" within 3 seconds and show the clock on the "Relógio" layer, and the
 *     program monitor contains the race clock element, counting on from the typed time
 *     (the server stamps the moment of the take; the page sends no clock of its own).
 *   - Changing the flag and pressing "Atualizar" changes the flag band of the clock in
 *     the program monitor, and the clock there is the very same element as before: it
 *     was updated in place and never left the screen (no blink).
 *   - Reloading the page changes nothing: the panel still shows the clock, because the
 *     state lives on the server and not in the page; and the form comes back showing
 *     what is on air instead of the manifest's defaults, the time as mm:ss.
 *   - Pressing "Limpar" on that layer brings it back to "vazia".
 *   - With only the control page open (no OBS), the layer stays "Carregando" after the
 *     take even though the clock is plainly visible in the program monitor; it turns to
 *     "No ar" only once OBS (its stand-in) is opened. The monitor never reports.
 *
 * What these tests deliberately do not cover:
 *   - What the clock in the program monitor looks like or which time it shows; the
 *     renderer's raceClockOnAir.e2e.ts checks that. Here it only has to be in the frame,
 *     stay the same element and show the new flag's word.
 *   - That "No ar" appears within one second, as the brief says. That is checked by eye
 *     in OBS; here the limit is 3 seconds, because the clock's own play-in animation
 *     takes 600 ms of any such second and a busy CI machine can use up the rest.
 *   - OBS itself: its stand-in is the same `/render/` page in Chromium, not OBS's browser.
 *   - A graphic that fails to load ("Falhou"); the renderer's own browser tests and
 *     InstanceStatusBadge.test.tsx cover the two halves of that.
 *   - A restart of the server keeping the state; the server's storeRestart.test.ts does.
 *   - Field validation, clear all and the keyboard; the component tests cover those.
 *   - An item of the rundown changed on air from the item editor ("Atualizar no ar");
 *     itemUpdateOnAir.e2e.ts covers that.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics and both renderer pages are the built renderer.
 *
 * Sharing the server with the other tests:
 *   Every test in this folder runs against the same server. Before each test the server
 *   is emptied (nothing on air, no item in the rundown), so a test here passes whatever
 *   ran before it, in any order, and one that stops halfway cannot fail the next.
 */
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';

/** Opens the control page and waits until it says it is connected to the server. */
async function openControlPageAndWaitUntilConnected(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before anything can be taken',
  ).toHaveText('Conectado');
}

/**
 * Finds the centre area of the control page, which holds the program monitor and
 * "Edição rápida". Fields are looked up inside it, because the item editor (in the
 * rundown column) draws a generated form with the same labels when it is open.
 */
function findProgramAndQuickEditArea(page: Page): Locator {
  return page.getByRole('region', { name: 'Programa e edição rápida' });
}

/**
 * Fills "Edição rápida" for the endurance race, 12 min 34 s in, under the green flag,
 * with the clock running. It does not press "Colocar no ar". The moment the time refers
 * to is left as the form opens, "Momento da entrada no ar": the server writes it at the take.
 */
async function fillQuickEditForTheEnduranceRace(page: Page): Promise<void> {
  const quickEditArea = findProgramAndQuickEditArea(page);
  await expect(
    quickEditArea.getByRole('combobox', { name: 'Gráfico a editar' }),
    '"Edição rápida" must open on the race clock, the one graphic the server has',
  ).toContainText('Relógio de prova');
  await quickEditArea
    .getByLabel('Nome da sessão', { exact: true })
    .fill('Enduro de Resistência — Bateria 1');
  await quickEditArea.getByRole('combobox', { name: 'Bandeira', exact: true }).click();
  await page.getByRole('option', { name: 'Verde' }).click();
  await quickEditArea.getByRole('switch', { name: 'Relógio correndo' }).click();
  await quickEditArea.getByLabel('Tempo de referência', { exact: true }).fill('12:34');
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

/** Finds the race clock element inside the program monitor frame of the control page. */
function findRaceClockInProgramMonitor(page: Page): Locator {
  return page
    .frameLocator('iframe[title="Programa"]')
    .locator('[data-layer-id="clock"] > baja-graphic-race-clock');
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('taking, updating and clearing the race clock with OBS connected', () => {
  test('says "No ar" after the take, updates the clock in place, keeps it across a reload, and empties the layer on clear', async ({
    page,
    context,
  }) => {
    // Arrange: OBS is already showing the program output (a second page at /render/
    // stands in for it), the control page is open and connected, and the form is filled.
    const programOutputPage = await openProgramOutputAsObsDoes(context);
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = page.getByRole('listitem', { name: 'Relógio' });
    await expect(clockLayerRow, 'the clock layer must start empty').toContainText('vazia');
    await fillQuickEditForTheEnduranceRace(page);

    // Act: put the clock on air.
    await page.getByRole('button', { name: 'Colocar no ar' }).click();

    // Assert: the layer panel comes to say the clock is "No ar". That word only appears
    // after the program output (the OBS stand-in, never the monitor) has played the
    // clock in (a 600 ms animation) and reported it to the server, so it proves the
    // whole round trip. The limit is 3 seconds, by João's ruling: the brief's one second
    // leaves too little after the animation on a busy CI machine, and no limit at all
    // would let a round trip that has become slow go unnoticed.
    await expect(
      clockLayerRow,
      'the layer panel must say "No ar" within 3 seconds of the take, once the program output has reported the clock',
    ).toContainText('No ar', { timeout: 3_000 });
    // And within 2 seconds the layer panel shows the race clock on the clock layer.
    await expect(
      clockLayerRow,
      'the layer panel must show the race clock within 2 seconds of the take',
    ).toContainText('Relógio de prova', { timeout: 2_000 });
    await expect(clockLayerRow, 'a layer with the clock on it is not "vazia"').not.toContainText(
      'vazia',
    );
    // The program monitor is the renderer page in a frame, so the clock element must be
    // inside that frame, on the clock layer, exactly as OBS has it.
    const raceClockInProgramMonitor = findRaceClockInProgramMonitor(page);
    await expect(
      raceClockInProgramMonitor,
      'the program monitor frame must contain the race clock element after the take',
    ).toBeAttached();
    await expect(
      raceClockInProgramMonitor.getByTestId('race-clock-flag-label'),
      'the clock in the program monitor must show the green flag it was taken with',
    ).toHaveText('VERDE');
    // The clock counts on from the typed 12:34, starting at the take. The page sent no
    // moment of its own: the server wrote the moment of the take into the data.
    // (12:34 to 12:39 are the first seconds after the take.)
    await expect(
      raceClockInProgramMonitor.getByTestId('race-clock-time'),
      'a clock taken running at 12:34 must count on from 12:34 at the take',
    ).toHaveText(/^\s*12:3[4-9]\s*$/);

    // Arrange (for the update): remember which element the clock in the program monitor
    // is. A handle points at that one element; it is not found again later.
    const raceClockElementBeforeTheUpdate = await raceClockInProgramMonitor.elementHandle();

    // Act: a yellow flag comes out. Change only the flag and press "Atualizar".
    const quickEditArea = findProgramAndQuickEditArea(page);
    await quickEditArea.getByRole('combobox', { name: 'Bandeira', exact: true }).click();
    await page.getByRole('option', { name: 'Amarela' }).click();
    await quickEditArea.getByRole('button', { name: 'Atualizar', exact: true }).click();

    // Assert: the clock in the program monitor shows the yellow flag, and it is the same
    // element as before the update. Had the clock been taken off and put back (the blink
    // this command exists to remove), a new element would be in its place.
    await expect(
      raceClockInProgramMonitor.getByTestId('race-clock-flag-label'),
      'after "Atualizar" the clock in the program monitor must show the yellow flag',
    ).toHaveText('AMARELA');
    const isTheSameElementAsBeforeTheUpdate = await raceClockInProgramMonitor.evaluate(
      (raceClockElementNow, raceClockElementBefore) =>
        raceClockElementNow === raceClockElementBefore,
      raceClockElementBeforeTheUpdate,
    );
    expect(
      isTheSameElementAsBeforeTheUpdate,
      'the race clock must be updated in place: the same element as before, not a new one',
    ).toBe(true);
    await expect(
      clockLayerRow,
      'an update must leave the clock "No ar"; it never goes back to "Carregando"',
    ).toContainText('No ar');

    // Act: reload the page, as an operator does when the browser misbehaves.
    await page.reload();

    // Assert: nothing was lost, because the server is the truth; and since the clock is
    // on air, "Edição rápida" offers "Atualizar" and its form shows what is on air, yellow
    // flag included. The time field shows the reference time that is on air, 12:34, and
    // not the time the running clock has reached: the form shows the data, as it is.
    await expect(
      clockLayerRow,
      'after a reload the layer panel must still show the race clock',
    ).toContainText('Relógio de prova');
    await expect(
      quickEditArea.getByRole('button', { name: 'Atualizar', exact: true }),
      'with the clock on air the form must offer "Atualizar"',
    ).toBeVisible();
    await expect(
      quickEditArea.getByLabel('Nome da sessão', { exact: true }),
      'after a reload the form must show the session name that is on air, not its default',
    ).toHaveValue('Enduro de Resistência — Bateria 1');
    await expect(
      quickEditArea.getByRole('combobox', { name: 'Bandeira', exact: true }),
      'after a reload the form must show the flag that is on air',
    ).toHaveText('Amarela');
    await expect(
      quickEditArea.getByRole('switch', { name: 'Relógio correndo' }),
      'after a reload the switch must be on, because the clock on air is running',
    ).toBeChecked();
    await expect(
      quickEditArea.getByLabel('Tempo de referência', { exact: true }),
      'after a reload the time field must show the reference time on air as minutes and seconds',
    ).toHaveValue('12:34');

    // Act: clear the clock layer.
    await clockLayerRow.getByRole('button', { name: 'Limpar' }).click();

    // Assert: the layer is empty again.
    await expect(clockLayerRow, 'after "Limpar" the clock layer must say "vazia"').toContainText(
      'vazia',
    );

    // Tidy up: close OBS's stand-in.
    await programOutputPage.close();
  });
});

test.describe('taking the race clock with no OBS connected', () => {
  test('stays "Carregando" while only the program monitor shows the clock, and says "No ar" once OBS is opened', async ({
    page,
    context,
  }) => {
    // Arrange: only the control page is open, as when the operator starts before OBS
    // does. Its program monitor is the one renderer page there is. The form is filled.
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = page.getByRole('listitem', { name: 'Relógio' });
    await expect(clockLayerRow, 'the clock layer must start empty').toContainText('vazia');
    await fillQuickEditForTheEnduranceRace(page);

    // Act: put the clock on air.
    await page.getByRole('button', { name: 'Colocar no ar' }).click();

    // Assert: the clock is drawn in the program monitor, yet the layer says "Carregando".
    await expect(
      findRaceClockInProgramMonitor(page).getByTestId('race-clock-flag-label'),
      'the program monitor must draw the clock, green flag and all, even with no OBS connected',
    ).toHaveText('VERDE');
    await expect(
      clockLayerRow,
      'right after the take the layer must say "Carregando": nothing has reported the clock yet',
    ).toContainText('Carregando');
    // A page that reports does so when the clock's 600 ms play-in ends. So wait well past
    // that on purpose: checking at once would pass even if the monitor did report, and
    // this test exists to catch exactly that. 1.5 s is the play-in plus time for a
    // report to travel to the server and back on a slow machine.
    await page.waitForTimeout(1_500);
    await expect(
      clockLayerRow,
      'the layer must still say "Carregando" long after the monitor drew the clock: the program monitor must never report what is on air',
    ).toContainText('Carregando');
    await expect(
      clockLayerRow,
      'with no OBS connected nothing may turn the layer to "No ar"',
    ).not.toContainText('No ar');

    // Act: OBS starts and loads the program output (its stand-in opens /render/).
    const programOutputPage = await openProgramOutputAsObsDoes(context);

    // Assert: now the layer says "No ar", because the program output drew the clock that
    // was already on air and reported it. The 5 seconds are not the 3-second rule of the
    // take above: here OBS arrives late and still has to load the clock's package.
    await expect(
      clockLayerRow,
      'the layer must say "No ar" once the program output has drawn and reported the clock',
    ).toContainText('No ar', { timeout: 5_000 });

    // Tidy up: close OBS's stand-in. The clock is left on air on purpose: the next test,
    // whichever it is, empties the server before it starts.
    await programOutputPage.close();
  });
});
