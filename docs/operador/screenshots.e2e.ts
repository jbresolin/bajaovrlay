/**
 * The operator guide's pictures, retaken from the real console (docs/operador, BAJAOVRLAY-31)
 *
 * What this module is for:
 *   guia-do-operador.md shows five pictures of the console. They come from this script, never
 *   from a hand-made screenshot, so when the page changes they are retaken with one command
 *   (`pnpm --filter @bajaovrlay/control operator-guide`, after `pnpm build`). It starts a
 *   server of its own with the operator login on and the simulator running its enduro and its
 *   Super Prime, logs in as Produtor, prepares a small show through the page, and writes
 *   each picture to imagens/, cropped to the part of the console the guide explains there.
 *
 * What these tests prove:
 *   - The script runs from a new database to the last picture: the login, the items made in
 *     the item editor, the Super Prime with a decided match, a waiting penalty and a Super
 *     Chat waiting for approval are all reachable as the guide says.
 *   - Every picture the guide names is written, and there are at most six of them.
 *
 * What these tests deliberately do not cover:
 *   - Whether a picture looks right: a person looks at them in the pull request.
 *   - The OBS tally reads "não configurado": no OBS runs here, and the guide says so.
 *   - That the guide fits two pages: guidePrintsOnTwoPages.e2e.ts, which runs after this
 *     one in the operator guide's Playwright config.
 */
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  type OwnServer,
  startOwnServer,
  stopOwnServer,
} from '../../apps/control/e2e/ownServerOfABrowserTest';
import {
  chooseGraphicInTheItemEditor,
  createRaceClockItemInTheEditor,
} from '../../apps/control/e2e/previewTestSteps';
import { portOffsetOfTheBrowserTests } from '../../scripts/e2ePortOffset';
import { picturesOfTheGuide } from './picturesOfTheGuide';
import { sendCommandFromThePage } from './sendCommandFromThePage';

const repoRootFolder = fileURLToPath(new URL('../../', import.meta.url));
const picturesFolder = fileURLToPath(new URL('./imagens/', import.meta.url));

// A port of its own, away from every other browser test's (5176–5233), moved with them.
const guideServerPort = 5241 + portOffsetOfTheBrowserTests;
const guideServerAddress = `http://127.0.0.1:${String(guideServerPort)}`;
// Read from the repository root, and gitignored; emptied before every run.
const guideServerDataFolder = 'apps/control/e2e-data-guide';

// Made-up PINs of this script's server, never a show's.
const producerPinOfTheGuide = '246802';
const dataRolePinOfTheGuide = '135791';

// The seeded simulator: at 20× a Super Prime heat ends every 3 s and a simulated Super Chat
// comes about every 15 s, so every picture's moment comes within a few seconds.
const seededSimulatorId = 'simulador-enduro';
const simulatorSpeedForThePictures = 20;

// A heat, a poll and the page's next frame; generous for a slow machine.
const waitForTheRaceInMilliseconds = 30_000;

/** Logs in on the login page as Produtor at "Mesa 1" and waits until the console is connected. */
async function logInAsTheProducer(page: Page): Promise<void> {
  await page.goto(`${guideServerAddress}/`);
  await page.getByRole('radio', { name: 'Produtor' }).check();
  await page.getByLabel('PIN').fill(producerPinOfTheGuide);
  await page.getByLabel('Estação').fill('Mesa 1');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the console must be connected once logged in',
  ).toHaveText('Conectado');
}

/** Turns the seeded simulator on at the pictures' speed, Super Chats on, from the green flag. */
async function startTheSimulatorForThePictures(page: Page): Promise<void> {
  await sendCommandFromThePage(page, {
    type: 'updateDataSource',
    sourceId: seededSimulatorId,
    pollIntervalMs: 500,
    config: { speed: simulatorSpeedForThePictures, areSuperChatsSimulated: true },
  });
  await sendCommandFromThePage(page, {
    type: 'setDataSourceEnabled',
    sourceId: seededSimulatorId,
    isEnabled: true,
  });
  await sendCommandFromThePage(page, { type: 'restartSimulatedRace', sourceId: seededSimulatorId });
}

