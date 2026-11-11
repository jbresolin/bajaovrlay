/**
 * A template's look changed in "Regras", then a typed penalty shown with it, end to end
 * (apps/control, Playwright)
 *
 * What this module is for:
 *   The walk of BAJAOVRLAY-67's templates: the event templates live beside their rules in
 *   "Regras", not on a quick-fire panel. The operator opens "Regras" on the "Eventos" page,
 *   presses "Editar aparência" on the typed events' row, changes the template in the item
 *   editor (its "Tipo de aviso" typed as "Advertência" instead of read from the event) and
 *   saves; then types a penalty with "+ Evento" and puts it on air with "No ar". In a real
 *   Chromium against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - The editor opened from "Regras" says it is a template, and its save is stored.
 *   - The typed penalty goes on air on the notice layer with the changed look: the head
 *     reads the typed "warning", not the event's "penalty"; the car the event's.
 *
 * What these tests deliberately do not cover:
 *   - What OBS draws: the server's instance is the truth (the notice's look is
 *     packages/graphics/notice's screenshots).
 *   - "Trocar", "Prévia" and "+ Novo modelo"; EventRulesTemplates.test.tsx.
 *
 * What it needs: `pnpm build` (the server registers built graphics only, the notice too).
 *
 * Sharing the server with the other tests: before each test the server is emptied, which
 * deletes the seeded templates; the test makes its own with createNoticeItemsOnTheServer.
 */
import { expect, test } from '@playwright/test';

import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import {
  createNoticeItemsOnTheServer,
  readInboxStateOfTheServerOnPort,
  sendCommandOrFail,
} from './eventInboxOnTheRealServer';

// One save, one command and one broadcast each; 10 s leaves room on a slow machine.
const waitForTheServerInMilliseconds = 10_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('a template changed in "Regras"', () => {
  test('shows the typed penalty with the changed look', async ({ page }) => {
    // Arrange: the penalty template, named by the typed events' rule, which asks; and the
    // "Eventos" page, connected.
    const { penaltyItemId } = await createNoticeItemsOnTheServer(realServerPort);
    await sendCommandOrFail(realServerPort, {
      type: 'updateEventRule',
      kind: 'manual',
      mode: 'ask',
      itemId: penaltyItemId,
    });
    await page.goto('/#/eventos');
    await expect(
      page.getByRole('status', { name: 'Conexão com o servidor' }),
      'the page must connect to the server before anything is pressed',
    ).toHaveText('Conectado');

    // Act 1: "Editar aparência" on the typed events' row, "Tipo de aviso" typed as
    // "Advertência", saved.
    await page.getByRole('button', { name: 'Regras' }).click();
    await page
      .getByRole('group', { name: 'Evento digitado' })
      .getByRole('button', { name: 'Editar aparência' })
      .click();
    await expect(
      page.getByRole('note', { name: 'Modelo de evento' }),
      'the editor says it is a template',
    ).toBeVisible();
    await page.getByRole('combobox', { name: 'Como preencher Tipo de aviso' }).click();
    await page.getByRole('option', { name: 'Valor digitado' }).click();
    await page.getByRole('combobox', { name: 'Tipo de aviso', exact: true }).click();
    await page.getByRole('option', { name: 'Advertência' }).click();
    await page.getByRole('button', { name: 'Salvar item' }).click();
    await expect(
      page.getByRole('group', { name: 'Evento digitado' }),
      'the rules come back once the save is accepted',
    ).toBeVisible({ timeout: waitForTheServerInMilliseconds });
    await page.keyboard.press('Escape');

    // Act 2: a penalty typed for car 47, then "No ar".
    await page.getByRole('button', { name: '+ Evento' }).click();
    const manualForm = page.getByRole('dialog');
    await manualForm.getByLabel('Carro').fill('47');
    await manualForm.getByLabel('Motivo').fill('Queima de largada');
    await manualForm.getByRole('button', { name: 'Criar evento' }).click();
    await expect(manualForm, 'the form closes once the event is stored').toBeHidden();
    const waitingEvents = page.getByRole('list', { name: 'Eventos esperando' });
    await waitingEvents.getByRole('button', { name: 'No ar' }).click();

    // Assert: the notice on air carries the typed kind, and the event's car.
    await expect
      .poll(
        async () => {
          const state = await readInboxStateOfTheServerOnPort(realServerPort);
          const noticeOnAir = state.instances.find(
            (instance) => instance.layerId === 'notice' && instance.target === 'program',
          );
          return {
            noticeKind: noticeOnAir?.resolvedData.noticeKind,
            carNumber: noticeOnAir?.resolvedData.carNumber,
          };
        },
        {
          message: 'the penalty goes on air with the look changed in "Regras"',
          timeout: waitForTheServerInMilliseconds,
        },
      )
      .toEqual({ noticeKind: 'warning', carNumber: 47 });
  });
});
