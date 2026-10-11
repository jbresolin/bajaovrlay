/**
 * Emptying the server between browser tests (apps/control, Playwright)
 *
 * What this module is for:
 *   Every browser test of the control page runs against one real server, one after the
 *   other. A test that stops halfway leaves the clock on air or an item in the rundown,
 *   and the next test then fails for a reason that is not its own. So every test file in
 *   this folder calls `emptyTheServerState` before each of its tests. This file proves
 *   that function does what the others rely on.
 *
 * What these tests prove:
 *   - With the race clock on air and an item in the rundown, `emptyTheServerState` leaves
 *     the clock layer "vazia" and the rundown without items, as the control page shows
 *     it, and the seeded rundown "Sessão principal" is still there.
 *   - Called on a server that is already empty, it changes nothing and does not fail.
 *
 * What these tests deliberately do not cover:
 *   - That the other test files call it before each test; each of them does so in a
 *     `test.beforeEach` at its top, which is there to be read.
 *   - Layers and graphics: no command changes them, so there is nothing to put back.
 *   - The event log, which keeps its rows; no browser test reads it.
 *
 * What it needs: the race clock built (`pnpm build`), because the server only registers
 * built graphics.
 */
import { expect, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';

/** Opens the control page and waits until it says it is connected to the server. */
async function openControlPageAndWaitUntilConnected(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before anything can be taken',
  ).toHaveText('Conectado');
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('emptying the server state', () => {
  test('takes the clock off air and every item out of the rundown, and keeps the rundown itself', async ({
    page,
  }) => {
    // Arrange: leave behind what a test that stopped halfway would: the race clock on
    // air (taken from "Edição rápida" with its form as it opens, only the session name
    // typed) and one item prepared in the rundown.
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Relógio' });
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const quickEditArea = page.getByRole('region', { name: 'Programa e edição rápida' });
    await quickEditArea
      .getByLabel('Nome da sessão', { exact: true })
      .fill('Enduro de Resistência — Bateria 1');
    await quickEditArea.getByRole('button', { name: 'Colocar no ar' }).click();
    await expect(clockLayerRow, 'the clock must be on its layer before the reset').toContainText(
      'Relógio de prova',
    );
    await page.getByRole('button', { name: '+ Item' }).click();
    const itemEditor = page.getByRole('region', { name: 'Editor de item' });
    await itemEditor.getByLabel('Rótulo', { exact: true }).fill('Largada do enduro');
    await itemEditor.getByLabel('Nome da sessão', { exact: true }).fill('Enduro — Largada');
    await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
    await expect(
      rundownArea.getByRole('listitem'),
      'the rundown must hold the one item before the reset',
    ).toHaveCount(1);

    // Act: empty the server, as every test file does before each of its tests.
    await emptyTheServerState();

    // Assert: the page, which only repeats the server, shows an empty layer and an empty
    // rundown, and the seeded rundown is still there to be filled.
    await expect(clockLayerRow, 'after the reset the clock layer must say "vazia"').toContainText(
      'vazia',
    );
    await expect(
      rundownArea.getByRole('listitem'),
      'after the reset the rundown must hold no item',
    ).toHaveCount(0);
    await expect(
      rundownArea.getByRole('heading', { name: 'Sessão principal' }),
      'the reset must keep the seeded rundown itself',
    ).toBeVisible();
  });

  test('changes nothing and does not fail on a server that is already empty', async ({ page }) => {
    // Arrange: the server was emptied before this test; open the page to see it.
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Relógio' });

    // Act: empty it once more.
    await emptyTheServerState();

    // Assert: still empty, and the call above did not throw.
    await expect(clockLayerRow, 'an already empty clock layer must stay "vazia"').toContainText(
      'vazia',
    );
    await expect(
      page.getByRole('region', { name: 'Rundown' }).getByRole('listitem'),
      'an already empty rundown must stay without items',
    ).toHaveCount(0);
  });
});
