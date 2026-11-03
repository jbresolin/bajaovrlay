/**
 * Preparing a rundown and firing it with Space, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Before a session the operator prepares items (a graphic, a layer and the values to
 *   show) in the rundown; during it, Space puts the next one on air. This test walks
 *   that path in a real Chromium against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - Two race clock items made in the item editor, whose fields are generated from the
 *     clock's manifest, appear in the rundown in the order they were made, and the first
 *     one gets the cursor ("Próximo").
 *   - Space puts the item at the cursor on air even though the last mouse click left the
 *     focus on a button ("Limpar tudo"): the layer panel names the item by its label on
 *     the "Relógio" layer, the button under the focus was NOT pressed, and the cursor
 *     moves to the second item.
 *   - A clock saved running counts from the TAKE, not from the save: taken at least six
 *     seconds after it was saved, the clock in the program monitor never shows more than
 *     the time since Space was pressed.
 *   - The Left arrow moves the cursor back to the first item, still with the focus on
 *     that button, and puts nothing on air; with "Prévia automática" on, as it starts,
 *     that item is then listed under the "Prévia" monitor.
 *   - Reloading the page changes nothing: the rundown, the cursor and the label on the
 *     layer are all still there, because they live on the server and not in the page.
 *   - "Excluir" takes two presses: the first only asks ("Confirmar: excluir"), the second
 *     takes the row out of the rundown.
 *
 * What these tests deliberately do not cover:
 *   - Every field of the item editor, reordering by drag, the Right arrow, the click on
 *     a label and the keys' guards; the component tests in src/features/items/ and
 *     src/features/rundown/ do.
 *   - What the clock looks like on air; the renderer's own browser tests check that.
 *   - "No ar" on the layer: no OBS stand-in is opened here, and the program monitor
 *     (`/render/?monitor=1`) draws the clock without ever reporting it, so the layer
 *     stays "Carregando". takeAndClear.e2e.ts covers that report.
 *   - Changing an item that is on air ("Atualizar no ar"); itemUpdateOnAir.e2e.ts does.
 *   - Space sending a PREVIEW to air, and the Right arrow previewing; here nothing is
 *     previewed when Space is pressed, so Space is `takeNext`. previewThenTake.e2e.ts does.
 *   - Auto-out and a server restart; the server's tests cover both.
 *
 * Sharing the server with the other tests:
 *   Every test in this folder runs against the same server. Before each test the server
 *   is emptied (nothing on air, no item in the rundown), so this test passes whatever
 *   ran before it, in any order, and leaves its own items and clock behind without harm.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics.
 *
 * Why the waits are for events and the clock is compared with a stopwatch: on a busy
 * machine the monitor may draw the clock several seconds after the take, and "Limpar
 * tudo" may go back to normal well after its 3 seconds. A check that the clock reads
 * 0:00 to 0:03, or that the button is back within the usual 5 s, then fails for nothing
 * (BAJAOVRLAY-52). So the test waits for the button and the clock to be drawn, ended
 * only by its own timeout, and checks the clock against the time since Space was
 * pressed, which holds however late the monitor draws.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import { findItemEditorOwnTextField } from './itemEditorOwnFields';
import { chooseGraphicInTheItemEditor, raceClockGraphicName } from './previewTestSteps';

// How long the test lets pass between saving the running clock and taking it. A clock
// counted from the save then shows at least six seconds more than the time since the
// take, so the two cannot be mistaken for one another, however slow the machine.
const timeBetweenTheSaveAndTheTakeInMilliseconds = 6_000;

// The margin the clock may read above the stopwatch: the clock shows whole seconds and
// the server stamps the take a moment after the key is pressed, so it never reads more
// than the stopwatch; one second covers any rounding. Far less than the six seconds a
// clock counted from the save would add.
const clockMarginAboveTheStopwatchInSeconds = 1;

/**
 * Opens the control page and waits until it is connected and shows the seeded rundown,
 * empty, with nothing on the clock layer: the server as it is before every test.
 */
async function openThePageOnAnEmptyRundown(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before anything can be prepared',
  ).toHaveText('Conectado');
  const rundownArea = page.getByRole('region', { name: 'Rundown' });
  await expect(
    rundownArea.getByRole('heading', { name: 'Sessão principal' }),
    'the server must have seeded the rundown "Sessão principal"',
  ).toBeVisible();
  await expect(
    rundownArea.getByRole('listitem'),
    'the rundown must start with no items, because the server was emptied before the test',
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Camadas' }).getByRole('listitem', { name: 'Relógio' }),
    'the clock layer must start empty, because the server was emptied before the test',
  ).toContainText('vazia');
}

/** What the test types into the item editor for one race clock item. */
type RaceClockItemToPrepare = {
  itemLabel: string;
  /** The session name the clock will show on air. */
  sessionName: string;
  /** true switches "Relógio correndo" on, so the clock counts by itself once on air. */
  isClockRunning: boolean;
};

