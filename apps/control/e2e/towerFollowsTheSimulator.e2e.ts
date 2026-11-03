/**
 * The positions tower bound to the simulator follows the race on air, end to end
 * (apps/control, Playwright)
 *
 * What this module is for:
 *   The first data graphic (BAJAOVRLAY-21, with the Ardósia theme of BAJAOVRLAY-22): a
 *   positions tower whose cars read the simulator's positions live goes on air with 20
 *   cars, swaps its rows as the race moves, switches to the detailed layout in place with
 *   "Atualizar no ar", and stacks under the race clock in the right-hand column. This is
 *   the brief's E2E walk, in a real Chromium against the real server, the built renderer
 *   and a real SQLite file.
 *
 * What these tests prove (the brief's five E2E steps; steps 4 and 5 in tests of their
 * own so a failure names its step, gate-2 style):
 *   1. The simulator on at speed 60, read every 0,5 s, restarted from the green flag with
 *      "Reiniciar corrida".
 *   2. On the console, "Novo gráfico…" with "Torre de posições": the editor opens with
 *      "Carros" already on "Fonte" (the simulator, "Posições › Lista completa", "Ao
 *      vivo"), the binding the manifest suggests; "Salvar e disparar" puts it on air: the
 *      program monitor (the framed /render/?monitor=1, the program stand-in) shows 20
 *      rows, and the server has the instance on the "Torre" layer with all 60 cars.
 *   3. Within a few polls at least one row changes place: once the simulator's own
 *      positions show the first 20 places in another order than the rows had at the
 *      take, the rows in the monitor leave that order; and they follow the data on air:
 *      with the simulator then turned off, the data on air stays as it was (a source
 *      turned off keeps its last good data), and the rows settle in its order.
 *   4. The item opened again ("Editar" of its button in "Atalhos"), "Leiaute" set to
 *      "Detalhada", "Atualizar no ar": the same instance (its id unchanged on the server,
 *      and the very same tower element in the monitor, carrying that id) is detailed and
 *      shows more columns (the "DIF." caption, a gap cell in every row).
 *   5. A race clock taken too: the clock card and the tower do not overlap (the card's
 *      bottom is above the tower's top) and both sit in the same column.
 *
 * Why the tower is made with "Páginas" on "Só os 20 primeiros": with "Alternar páginas"
 * (the default) the tower turns to cars 21 to 40 after each hold, and the rows of step 3
 * would be another page's rows, not the first 20 places; held on page 1 the rows are
 * always the first 20 places and the check stays one comparison.
 *
 * What these tests deliberately do not cover:
 *   - The tower's motion (FLIP slides, the ▲ and ▼ cues, page turns): the package's own
 *     Playwright tests in packages/graphics/positions-tower/e2e.
 *   - OBS itself: no page at /render/ is opened, so no layer ever says "No ar"; the
 *     program monitor draws the same built renderer and is enough to see what is on air.
 *   - Where the boxes land on the 1920x1080 stage: the monitor is scaled, so the two
 *     boxes are only compared with each other (monitorsSideBySide.e2e.ts covers the scale).
 *     The finders and the measure live in towerInProgramMonitor.ts.
 *   - The values in the detailed columns: the package's screenshot tests.
 *
 * What it needs: `pnpm build` (the server registers built graphics only, and the monitor
 * is the built renderer).
 *
 * Timeouts, all generous on purpose: the race runs at 60×, so the leaders cross the line
 * every 4 to 7 real seconds and a change among the first 20 places usually comes within
 * 15 to 30 s; the wait for it is 60 s. The whole first test gets 3 minutes.
 *
 * Why step 3 waits for the monitor's own drawing and turns the simulator off: comparing
 * the rows with the data on air while the race runs chases a moving target. At 60× the
 * order on air keeps changing and the monitor draws it a moment later, so on a busy
 * machine the two may not agree at any one look within a fixed time (it ran out of a
 * 10 s wait at 21.7 s, BAJAOVRLAY-52). The rows leaving the take order is waited for
 * inside the page, and the comparison is made against data that no longer moves; both
 * waits end when the monitor draws, ended otherwise only by the test's own timeout.
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied (nothing on air, no item, the simulator off
 *   with its default settings), so this test passes whatever ran before it.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  type PositionEntryAsTheTestsReadIt,
  readDataOnAirOfLayerFromTheRealServer,
  readInstanceOnAirOfLayerFromTheRealServer,
  readPositionsOfSourceFromTheRealServer,
} from './dataSourceStateOnTheRealServer';
import {
  carsInTheSeededRace,
  openDataSourcesPageAndWaitUntilConnected,
  seededSimulatorLabel,
  startTheSeededSimulatorFastFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import { sendCommandOrFail } from './eventInboxOnTheRealServer';
import {
  openControlPageAndWaitUntilConnected,
  openItemEditorWithNewGraphic,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';
import { findQuickFireArea } from './quickFireTestSteps';
import {
  findClockCardInProgramMonitor,
  findTowerHead,
  findTowerInProgramMonitor,
  findTowerRows,
  findTowerSection,
  measureHowTheClockAndTheTowerStack,
  readCarOrderOfTheTowerRows,
  towerLayerId,
  waitUntilTheTowerRowsLeaveTheOrder,
  waitUntilTheTowerRowsShowTheOrder,
} from './towerInProgramMonitor';

// The tower, as the "Gráfico" dropdown names it (its manifest's name).
const towerGraphicName = 'Torre de posições';
// The labels the tests give the items they make on the spot.
const towerItemLabel = 'Torre — Enduro';
const raceClockItemLabel = 'Relógio — Enduro';
// The seeded simulator's id, as every new database has it (emptyTheServerState.ts).
const seededSimulatorId = 'simulador-enduro';
// The tower shows one page of 20 rows (the theme's `--tower-rows-per-page`).
const rowsOnOnePageOfTheTower = 20;
// The take: the monitor loads the tower's package and plays it in (1 s); a few seconds
// cover a slow machine.
const waitForTheTowerOnAirInMilliseconds = 10_000;
// At 60× the leaders cross the line every 4 to 7 real seconds; a change among the first
// 20 places usually comes within 15 to 30 s. Far more than that, so a slow race on a
// busy machine still gets there.
const waitForAPositionChangeInMilliseconds = 60_000;
// The layout switch of step 4: the server answers at once and the monitor redraws the
// tower in place; a few seconds cover a slow machine.
const waitForTheLayoutSwitchInMilliseconds = 10_000;
// The clock's play-in takes 600 ms and the tower's 1 s; both must have ended before the
// boxes are compared, because the play-in moves the card.
const waitForTheStackToSettleInMilliseconds = 5_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** Picks an option in one of the item editor's dropdowns, by the dropdown's name. */
async function chooseInEditorDropdown(
  page: Page,
  itemEditor: Locator,
  dropdownName: string,
  optionName: string,
): Promise<void> {
  await itemEditor.getByRole('combobox', { name: dropdownName, exact: true }).click();
  // The list of options is drawn outside the editor, at the end of the page.
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

/** Finds the item editor; "Edição rápida" draws the same labels, so fields are looked up inside it. */
function findItemEditor(page: Page): Locator {
  return page.getByRole('region', { name: 'Editor de item' });
}

/** The car numbers of the first 20 places of a positions list, one page of the tower. */
function readCarOrderOfTheFirstPage(entries: PositionEntryAsTheTestsReadIt[]): number[] {
  return entries.slice(0, rowsOnOnePageOfTheTower).map((entry) => entry.carNumber);
}

/** Reads the cars the real server has on air on the tower layer (what the monitor draws from). */
async function readCarsOnAirOnTheTower(): Promise<PositionEntryAsTheTestsReadIt[]> {
  const dataOnAir = await readDataOnAirOfLayerFromTheRealServer(towerLayerId);
  const entries = dataOnAir?.entries;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries as PositionEntryAsTheTestsReadIt[];
}

/** Reads the id of the instance on air on the tower layer; a bug in the test if there is none. */
async function readIdOfTheTowerInstanceOnAir(): Promise<string> {
  const instanceOnAir = await readInstanceOnAirOfLayerFromTheRealServer(towerLayerId);
  if (instanceOnAir === undefined) {
    throw new Error('nothing is on air on the tower layer; the take must have happened first');
  }
  return instanceOnAir.id;
}

/**
 * Checks that the editor opened with "Carros" already reading the simulator's positions,
 * live: the manifest's suggestion, made because the simulator is the one source on with
 * positions.
 */
async function expectTheCarsToReadTheSimulatorAlready(itemEditor: Locator): Promise<void> {
  await expect(
    itemEditor.getByRole('combobox', { name: 'Como preencher Carros' }),
    'the cars must open as "Fonte", as the manifest suggests',
  ).toHaveText('Fonte');
  await expect(
    itemEditor.getByRole('combobox', { name: 'Fonte de Carros' }),
    'the one source on with positions, the simulator, must be chosen for the cars',
  ).toHaveText(seededSimulatorLabel);
  await expect(
    itemEditor.getByRole('combobox', { name: 'O que Carros lê da fonte' }),
    'the whole positions list must be chosen for the cars',
  ).toHaveText('Posições › Lista completa');
  await expect(
    itemEditor.getByRole('combobox', { name: 'Quando Carros lê a fonte' }),
    'the cars must read the source live, as the manifest suggests',
  ).toHaveText('Ao vivo');
}

/**
 * Steps 1 and 2: the simulator on at speed 60, read every 0,5 s, restarted from the green
 * flag; on the console, "Novo gráfico…" with the tower, its cars already bound to the
 * simulator, held on its first page, saved and taken; and the tower on air with 20 rows
 * in the program monitor and the 60 cars on the server.
 */
async function putTheBoundTowerOnAir(page: Page): Promise<void> {
  await openDataSourcesPageAndWaitUntilConnected(page);
  await startTheSeededSimulatorFastFromTheGreenFlag(page);
  await openControlPageAndWaitUntilConnected(page);
  const itemEditor = await openItemEditorWithNewGraphic(page, towerItemLabel, towerGraphicName);
  await expectTheCarsToReadTheSimulatorAlready(itemEditor);
  await chooseInEditorDropdown(page, itemEditor, 'Páginas', 'Só os 20 primeiros');
  await saveAndTakeTheItemInTheEditor(itemEditor);
  await expect(
    findTowerRows(page),
    'the program monitor must show one page of 20 rows after the take',
  ).toHaveCount(rowsOnOnePageOfTheTower, { timeout: waitForTheTowerOnAirInMilliseconds });
  await expect
    .poll(async () => (await readCarsOnAirOnTheTower()).length, {
      message: 'the server must have the tower on air with all 60 cars of the simulator',
      timeout: waitForTheTowerOnAirInMilliseconds,
    })
    .toBe(carsInTheSeededRace);
}

test.describe('a positions tower bound to the simulator', () => {
  test('goes on air with 20 of the simulator cars, already bound, and swaps rows as the race moves', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Arrange (steps 1 and 2): the bound tower on air, 20 rows in the monitor, and the
    // order of its rows right after the take.
    await putTheBoundTowerOnAir(page);
    const carOrderAtTheTake = await readCarOrderOfTheTowerRows(page);

    // Act (step 3): let the race run until the simulator's own positions show the first
    // 20 places in another order than the rows had at the take.
    await expect
      .poll(
        async () => {
          const positionsNow = await readPositionsOfSourceFromTheRealServer(seededSimulatorLabel);
          return readCarOrderOfTheFirstPage(positionsNow);
        },
        {
          message: 'the simulator must change the order of its first 20 places within a minute',
          timeout: waitForAPositionChangeInMilliseconds,
          intervals: [500],
        },
      )
      .not.toEqual(carOrderAtTheTake);

    // Assert (step 3): the rows in the monitor leave the order they had at the take, by
    // themselves (the wait ends the frame the monitor draws another order).
    await waitUntilTheTowerRowsLeaveTheOrder(page, carOrderAtTheTake);

    // Act (step 3): turn the simulator off, as its switch on "Fontes de dados" does, so
    // the data on air stops moving; then read the order it was left in.
    await sendCommandOrFail(realServerPort, {
      type: 'setDataSourceEnabled',
      sourceId: seededSimulatorId,
      isEnabled: false,
    });
    const orderOnAirOnceStill = readCarOrderOfTheFirstPage(await readCarsOnAirOnTheTower());

    // Assert (step 3): the rows settle in the order of the data on air (what the server
    // has given the renderer), and the page still holds 20 rows.
    expect(
      orderOnAirOnceStill,
      'the data on air must keep its 20 first places once the simulator is off',
    ).toHaveLength(rowsOnOnePageOfTheTower);
    await waitUntilTheTowerRowsShowTheOrder(page, orderOnAirOnceStill);
    await expect(
      findTowerRows(page),
      'after the change the monitor must still show one page of 20 rows',
    ).toHaveCount(rowsOnOnePageOfTheTower);
  });

  test('switches to the detailed layout in place with "Atualizar no ar": same instance, more columns', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Arrange (steps 1 and 2): the bound tower on air, compact (the manifest's default),
    // which instance it is on the server, and a handle to the tower element the monitor
    // drew for it (the renderer writes the instance id on that element).
    await putTheBoundTowerOnAir(page);
    const towerInstanceIdAtTheTake = await readIdOfTheTowerInstanceOnAir();
    const towerElementAtTheTake = await findTowerInProgramMonitor(page).evaluateHandle(
      (tower) => tower,
    );
    await expect(
      findTowerSection(page),
      'the tower must go on air compact, the layout the manifest defaults to',
    ).toHaveAttribute('data-layout', 'compact');
    await expect(
      findTowerHead(page),
      'the compact head must carry no "DIF." caption',
    ).not.toContainText('DIF.');

    // Act (step 4): open the item ("Editar" of its button in "Atalhos", where "Novo
    // gráfico…" homes an item made on the spot), set "Leiaute" to "Detalhada" and press
    // "Atualizar no ar".
    await findQuickFireArea(page)
      .getByRole('button', { name: `Mais ações: ${towerItemLabel}` })
      .click();
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
    const itemEditor = findItemEditor(page);
    await expect(
      itemEditor.getByRole('combobox', { name: 'Leiaute', exact: true }),
      'the editor must open showing the layout the item stores',
    ).toHaveText('Compacta');
    await chooseInEditorDropdown(page, itemEditor, 'Leiaute', 'Detalhada');
    await itemEditor.getByRole('button', { name: 'Atualizar no ar' }).click();
    await expect(
      itemEditor,
      'the editor must close once the save and the on-air update were both accepted',
    ).toBeHidden();

    // Assert (step 4): the very same instance is now detailed on the server (changed in
    // place, not taken again), the monitor still draws it on the same element with the
    // same instance id (not a new element loaded for a new take), and the detailed
    // tower shows more columns: the "DIF." caption in the head and a gap cell in every row.
    await expect
      .poll(
        async () => {
          const instanceOnAir = await readInstanceOnAirOfLayerFromTheRealServer(towerLayerId);
          return { id: instanceOnAir?.id, layout: instanceOnAir?.resolvedData.layout };
        },
        {
          message: 'the instance on air must keep its id and turn detailed',
          timeout: waitForTheLayoutSwitchInMilliseconds,
        },
      )
      .toEqual({ id: towerInstanceIdAtTheTake, layout: 'detailed' });
    await expect(
      findTowerSection(page),
      'the tower in the monitor must be drawn in the detailed layout',
    ).toHaveAttribute('data-layout', 'detailed', { timeout: waitForTheLayoutSwitchInMilliseconds });
    await expect(
      findTowerInProgramMonitor(page),
      'the tower element in the monitor must still carry the instance id of the take',
    ).toHaveAttribute('data-instance-id', towerInstanceIdAtTheTake);
    const isTheSameTowerElement = await findTowerInProgramMonitor(page).evaluate(
      (tower, towerBefore) => tower === towerBefore,
      towerElementAtTheTake,
    );
    expect(
      isTheSameTowerElement,
      'the update must change the tower in place: the same DOM element as at the take',
    ).toBe(true);
    await expect(
      findTowerHead(page),
      'the detailed head must carry the "DIF." caption',
    ).toContainText('DIF.');
    await expect(
      findTowerRows(page).first().getByTestId('row-gap'),
      'every detailed row must have a gap cell',
    ).toBeAttached();
    await expect(
      findTowerRows(page),
      'the layout switch must keep the 20 rows on the page',
    ).toHaveCount(rowsOnOnePageOfTheTower);
  });

  test('stacks under the race clock without overlapping when the clock is taken too', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Arrange (steps 1 and 2): the bound tower on air.
    await putTheBoundTowerOnAir(page);

    // Act (step 5): a race clock made on the spot with its defaults, saved and taken.
    const itemEditor = await openItemEditorWithNewGraphic(page, raceClockItemLabel);
    await itemEditor.getByLabel('Título', { exact: true }).fill('Enduro de Resistência');
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 5): both are in the monitor, and once their play-ins have ended the
    // clock card sits above the tower, in the same column, without overlapping it.
    await expect(
      findClockCardInProgramMonitor(page),
      'the program monitor must draw the clock card beside the tower',
    ).toBeAttached({ timeout: waitForTheTowerOnAirInMilliseconds });
    await expect(
      findTowerRows(page),
      'taking the clock must leave the tower on air with its 20 rows',
    ).toHaveCount(rowsOnOnePageOfTheTower);
    await expect
      .poll(() => measureHowTheClockAndTheTowerStack(page), {
        message: 'the clock card must sit above the tower, in the same column, not over it',
        timeout: waitForTheStackToSettleInMilliseconds,
        intervals: [250],
      })
      .toMatchObject({ isTheClockAboveTheTower: true, isInTheSameColumn: true });
  });
});
