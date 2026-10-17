/**
 * Prévia shows the result, "Tomar tudo" takes it, and a macro's "Prévia" (apps/control, Playwright)
 *
 * What this module is for:
 *   João's rule for Prévia: it shows exactly what the screen will look like when we take.
 *   So the preview output draws, per layer, the preview on that layer if there is one,
 *   nothing if the layer is marked "vai limpar", and otherwise what is on air there.
 *   "Tomar tudo" then takes every preview and every mark in one change on the server, and
 *   a macro's "Prévia" puts the macro's end state in preview. This file walks that in a
 *   real Chromium against the real server, watching both stand-in pages: `/render/` (the
 *   program output, as OBS loads it) and `/render/?target=preview`.
 *
 * What these tests prove:
 *   - With a clock on air on "Relógio" and a second item previewed on "Tarja", Prévia
 *     draws both and program only the clock.
 *   - A second clock previewed on "Relógio" replaces the one on air there in Prévia only:
 *     Prévia draws the new clock (by its Título) and not the one on air.
 *   - "Tomar tudo" makes program draw, layer by layer, exactly what Prévia drew.
 *   - A macro "take the sponsor item, wait 5 s, clear Relógio" previewed with its "⋯"
 *     menu's "Prévia" shows its end state (Relógio empty, the sponsor on "Tarja") while
 *     program is untouched; "Tomar tudo" then lands that end state on program in one cut,
 *     sooner than the macro's 5 s wait.
 *
 * What these tests deliberately do not cover:
 *   - A real lower third: every item uses the race clock, the only graphic these tests can
 *     count on being built; the "sponsor" item is a race clock prepared on the "Tarja"
 *     layer through the item editor's "Camada" dropdown, as autoPreviewAcrossLayers.e2e.ts
 *     does, and the layers are told apart by the Título each clock shows.
 *   - The selection rule row by row: apps/renderer's previewComposition.test.ts; what the
 *     server does with takeAllPreviews and previewMacro: apps/server's tests.
 *   - "Prévia automática": it is switched off at the start of each test so that every
 *     preview here is one the test asked for.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, so these tests pass whatever ran before them.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import {
  createRaceClockItemInTheEditor,
  findCentreArea,
  findRaceClockInOutputPage,
  findRaceClockOnLowerThirdLayerOfOutputPage,
  openControlPageAndWaitUntilConnected,
  openOutputInItsOwnPage,
} from './previewTestSteps';
import { findQuickFireArea } from './quickFireTestSteps';

// The macro's wait. "Tomar tudo" must land the end state well before it would have passed.
const waitOfTheMacroInMilliseconds = 5000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** Switches "Prévia automática" off, so that only the previews a test asks for appear. */
async function switchAutomaticPreviewOff(page: Page): Promise<void> {
  const autoPreviewSwitch = page.getByRole('switch', { name: 'Prévia automática' });
  await autoPreviewSwitch.click();
  await expect(autoPreviewSwitch, 'the switch must be off for this test').toHaveAttribute(
    'aria-checked',
    'false',
  );
}

/** Finds a rundown row by its item's label. */
function findRundownRow(page: Page, itemLabel: string): Locator {
  return page.getByRole('region', { name: 'Rundown' }).getByRole('listitem', { name: itemLabel });
}

/** The Título each layer of an output draws, or null where the layer draws no clock. */
async function readTitlesDrawnPerLayer(outputPage: Page) {
  const clockLayer = findRaceClockInOutputPage(outputPage);
  const lowerThirdLayer = findRaceClockOnLowerThirdLayerOfOutputPage(outputPage);
  const clockLayerTitle =
    (await clockLayer.count()) === 0
      ? null
      : await clockLayer.getByTestId('race-clock-session-name').textContent();
  const lowerThirdLayerTitle =
    (await lowerThirdLayer.count()) === 0
      ? null
      : await lowerThirdLayer.getByTestId('race-clock-session-name').textContent();
  return { clockLayerTitle, lowerThirdLayerTitle };
}