/**
 * Prepares one item in the rundown through the item editor: "+ Item", the graphic, the
 * label, any more fields the caller fills, "Salvar item"; waits until the editor closes.
 */
async function createRundownItemInTheEditor(
  page: Page,
  item: {
    graphicName: string;
    label: string;
    fillMoreFields?: (itemEditor: Locator) => Promise<void>;
  },
): Promise<void> {
  await page.getByRole('button', { name: '+ Item' }).click();
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await chooseGraphicInTheItemEditor(page, itemEditor, item.graphicName);
  await itemEditor.getByRole('textbox', { name: 'Rótulo', exact: true }).fill(item.label);
  if (item.fillMoreFields !== undefined) {
    await item.fillMoreFields(itemEditor);
  }
  await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
  await expect(itemEditor, `the editor must close once "${item.label}" is saved`).toBeHidden();
}

/** Finds one row of the rundown by its item's label. */
function findRundownRow(page: Page, itemLabel: string): Locator {
  return page.getByRole('region', { name: 'Rundown' }).getByRole('listitem', { name: itemLabel });
}

/** Writes a picture of this part of the page to imagens/<fileName>. */
async function takePictureOf(part: Locator, fileName: string): Promise<void> {
  await part.screenshot({ path: join(picturesFolder, fileName), animations: 'disabled' });
}

/**
 * Writes the "Prévia" picture: from the monitor's title down to the lines under it with
 * "Tomar" and "Descartar". The two are not one element on the page, so the picture is the
 * rectangle that holds both, as wide as the centre column.
 */
async function takePictureOfThePreviewWithItsLines(page: Page): Promise<void> {
  const centreArea = page.getByRole('region', { name: 'Programa e edição rápida' });
  const centreBox = await centreArea.boundingBox();
  const previewLinesBox = await page.getByRole('list', { name: 'Em prévia' }).boundingBox();
  if (centreBox === null || previewLinesBox === null) {
    throw new Error('the centre column and the preview lines must be on screen');
  }
  const bottomOfThePreviewLines = previewLinesBox.y + previewLinesBox.height;
  await page.screenshot({
    path: join(picturesFolder, picturesOfTheGuide.preview),
    animations: 'disabled',
    clip: {
      x: centreBox.x,
      y: centreBox.y,
      width: centreBox.width,
      height: bottomOfThePreviewLines - centreBox.y,
    },
  });
}