/**
 * Prepares one race clock item through the item editor: "+ Item", the label, the session
 * name, the "Relógio correndo" switch when asked for, "Salvar item"; then waits for the
 * editor to close, which it does once the server has accepted the new item. The time is
 * left at the manifest's default, 0:00 counting up, and the moment it refers to as the
 * form opens for a new item, "Momento da entrada no ar": the server writes it at the take.
 */
async function createRaceClockItemInTheEditor(
  page: Page,
  itemToPrepare: RaceClockItemToPrepare,
): Promise<void> {
  await page.getByRole('button', { name: '+ Item' }).click();
  // The editor draws the clock's fields from its manifest, and so does "Edição rápida" in
  // the centre of the page, with the same labels; everything is looked up inside the
  // editor to tell them apart.
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  // The race clock is chosen by name: the server has the positions tower too.
  await chooseGraphicInTheItemEditor(page, itemEditor, raceClockGraphicName);
  await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill(itemToPrepare.itemLabel);
  await itemEditor.getByLabel('Título', { exact: true }).fill(itemToPrepare.sessionName);
  if (itemToPrepare.isClockRunning) {
    await itemEditor.getByRole('switch', { name: 'Relógio correndo' }).click();
  }
  await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
  await expect(
    itemEditor,
    `the editor must close once the server has accepted the item "${itemToPrepare.itemLabel}"`,
  ).toBeHidden();
}

/** Reads a clock text such as "0:07" or "1:02:03" as a number of seconds. */
function readClockTextAsSeconds(clockText: string): number {
  const parts = clockText.trim().split(':').map(Number);
  let seconds = 0;
  for (const part of parts) {
    seconds = seconds * 60 + part;
  }
  return seconds;
}

/**
 * Finds the race clock element inside the "Programa" monitor frame of the control page,
 * the right one of its two monitors (the other, "Prévia", frames the preview output).
 */
