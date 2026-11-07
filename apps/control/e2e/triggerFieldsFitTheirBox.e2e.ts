/**
 * The take step's "Dado do gatilho" and the item editor's fields fit their column
 * (apps/control, Playwright; João's check of PR #43)
 *
 * What this module is for:
 *   The macro editor opens in the console's right column, 22rem wide whatever the screen,
 *   and the item editor in the left one, 20rem wide. At João's check the take step's
 *   "Dado do gatilho › <chave>" ran past the step's box: the key could be typed but not
 *   seen. jsdom draws no layout, so a real Chromium measures the boxes here.
 *
 * What these tests prove, on the smallest screen the operator uses (a 1024×768 tablet):
 *   - With "Nome" of a lower third read from a long trigger key, nothing drawn in the
 *     macro step's row (title, source dropdown, "Dado do gatilho ›", the key's box) reaches
 *     past the row's edges.
 *   - In the item editor, with a long name typed, nothing drawn reaches past the editor's
 *     edges, whichever way "Nome" is filled (each kind its dropdown offers).
 *
 * What these tests deliberately do not cover:
 *   - That a cut key or title is readable whole in its tooltip;
 *     TakeStepTriggerFields.test.tsx.
 *   - Saving the step, and what a trigger does with it; MacroEditorPanelTriggerData.test.tsx
 *     and httpTriggerFillsTheLowerThird.e2e.ts.
 *
 * What it needs: the lower third built (`pnpm build`; the server lists built graphics only).
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import { sendCommandOrFail } from './eventInboxOnTheRealServer';
import {
  chooseGraphicInTheItemEditor,
  openControlPageAndWaitUntilConnected,
} from './previewTestSteps';
import { findQuickFireArea } from './quickFireTestSteps';

// The smallest screen the operator uses: a tablet in landscape. The two editors' columns
// have a fixed width, so a wider screen would give them no more room.
test.use({ viewport: { width: 1024, height: 768 } });

// A key as a timing system's webhook might name it: far longer than its box is wide.
const longTriggerKey = 'nome_do_piloto_entrevistado_no_box_da_equipe_42_baja_ufpr';
// A name as a team might send it for an on-air lower third.
const longPersonName = 'Ana Beatriz Souza de Albuquerque Cavalcanti (Baja UFPR, equipe 42)';

/**
 * Lists the parts drawn inside `box` that reach past its left or right edge, each by its
 * name or its text, so a failure says which part spilled. Half a pixel is allowed for
 * rounding. A part with no size (a hidden native select) is not drawn and not counted.
 */
async function listPartsReachingPastTheEdgesOf(box: Locator): Promise<string[]> {
  return box.evaluate((boxElement) => {
    const roundingInPixels = 0.5;
    const boxEdges = boxElement.getBoundingClientRect();
    const partsReachingPast: string[] = [];
    for (const part of boxElement.querySelectorAll('*')) {
      const partEdges = part.getBoundingClientRect();
      const isDrawn = partEdges.width > 0 && partEdges.height > 0;
      const isPastTheLeftEdge = partEdges.left < boxEdges.left - roundingInPixels;
      const isPastTheRightEdge = partEdges.right > boxEdges.right + roundingInPixels;
      if (isDrawn && (isPastTheLeftEdge || isPastTheRightEdge)) {
        const partName = part.getAttribute('aria-label') ?? part.textContent ?? '';
        partsReachingPast.push(`<${part.tagName.toLowerCase()}> ${partName.slice(0, 60)}`);
      }
    }
    return partsReachingPast;
  });
}

/** Opens a dropdown by its name and picks one option (the list is drawn at the page's end). */
async function chooseInDropdown(page: Page, within: Locator, name: string, option: string) {
  await within.getByRole('combobox', { name }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test('the take step’s "Dado do gatilho" with a long key stays inside the step’s box', async ({
  page,
}) => {
  // Arrange: an "Atalhos" lower third for the interviewee; a new macro taking it, its
  // fields shown, "Nome" read from the trigger.
  await sendCommandOrFail(realServerPort, {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'lower-third',
    layerId: 'lower-third',
    label: 'Entrevistado no box',
    fields: {
      name: { kind: 'literal', value: 'Convidado do box' },
      role: { kind: 'literal', value: 'Entrevista' },
    },
  });
  await openControlPageAndWaitUntilConnected(page);
  const quickFireArea = findQuickFireArea(page);
  await quickFireArea.getByRole('tab', { name: 'Macros' }).click();
  await quickFireArea.getByRole('button', { name: '+ Macro' }).click();
  const macroEditor = page.getByRole('region', { name: 'Editor de macro' });
  await macroEditor.getByRole('button', { name: '+ Passo' }).click();
  await chooseInDropdown(page, macroEditor, 'Item do passo 1', 'Entrevistado no box (Atalhos)');
  await macroEditor.getByRole('button', { name: 'Campos do gatilho do passo 1' }).click();
  await chooseInDropdown(page, macroEditor, 'Origem de Nome no passo 1', 'Dado do gatilho');

  // Act: type the long key.
  const keyBox = macroEditor.getByLabel('Chave do gatilho para Nome no passo 1');
  await keyBox.fill(longTriggerKey);

  // Assert: the key is in its box, and nothing of the step reaches past the step's edges.
  await expect(keyBox, 'the key must be typed in full').toHaveValue(longTriggerKey);
  const stepRow = macroEditor.getByRole('listitem', { name: 'Passo 1' });
  expect(
    await listPartsReachingPastTheEdgesOf(stepRow),
    'every part of the step must stay inside the step’s box',
  ).toEqual([]);
});

test('the item editor’s "Nome" stays inside the editor whichever way it is filled', async ({
  page,
}) => {
  // Arrange: a new lower third in the item editor, a long name typed, and the ways its
  // "Nome" may be filled, as its dropdown lists them.
  await openControlPageAndWaitUntilConnected(page);
  await findQuickFireArea(page).getByRole('button', { name: '+ Atalho' }).click();
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await chooseGraphicInTheItemEditor(page, itemEditor, 'Tarja');
  await itemEditor.getByLabel('Nome', { exact: true }).fill(longPersonName);
  await itemEditor.getByRole('combobox', { name: 'Como preencher Nome' }).click();
  const kindNames = await page.getByRole('option').allTextContents();
  await page.keyboard.press('Escape');

  // Act: choose each way in turn, noting what reaches past the editor's edges with it.
  const partsReachingPastByKind: Record<string, string[]> = {};
  for (const kindName of kindNames) {
    await chooseInDropdown(page, itemEditor, 'Como preencher Nome', kindName);
    partsReachingPastByKind[kindName] = await listPartsReachingPastTheEdgesOf(itemEditor);
  }

  // Assert: more than one way was tried, and none of them spilled.
  expect(kindNames.length, 'the dropdown must offer more than the typed value').toBeGreaterThan(1);
  const kindsThatSpilled = Object.entries(partsReachingPastByKind).filter(
    ([, parts]) => parts.length > 0,
  );
  expect(kindsThatSpilled, 'no way of filling "Nome" may push a part out of the editor').toEqual(
    [],
  );
});