test('retakes every picture of the operator guide from a show on the simulator', async ({
  page,
  context,
}) => {
  let guideServer: OwnServer | undefined;
  try {
    // Arrange: a new server with the login on, logged in as Produtor; the program output
    // open as OBS has it (it reports what it drew, so Camadas says "No ar"); the simulator
    // running; three items in the rundown (a race clock, a tower, a lower third).
    rmSync(join(repoRootFolder, guideServerDataFolder), { recursive: true, force: true });
    mkdirSync(picturesFolder, { recursive: true });
    guideServer = await startOwnServer({
      port: guideServerPort,
      databasePath: `${guideServerDataFolder}/guia.sqlite`,
      dataFolder: guideServerDataFolder,
      moreVariables: {
        BAJAOVRLAY_NTP_SERVERS: 'off',
        BAJAOVRLAY_PIN_PRODUCER: producerPinOfTheGuide,
        BAJAOVRLAY_PIN_DATA: dataRolePinOfTheGuide,
      },
    });
    await logInAsTheProducer(page);
    const programOutputPage = await context.newPage();
    await programOutputPage.goto(`${guideServerAddress}/render/`);
    await page.bringToFront();
    await startTheSimulatorForThePictures(page);
    await createRaceClockItemInTheEditor(page, 'Relógio — Enduro', 'Enduro');
    await createRundownItemInTheEditor(page, {
      graphicName: 'Torre de posições',
      label: 'Torre — Enduro',
    });
    await createRundownItemInTheEditor(page, {
      graphicName: 'Tarja',
      label: 'Tarja — Ana Souza',
      fillMoreFields: async (itemEditor) => {
        await itemEditor.getByLabel('Nome', { exact: true }).fill('Ana Souza');
        await itemEditor.getByLabel('Função', { exact: true }).fill('Locutora');
      },
    });

    // Act: take each picture at its moment.
    await test.step('partidas: a Super Prime match decided, the next one proposed', async () => {
      const matchPanel = page.getByRole('region', { name: 'Partidas da chave' });
      await matchPanel.getByRole('button', { name: 'Usar sugestão' }).click();
      await expect(
        matchPanel.getByText(/^Partida encerrada: /),
        'the first match "agora" must have its winner',
      ).toBeVisible({ timeout: waitForTheRaceInMilliseconds });
      await takePictureOf(matchPanel, picturesOfTheGuide.matches);
    });

    await test.step('console and prévia: clock and tower on air, the lower third in preview', async () => {
      await findRundownRow(page, 'Relógio — Enduro')
        .getByRole('button', { name: 'Disparar' })
        .click();
      await page.getByRole('button', { name: 'Marcar como próximo: Torre — Enduro' }).click();
      await page.keyboard.press('Space');
      const layers = page.getByRole('region', { name: 'Camadas' });
      await expect(
        layers.getByRole('listitem', { name: 'Relógio' }),
        'the clock must be on air',
      ).toContainText('No ar');
      await expect(
        layers.getByRole('listitem', { name: 'Torre' }),
        'the tower must be on air',
      ).toContainText('No ar');
      // "Prévia automática" is on: marking the lower third also previews it.
      await page.getByRole('button', { name: 'Marcar como próximo: Tarja — Ana Souza' }).click();
      const previewLines = page.getByRole('list', { name: 'Em prévia' });
      await expect(previewLines, 'the lower third must be in preview').toContainText('Tarja');
      await takePictureOf(page.locator('main'), picturesOfTheGuide.console);
      await takePictureOfThePreviewWithItsLines(page);
    });

    await test.step('eventos: a penalty waiting and a Super Chat waiting for approval', async () => {
      await sendCommandFromThePage(page, {
        type: 'createManualEvent',
        noticeKind: 'penalty',
        carNumber: 42,
        reason: 'Corte de pista',
        penaltyText: '+30 segundos',
      });
      const quickFireArea = page.getByRole('region', { name: 'Atalhos e macros' });
      await quickFireArea.getByRole('tab', { name: /^Eventos/ }).click();
      const superChatsHint = quickFireArea.getByRole('button', { name: /aguardando aprovação$/ });
      await expect(superChatsHint, 'a simulated Super Chat must wait for approval').toBeVisible({
        timeout: waitForTheRaceInMilliseconds,
      });
      await superChatsHint.click();
      await takePictureOf(quickFireArea, picturesOfTheGuide.events);
    });

    await test.step('cabeçalho: the status side of the header', async () => {
      await expect(page.getByText('Fontes: 1 ok'), 'the simulator must be healthy').toBeVisible();
      await takePictureOf(page.locator('header > div').nth(1), picturesOfTheGuide.header);
    });

    // Assert: every picture the guide names was written, and they are at most six.
    const pictureFileNames = Object.values(picturesOfTheGuide);
    expect(pictureFileNames.length, 'the brief allows at most six pictures').toBeLessThanOrEqual(6);
    for (const fileName of pictureFileNames) {
      const pictureSize = statSync(join(picturesFolder, fileName)).size;
      expect(pictureSize, `imagens/${fileName} must have been written`).toBeGreaterThan(0);
    }
  } finally {
    if (guideServer !== undefined) {
      await stopOwnServer(guideServer);
    }
  }
});
