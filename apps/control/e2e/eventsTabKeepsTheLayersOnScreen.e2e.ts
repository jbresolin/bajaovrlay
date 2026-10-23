/**
 * The "Eventos" tab never pushes Camadas off the screen (apps/control, Playwright)
 *
 * What this module is for:
 *   The console's "Eventos" tab sits in the right column, above Camadas. At gate 2 of
 *   PR #22 a long list of waiting events pushed Camadas below the bottom of the screen,
 *   where the operator could no longer see what is on air. The tab's list now scrolls
 *   inside a capped height. jsdom lays nothing out, so this browser test measures it.
 *
 * What these tests prove:
 *   - With eight typed penalties waiting and the "Eventos" tab shown, at the 1600×900 the
 *     browser tests use, the Camadas heading is on screen and the list of waiting events
 *     scrolls (it holds more than it shows).
 *
 * What these tests deliberately do not cover:
 *   - What the tab lists and its buttons; EventsTab.test.tsx.
 *   - Other screen sizes: the console is a desktop layout (docs/00-concept.md §3.4).
 */
import { expect, test } from '@playwright/test';

import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import { sendCommandOrFail } from './eventInboxOnTheRealServer';

/** Eight cars penalised by the race direction, as typed with "+ Evento". */
const typedPenalties = [
  { carNumber: 47, reason: 'Queima de largada' },
  { carNumber: 38, reason: 'Bloqueio de ultrapassagem' },
  { carNumber: 31, reason: 'Ultrapassagem sob bandeira amarela' },
  { carNumber: 52, reason: 'Corte de pista na curva do lago' },
  { carNumber: 12, reason: 'Reabastecimento com o motor ligado' },
  { carNumber: 7, reason: 'Excesso de velocidade no box' },
  { carNumber: 42, reason: 'Contato na largada' },
  { carNumber: 13, reason: 'Piloto sem cinto afivelado' },
];

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('the "Eventos" tab on the console', () => {
  test('keeps Camadas on screen with eight events waiting', async ({ page }) => {
    // Arrange: eight typed penalties waiting for the operator.
    for (const penalty of typedPenalties) {
      await sendCommandOrFail(realServerPort, {
        type: 'createManualEvent',
        noticeKind: 'penalty',
        carNumber: penalty.carNumber,
        reason: penalty.reason,
        penaltyText: '+30 segundos',
      });
    }

    // Act: open the console and show the "Eventos" tab.
    await page.goto('/');
    await expect(
      page.getByRole('status', { name: 'Conexão com o servidor' }),
      'the page must connect to the server',
    ).toHaveText('Conectado');
    await page.getByRole('tab', { name: /^Eventos/ }).click();
    const waitingList = page.getByRole('list', { name: 'Eventos esperando' });
    await expect(waitingList.getByRole('listitem'), 'all eight are listed').toHaveCount(8);

    // Assert: Camadas is still on screen, and the list scrolls instead of growing.
    const layersArea = page.getByRole('region', { name: 'Camadas' });
    await expect(
      layersArea.getByRole('heading', { name: 'Camadas' }),
      'Camadas must stay on screen',
    ).toBeInViewport();
    const doesTheListScroll = await waitingList.evaluate((list) => {
      const scrollingArea = list.parentElement;
      return scrollingArea !== null && scrollingArea.scrollHeight > scrollingArea.clientHeight;
    });
    expect(doesTheListScroll, 'the list holds more than it shows').toBe(true);
  });
});
