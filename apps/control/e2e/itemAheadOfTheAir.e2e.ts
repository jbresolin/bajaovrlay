/**
 * "item mudou" and "Atualizar no ar" in Camadas, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   A lower third is on air when the producer spots a typo in the name. The operator fixes
 *   it in the item editor with "Salvar item" alone: the item is right, but the air still
 *   shows the old name. Camadas marks the row "item mudou" (BAJAOVRLAY-38), and its
 *   "Atualizar no ar" sends the item's new name to the lower third on air, which changes
 *   in place. This test walks that path in a real Chromium against the real server, the
 *   real renderer page and a real SQLite file; a second page at `/render/` stands in for
 *   OBS, the truth about what the viewers see.
 *
 * What these tests prove:
 *   - A lower third made and taken from the item editor shows its name on program.
 *   - Saving a new name into the item leaves the air alone and puts "item mudou" on the
 *     "Tarja" row of Camadas.
 *   - "Atualizar no ar" on that row puts the new name on the program output, on the very
 *     same element (changed in place, no blink), and the chip goes away.
 *
 * What these tests deliberately do not cover:
 *   - Which fields count as behind, the clock question and "Disparar": the shared table
 *     test and LayerStatusPanelItemAheadOfTheAir.test.tsx.
 *   - OBS itself: its stand-in is the same `/render/` page in Chromium.
 *
 * What it needs: the lower third and the renderer built (`pnpm build`), because the
 * server only registers built graphics and the program output is the built renderer.
 *
 * Sharing the server with the other tests: the server is emptied before each test, so this
 * one passes whatever ran before it and leaves its item and lower third behind without harm.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import { findItemEditorOwnTextField } from './itemEditorOwnFields';
import {
  chooseGraphicInTheItemEditor,
  openControlPageAndWaitUntilConnected,
  openOutputInItsOwnPage,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';

// The lower third, as the "Gráfico" dropdown of the item editor names it.
const lowerThirdGraphicName = 'Tarja';
const itemLabel = 'Tarja — Ana Souza';

/** Finds the lower third element on the "Tarja" layer of the program output. */
function findLowerThirdInProgramOutput(programOutputPage: Page): Locator {
  return programOutputPage.locator('[data-layer-id="lower-third"] > baja-graphic-lower-third');
}

/** Finds the item editor; its fields are looked up inside it, as "Edição rápida" has the same. */
function findItemEditor(page: Page): Locator {
  return page.getByRole('region', { name: 'Editor de item' });
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('a lower third behind its item', () => {
  test('a name saved into the item marks the row "item mudou", and "Atualizar no ar" puts it on air in place', async ({
    page,
    context,
  }) => {
    // Arrange: OBS's stand-in shows the program output; the control page is connected.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = findItemEditor(page);
    const lowerThirdRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Tarja' });
    const lowerThirdOnProgram = findLowerThirdInProgramOutput(programOutputPage);

    // Act: make the interview lower third with a typo in the name, and take it.
    await page.getByRole('button', { name: '+ Item' }).click();
    await chooseGraphicInTheItemEditor(page, itemEditor, lowerThirdGraphicName);
    await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill(itemLabel);
    await itemEditor.getByLabel('Nome', { exact: true }).fill('Ana Sousa');
    await itemEditor.getByLabel('Função', { exact: true }).fill('Capitã');
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert: the name with the typo is on air, and the row has nothing to say about it.
    await expect(
      lowerThirdOnProgram.getByTestId('lower-third-name'),
      'the program output must show the name the item was taken with',
    ).toHaveText('Ana Sousa');
    await expect(lowerThirdRow, 'the layer must be on air').toContainText('No ar');
    await expect(
      lowerThirdRow.getByText('item mudou'),
      'the air shows what the item holds',
    ).toBeHidden();

    // Act: fix the name in the item editor with "Salvar item" alone.
    await page
      .getByRole('region', { name: 'Rundown' })
      .getByRole('listitem', { name: itemLabel })
      .getByRole('button', { name: 'Editar item', exact: true })
      .click();
    await itemEditor.getByLabel('Nome', { exact: true }).fill('Ana Souza');
    await itemEditor.getByRole('button', { name: 'Salvar item' }).click();

    // Assert: the item was saved, the air kept the typo, and the row says the item moved on.
    await expect(itemEditor, 'the editor must close once the save was accepted').toBeHidden();
    await expect(
      lowerThirdRow.getByText('item mudou'),
      'the row must say its item was saved after the take',
    ).toBeVisible();
    await expect(
      lowerThirdOnProgram.getByTestId('lower-third-name'),
      '"Salvar item" alone must leave the air as it was',
    ).toHaveText('Ana Sousa');

    // Arrange (for the update): remember which element the lower third on program is.
    const lowerThirdElementBeforeTheUpdate = await lowerThirdOnProgram.elementHandle();

    // Act: "Atualizar no ar" on the row.
    await lowerThirdRow.getByRole('button', { name: 'Atualizar no ar' }).click();

    // Assert: the fixed name is on air, on the same element, and the chip is gone.
    await expect(
      lowerThirdOnProgram.getByTestId('lower-third-name'),
      'the program output must show the name the item now holds',
    ).toHaveText('Ana Souza');
    const isTheSameElementAsBeforeTheUpdate = await lowerThirdOnProgram.evaluate(
      (lowerThirdElementNow, lowerThirdElementBefore) =>
        lowerThirdElementNow === lowerThirdElementBefore,
      lowerThirdElementBeforeTheUpdate,
    );
    expect(
      isTheSameElementAsBeforeTheUpdate,
      'the lower third must be changed in place: the same element, not taken off and back',
    ).toBe(true);
    await expect(
      lowerThirdRow.getByText('item mudou'),
      'the chip must go once the air matches the item',
    ).toBeHidden();
    await expect(
      lowerThirdOnProgram.getByTestId('lower-third-role'),
      'a field that was not behind must stay as it was',
    ).toHaveText('Capitã');

    // Tidy up: close OBS's stand-in; the next test empties the server before it starts.
    await programOutputPage.close();
  });
});
