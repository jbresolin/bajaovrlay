/**
 * Take and clear, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   M0 is done when an operator can open the control page, put the race clock on air,
 *   and take it off again, with the server as the only owner of the state. This test
 *   walks that path in a real Chromium against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - Filling the race clock form and pressing "Colocar no ar" makes the layer panel
 *     show the clock on the "Relógio" layer within 2 seconds.
 *   - Reloading the page changes nothing: the panel still shows the clock, because the
 *     state lives on the server and not in the page; and the form comes back showing
 *     what is on air instead of its defaults.
 *   - Pressing "Limpar" on that layer brings it back to "vazia".
 *
 * What these tests deliberately do not cover:
 *   - The clock appearing inside the program monitor. That needs the renderer to draw
 *     instances, which is BAJAOVRLAY-9 (open, not merged when this was written). Add the
 *     assertion "the program monitor frame contains the clock element" once it is in.
 *   - A restart of the server keeping the state; the server's storeRestart.test.ts does.
 *   - Field validation, clear all and the keyboard; the component tests cover those.
 *
 * What it needs: the race clock built (`pnpm build`, or its own browser tests, which
 * pnpm runs before these), because the server only registers built graphics.
 */
import { expect, test } from '@playwright/test';

test.describe('taking and clearing the race clock', () => {
  test('shows the clock on its layer after the take, keeps it across a reload, and empties the layer on clear', async ({
    page,
  }) => {
    // Arrange: open the control page, wait until it is connected, and fill the form for
    // the endurance race, 12 min 34 s in, under the green flag, with the clock running.
    await page.goto('/');
    await expect(
      page.getByRole('status', { name: 'Conexão com o servidor' }),
      'the page must connect to the server before anything can be taken',
    ).toHaveText('Conectado');
    const clockLayerRow = page.getByRole('listitem', { name: 'Relógio' });
    await expect(clockLayerRow, 'the clock layer must start empty on a new database').toContainText(
      'vazia',
    );
    await page.getByLabel('Nome da sessão').fill('Enduro de Resistência — Bateria 1');
    await page.getByRole('combobox', { name: 'Bandeira' }).click();
    await page.getByRole('option', { name: 'Verde' }).click();
    await page.getByRole('switch', { name: 'Relógio correndo' }).click();
    await page.getByLabel('Tempo de referência (mm:ss)').fill('12:34');

    // Act: put the clock on air.
    await page.getByRole('button', { name: 'Colocar no ar' }).click();

    // Assert: within 2 seconds the layer panel shows the race clock on the clock layer.
    await expect(
      clockLayerRow,
      'the layer panel must show the race clock within 2 seconds of the take',
    ).toContainText('Relógio de prova', { timeout: 2_000 });
    await expect(clockLayerRow, 'a layer with the clock on it is not "vazia"').not.toContainText(
      'vazia',
    );

    // Act: reload the page, as an operator does when the browser misbehaves.
    await page.reload();

    // Assert: nothing was lost, because the server is the truth; and since the clock is
    // on air, the panel now offers "Atualizar" and its form shows what is on air. (The
    // time field is not checked: the clock is running, so its text depends on the second.)
    await expect(
      clockLayerRow,
      'after a reload the layer panel must still show the race clock',
    ).toContainText('Relógio de prova');
    await expect(
      page.getByRole('button', { name: 'Atualizar' }),
      'with the clock on air the form must offer "Atualizar"',
    ).toBeVisible();
    await expect(
      page.getByLabel('Nome da sessão'),
      'after a reload the form must show the session name that is on air, not its default',
    ).toHaveValue('Enduro de Resistência — Bateria 1');
    await expect(
      page.getByRole('combobox', { name: 'Bandeira' }),
      'after a reload the form must show the flag that is on air',
    ).toHaveText('Verde');
    await expect(
      page.getByRole('switch', { name: 'Relógio correndo' }),
      'after a reload the switch must be on, because the clock on air is running',
    ).toBeChecked();

    // Act: clear the clock layer.
    await clockLayerRow.getByRole('button', { name: 'Limpar' }).click();

    // Assert: the layer is empty again.
    await expect(clockLayerRow, 'after "Limpar" the clock layer must say "vazia"').toContainText(
      'vazia',
    );
  });
});
