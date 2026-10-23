/**
 * Emptying the server's event inbox between browser tests (apps/control, Playwright)
 *
 * What this module is for:
 *   `emptyTheServerState` runs before every browser test; since BAJAOVRLAY-44 it also puts
 *   the event rules back to their defaults and leaves no event waiting, so a test that
 *   changed a rule or typed a penalty does not leave it to the next one. This proves that
 *   part; emptyServerState.e2e.ts proves the rest of the reset. It lives in a file of its
 *   own so that one stays under the 400-line limit.
 *
 * What these tests prove:
 *   - With the fastest-lap rule set to "Perguntar" and a typed penalty waiting, both done
 *     on the "Eventos" page, `emptyTheServerState` puts the rule back to "Automático" and
 *     leaves no event waiting.
 *
 * What these tests deliberately do not cover:
 *   - The events already shown or dismissed: the reset keeps them listed, as the event log
 *     keeps its rows; no browser test reads them.
 *   - Everything else the reset empties; emptyServerState.e2e.ts.
 */
import { expect, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('emptying the event inbox', () => {
  test('puts the event rules back and leaves no event waiting', async ({ page }) => {
    // Arrange: on the "Eventos" page, a penalty typed for car 47, and the fastest-lap rule
    // set to wait for the operator.
    await page.goto('/#/eventos');
    await expect(
      page.getByRole('status', { name: 'Conexão com o servidor' }),
      'the page must connect to the server before anything can be typed',
    ).toHaveText('Conectado');
    await page.getByRole('button', { name: '+ Evento' }).click();
    const manualForm = page.getByRole('dialog');
    await manualForm.getByLabel('Carro').fill('47');
    await manualForm.getByLabel('Motivo').fill('Reabastecimento com o motor ligado');
    await manualForm.getByRole('button', { name: 'Criar evento' }).click();
    await expect(manualForm, 'the form closes once the event is stored').toBeHidden();
    await page.getByRole('button', { name: 'Regras' }).click();
    const fastestLapRule = page.getByRole('group', { name: 'Volta mais rápida' });
    await fastestLapRule.getByRole('combobox', { name: 'Modo de Volta mais rápida' }).click();
    await page.getByRole('option', { name: 'Perguntar' }).click();
    await fastestLapRule.getByRole('button', { name: 'Salvar' }).click();
    await page.keyboard.press('Escape');
    const waitingEvents = page.getByRole('list', { name: 'Eventos esperando' });
    await expect(waitingEvents.getByRole('listitem'), 'the penalty waits').toHaveCount(1);

    // Act: empty the server.
    await emptyTheServerState();

    // Assert: nothing waits any more, and the rule is back to "Automático".
    await expect(
      waitingEvents.getByRole('listitem'),
      'no event may wait after the reset',
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Regras' }).click();
    await expect(
      page.getByRole('combobox', { name: 'Modo de Volta mais rápida' }),
      'the fastest-lap rule is back to its default',
    ).toHaveText('Automático');
  });
});