function findRaceClockInProgramMonitor(page: Page): Locator {
  return page
    .frameLocator('iframe[title="Programa"]')
    .locator('[data-layer-id="clock"] > baja-graphic-race-clock');
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('preparing a rundown and firing it with Space', () => {
  test('creates two clock items, takes the first with Space from a focused button, starts its clock at the take, moves the cursor back with the Left arrow, keeps it all across a reload, and deletes an item with two presses', async ({
    page,
  }) => {
    // Arrange: open the control page on the emptied server and prepare two items: the
    // start of the endurance race, with its clock running, and its finish.
    await openThePageOnAnEmptyRundown(page);
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const clockLayerRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Relógio' });
    await createRaceClockItemInTheEditor(page, {
      itemLabel: 'Largada do enduro',
      sessionName: 'Enduro — Largada',
      isClockRunning: true,
    });
    const momentTheStartItemWasSavedInMilliseconds = Date.now();
    await createRaceClockItemInTheEditor(page, {
      itemLabel: 'Chegada do enduro',
      sessionName: 'Enduro — Chegada',
      isClockRunning: false,
    });
    const startRow = rundownArea.getByRole('listitem', { name: 'Largada do enduro' });
    const finishRow = rundownArea.getByRole('listitem', { name: 'Chegada do enduro' });
    await expect(
      rundownArea.getByRole('listitem'),
      'the rundown must list the two items in the order they were made',
    ).toHaveText([/Largada do enduro/, /Chegada do enduro/]);
    await expect(
      startRow,
      'the first item of a new rundown must get the cursor, so Space has something to take',
    ).toHaveAttribute('aria-current', 'true');

    // Arrange (the focus): click "Limpar tudo" once and let its 3 seconds run out. One
    // click only arms that button and changes nothing on air, but it leaves the keyboard
    // focus on it, which is where a mouse click during a show leaves it. If Space
    // pressed the focused button, as browsers do, the button would be armed again.
    const clearAllButton = page.getByRole('button', { name: 'Limpar tudo', exact: true });
    await clearAllButton.click();
    await expect(
      page.getByRole('button', { name: 'Confirmar: limpar tudo' }),
      'one click must only arm "Limpar tudo"',
    ).toBeVisible();
    // "Limpar tudo" goes back to normal 3 seconds after the one click; the wait is for
    // that to happen, however late a busy machine runs the page's 3 s timer.
    await clearAllButton.waitFor({ state: 'visible' });
    await expect(clearAllButton, 'the focus must still be on "Limpar tudo"').toBeFocused();

    // Arrange (the clock): wait, on purpose, until six seconds have passed since the
    // start item was saved with its clock running. A clock that counted from the save
    // would then show 0:06 or more at the take.
    const timeSinceTheSaveInMilliseconds = Date.now() - momentTheStartItemWasSavedInMilliseconds;
    const timeStillToWaitInMilliseconds = Math.max(
      0,
      timeBetweenTheSaveAndTheTakeInMilliseconds - timeSinceTheSaveInMilliseconds,
    );
    await page.waitForTimeout(timeStillToWaitInMilliseconds);

    // Act: press Space, with the focus still on "Limpar tudo", starting a stopwatch.
    const momentSpaceWasPressedInMilliseconds = Date.now();
    await page.keyboard.press('Space');

    // Assert: the layer panel names the item that went on air.
    await expect(
      clockLayerRow,
      'the layer panel must show the label of the item Space put on air',
    ).toContainText('Largada do enduro');
    await expect(
      clockLayerRow,
      'the layer panel must still name the graphic that is on the layer',
    ).toContainText('Relógio de prova');
    // The focused button was not pressed: it is not asking to confirm.
    await expect(
      page.getByRole('button', { name: 'Confirmar: limpar tudo' }),
      'Space must take the next item and must NOT press the button the focus is on',
    ).toHaveCount(0);
    // The clock in the program monitor counts from the take: once drawn, it never shows
    // more than the stopwatch started at Space, although the item was saved six seconds
    // or more before the take. Read the clock first, then the stopwatch, so the
    // stopwatch is never the one behind.
    const clockTimeInTheMonitor =
      findRaceClockInProgramMonitor(page).getByTestId('race-clock-time');
    await clockTimeInTheMonitor.waitFor({ state: 'visible' });
    await expect
      .poll(
        async () => {
          const clockSeconds = readClockTextAsSeconds(await clockTimeInTheMonitor.innerText());
          const stopwatchSeconds = (Date.now() - momentSpaceWasPressedInMilliseconds) / 1_000;
          return {
            isWithinTheStopwatch:
              clockSeconds <= stopwatchSeconds + clockMarginAboveTheStopwatchInSeconds,
            clockSeconds,
            stopwatchSeconds,
          };
        },
        {
          message:
            'a clock saved running must count from the take (no more than the time since Space), not from the save (six seconds more)',
        },
      )
      .toMatchObject({ isWithinTheStopwatch: true });
    // The cursor moved on, because the item taken was the one at the cursor.
    await expect(finishRow, 'after the take the cursor must be on the second item').toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      startRow,
      'the item that was just taken must no longer be marked as the next one',
    ).not.toHaveAttribute('aria-current', 'true');

    // Act: press the Left arrow, to line the start up again. The focus is still on
    // "Limpar tudo"; the arrows work from there too.
    await page.keyboard.press('ArrowLeft');

    // Assert: the cursor is back on the first item, and what is on air did not change.
    await expect(
      startRow,
      'the Left arrow must move the cursor one item back, to the first item',
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      finishRow,
      'after the Left arrow the second item must no longer be marked as the next one',
    ).not.toHaveAttribute('aria-current', 'true');
    await expect(clockLayerRow, 'moving the cursor must not change what is on air').toContainText(
      'Largada do enduro',
    );
    // "Prévia automática" is on, as it starts, so the item the cursor landed on is also
    // shown on the preview output: it is listed under the "Prévia" monitor.
    await expect(
      page.getByRole('list', { name: 'Em prévia' }).getByRole('listitem', { name: 'Relógio' }),
      'the Left arrow must also preview the item the cursor landed on, while "Prévia automática" is on',
    ).toContainText('Largada do enduro');

    // Act: reload the page, as an operator does when the browser misbehaves.
    await page.reload();

    // Assert: nothing was lost, because the server is the truth.
    await expect(
      rundownArea.getByRole('listitem'),
      'after a reload the rundown must still list both items in order',
    ).toHaveText([/Largada do enduro/, /Chegada do enduro/]);
    await expect(
      startRow,
      'after a reload the cursor must still be on the first item, where the Left arrow put it',
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      clockLayerRow,
      'after a reload the layer panel must still name the item that is on air',
    ).toContainText('Largada do enduro');

    // Act: press "Excluir" once on the finish item.
    await finishRow.getByRole('button', { name: 'Excluir', exact: true }).click();

    // Assert: one press only asks; both items are still in the rundown.
    await expect(
      finishRow.getByRole('button', { name: 'Confirmar: excluir' }),
      'the first press of "Excluir" must only ask for a second one',
    ).toBeVisible();
    await expect(
      rundownArea.getByRole('listitem'),
      'one press of "Excluir" must not take anything out of the rundown',
    ).toHaveCount(2);

    // Act: press it again, within its 3 seconds.
    await finishRow.getByRole('button', { name: 'Confirmar: excluir' }).click();

    // Assert: the finish item is gone and the start item is all that is left.
    await expect(
      rundownArea.getByRole('listitem'),
      'the second press of "Excluir" must take exactly that row out of the rundown',
    ).toHaveText([/Largada do enduro/]);
  });
});