test.describe('Prévia shows the screen as it will be after the take', () => {
  test('keeps what stays on air, replaces what a preview replaces, and "Tomar tudo" makes program the same', async ({
    page,
    context,
  }) => {
    // Arrange: both outputs watched; three items prepared: the endurance clock and the
    // qualifying clock on "Relógio", the sponsor clock on "Tarja"; the endurance clock on air.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    const previewOutputPage = await openOutputInItsOwnPage(context, '/render/?target=preview');
    await openControlPageAndWaitUntilConnected(page);
    await switchAutomaticPreviewOff(page);
    await createRaceClockItemInTheEditor(page, 'Relógio do enduro', 'Enduro de Resistência');
    await createRaceClockItemInTheEditor(page, 'Relógio da classificação', 'Classificação');
    await createRaceClockItemInTheEditor(
      page,
      'Relógio do patrocinador',
      'Patrocínio — Oficina do Zé',
      'Tarja',
    );
    await findRundownRow(page, 'Relógio do enduro')
      .getByRole('button', { name: 'Disparar' })
      .click();
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      'the endurance clock must be on air before anything is previewed',
    ).toHaveText('Enduro de Resistência');

    // Act: preview the sponsor clock on the "Tarja" layer.
    await findRundownRow(page, 'Relógio do patrocinador')
      .getByRole('button', { name: 'Prévia', exact: true })
      .click();

    // Assert: Prévia draws the clock that stays on air AND the sponsor; program only the clock.
    await expect(
      findRaceClockOnLowerThirdLayerOfOutputPage(previewOutputPage).getByTestId(
        'race-clock-session-name',
      ),
      'Prévia must draw the item previewed on "Tarja"',
    ).toHaveText('Patrocínio — Oficina do Zé');
    await expect(
      findRaceClockInOutputPage(previewOutputPage).getByTestId('race-clock-session-name'),
      'Prévia must also draw the clock that stays on air on "Relógio"',
    ).toHaveText('Enduro de Resistência');
    await expect(
      findRaceClockOnLowerThirdLayerOfOutputPage(programOutputPage),
      'a preview must never reach the program output',
    ).toHaveCount(0);

    // Act: preview the qualifying clock on "Relógio", where the endurance clock is on air.
    await findRundownRow(page, 'Relógio da classificação')
      .getByRole('button', { name: 'Prévia', exact: true })
      .click();

    // Assert: on "Relógio" Prévia draws only the new clock; program still the old one.
    await expect(
      findRaceClockInOutputPage(previewOutputPage).getByTestId('race-clock-session-name'),
      'a previewed layer must show its preview, not what is on air there',
    ).toHaveText('Classificação');
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'a previewed layer must draw one clock only',
    ).toHaveCount(1);
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      'program must still show the endurance clock',
    ).toHaveText('Enduro de Resistência');
    const titlesPreviewShowedBeforeTheTake = await readTitlesDrawnPerLayer(previewOutputPage);

    // Act: press "Tomar tudo".
    await findCentreArea(page).getByRole('button', { name: 'Tomar tudo' }).click();

    // Assert: program draws, layer by layer, what Prévia drew.
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      'after "Tomar tudo" program must show the qualifying clock on "Relógio"',
    ).toHaveText('Classificação');
    await expect(
      findRaceClockOnLowerThirdLayerOfOutputPage(programOutputPage).getByTestId(
        'race-clock-session-name',
      ),
      'after "Tomar tudo" program must show the sponsor clock on "Tarja"',
    ).toHaveText('Patrocínio — Oficina do Zé');
    expect(
      await readTitlesDrawnPerLayer(programOutputPage),
      'program must now be exactly what Prévia showed before the take',
    ).toEqual(titlesPreviewShowedBeforeTheTake);
    expect(
      titlesPreviewShowedBeforeTheTake,
      'Prévia showed the qualifying clock and the sponsor',
    ).toEqual({
      clockLayerTitle: 'Classificação',
      lowerThirdLayerTitle: 'Patrocínio — Oficina do Zé',
    });

    // Tidy up: close the two stand-in pages; the next test empties the server.
    await programOutputPage.close();
    await previewOutputPage.close();
  });

  test('a macro previewed then taken with "Tomar tudo" lands its end state in one cut', async ({
    page,
    context,
  }) => {
    // Arrange: the endurance clock on air on "Relógio", the sponsor clock prepared on
    // "Tarja", and the macro "Troca para patrocínio": take the sponsor, wait 5 s, clear
    // "Relógio". Its end state: the sponsor on "Tarja" and nothing on "Relógio".
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    const previewOutputPage = await openOutputInItsOwnPage(context, '/render/?target=preview');
    await openControlPageAndWaitUntilConnected(page);
    await switchAutomaticPreviewOff(page);
    await createRaceClockItemInTheEditor(page, 'Relógio do enduro', 'Enduro de Resistência');
    await createRaceClockItemInTheEditor(
      page,
      'Relógio do patrocinador',
      'Patrocínio — Oficina do Zé',
      'Tarja',
    );
    await findRundownRow(page, 'Relógio do enduro')
      .getByRole('button', { name: 'Disparar' })
      .click();
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      'the endurance clock must be on air before the macro',
    ).toHaveText('Enduro de Resistência');
    await createSponsorSwapMacro(page);

    // Act: "Prévia" in the macro's "⋯" menu.
    const quickFireArea = findQuickFireArea(page);
    await quickFireArea
      .getByRole('button', { name: 'Mais ações da macro: Troca para patrocínio' })
      .click();
    await page.getByRole('menuitem', { name: 'Prévia' }).click();

    // Assert: Prévia shows the end state; program is untouched.
    await expect(
      findRaceClockOnLowerThirdLayerOfOutputPage(previewOutputPage).getByTestId(
        'race-clock-session-name',
      ),
      'Prévia must show the sponsor the macro takes',
    ).toHaveText('Patrocínio — Oficina do Zé');
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'Prévia must show "Relógio" empty, as the macro clears it',
    ).toHaveCount(0);
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      'a macro preview must leave program as it was',
    ).toHaveText('Enduro de Resistência');
    await expect(
      findRaceClockOnLowerThirdLayerOfOutputPage(programOutputPage),
      'a macro preview must put nothing on program',
    ).toHaveCount(0);

    // Act: press "Tomar tudo", timing how long program takes to show the end state.
    const momentOfThePress = performance.now();
    await findCentreArea(page).getByRole('button', { name: 'Tomar tudo' }).click();
    await expect(
      findRaceClockOnLowerThirdLayerOfOutputPage(programOutputPage).getByTestId(
        'race-clock-session-name',
      ),
      'after "Tomar tudo" program must show the sponsor on "Tarja"',
    ).toHaveText('Patrocínio — Oficina do Zé');
    await expect(
      findRaceClockInOutputPage(programOutputPage),
      'after "Tomar tudo" program must show "Relógio" empty',
    ).toHaveCount(0);
    const millisecondsUntilTheEndState = performance.now() - momentOfThePress;

    // Assert: the end state arrived without the macro's wait, and the macro never ran.
    expect(
      millisecondsUntilTheEndState,
      '"Tomar tudo" must apply the end state at once, not after the macro\'s 5 s wait',
    ).toBeLessThan(waitOfTheMacroInMilliseconds);
    await expect(
      quickFireArea.getByText(/Rodando/),
      'previewing and taking a macro must not run it',
    ).toHaveCount(0);

    // Tidy up: close the two stand-in pages; the next test empties the server.
    await programOutputPage.close();
    await previewOutputPage.close();
  });
});

/** Opens a dropdown of the macro editor by its name and picks one option. */
async function chooseInMacroEditor(page: Page, dropdownName: string, optionName: string) {
  const macroEditor = page.getByRole('region', { name: 'Editor de macro' });
  await macroEditor.getByRole('combobox', { name: dropdownName }).click();
  // The list of options is drawn outside the editor, at the end of the page.
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

/**
 * Writes and saves the macro "Troca para patrocínio": take the rundown item "Relógio do
 * patrocinador", wait 5 s, clear "Relógio". Waits for the editor to close.
 */
async function createSponsorSwapMacro(page: Page): Promise<void> {
  const quickFireArea = findQuickFireArea(page);
  await quickFireArea.getByRole('tab', { name: 'Macros' }).click();
  await quickFireArea.getByRole('button', { name: '+ Macro' }).click();
  const macroEditor = page.getByRole('region', { name: 'Editor de macro' });
  await macroEditor.getByLabel('Rótulo da macro').fill('Troca para patrocínio');
  await macroEditor.getByRole('button', { name: '+ Passo' }).click();
  await chooseInMacroEditor(page, 'Item do passo 1', 'Relógio do patrocinador (Sessão principal)');
  await macroEditor.getByRole('button', { name: '+ Passo' }).click();
  await chooseInMacroEditor(page, 'Tipo do passo 2', 'Esperar');
  await macroEditor.getByLabel('Espera do passo 2 (segundos)').fill('5');
  await macroEditor.getByRole('button', { name: '+ Passo' }).click();
  await chooseInMacroEditor(page, 'Tipo do passo 3', 'Limpar camada');
  await chooseInMacroEditor(page, 'Camada do passo 3', 'Relógio');
  await macroEditor.getByRole('button', { name: 'Salvar macro' }).click();
  await expect(macroEditor, 'the editor must close once the server has the macro').toBeHidden();
}
