/**
 * Picking which source's data is shown, in a real browser (apps/control, Playwright)
 *
 * What this module is for:
 *   On the "Fontes de dados" page a click anywhere on a source's card shows its data,
 *   except a click on the card's own controls, and its "Ver" button is the keyboard way
 *   in (brief E1). Two things about that only a real browser shows: a greyed-out
 *   (disabled) button lets its click through to what is under it, and Enter on a focused
 *   button presses it. The test browser of the unit tests (jsdom) does neither.
 *
 * What these tests prove:
 *   - A click on the greyed-out "Atualizar agora" of a source that is off leaves the
 *     data shown as it was; a click on that card's empty space then does pick it, so the
 *     first click was really kept from the card, not lost.
 *   - "Ver" is reached with Tab from the card's "Ligada" switch (the greyed-out commands
 *     between them are skipped), and Enter on it shows that source's data and marks it
 *     pressed.
 *
 * What these tests deliberately do not cover:
 *   - Clicks on enabled buttons and on the switch, and "Ver" by click:
 *     DataSourcesPageSourcePicking.test.tsx.
 *   - What the shown data looks like: DataSourcesPageDetail.test.tsx.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, and the seeded simulator is turned off with
 *   its default settings back, so these tests pass whatever ran before them, in any order.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  findDataSourceRow,
  openDataSourcesPageAndWaitUntilConnected,
  openNewSourceFormOfKind,
  seededSimulatorLabel,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';

// The second source of these tests, made with "+ Fonte" and left off.
const practiceSimulatorLabel = 'Simulador — Treino livre';

/**
 * Opens the page and adds a second simulator, "Simulador — Treino livre", left off, so
 * the list holds two sources that are both off and the seeded one is the one shown.
 */
async function openPageWithTheSeededSimulatorAndAPracticeSimulator(page: Page): Promise<void> {
  await openDataSourcesPageAndWaitUntilConnected(page);
  const newSimulatorForm = await openNewSourceFormOfKind(page, 'Simulador');
  await newSimulatorForm.getByLabel('Nome da fonte').fill(practiceSimulatorLabel);
  await newSimulatorForm.getByRole('button', { name: 'Salvar fonte' }).click();
  await expect(
    findDataSourceRow(page, practiceSimulatorLabel),
    'the practice simulator must be listed once the server has it',
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: `Dados de ${seededSimulatorLabel}` }),
    'the seeded simulator, first in the list, must be the one shown',
  ).toBeVisible();
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('picking a source on the "Fontes de dados" page', () => {
  test('keeps the source shown when the greyed-out "Atualizar agora" of a card is clicked', async ({
    page,
  }) => {
    // Arrange: two simulators, both off; the seeded one shown; the practice one's
    // "Atualizar agora" greyed out because it is off.
    await openPageWithTheSeededSimulatorAndAPracticeSimulator(page);
    const practiceRow = findDataSourceRow(page, practiceSimulatorLabel);
    const pollNowButton = practiceRow.getByRole('button', { name: 'Atualizar agora' });
    await expect(
      pollNowButton,
      'an off source cannot be polled, so it is greyed out',
    ).toBeDisabled();

    // Act: click the greyed-out button where it is drawn, as the mouse would (force skips
    // Playwright's wait for it to be enabled; the browser then hands the click on).
    await pollNowButton.click({ force: true });

    // Assert: the seeded simulator is still shown; then a click on the card's name, its
    // empty space, does pick the practice simulator, so the card still listens.
    await expect(
      page.getByRole('region', { name: `Dados de ${seededSimulatorLabel}` }),
      'a click on a greyed-out command must not pick its source',
    ).toBeVisible();
    await practiceRow.getByText(practiceSimulatorLabel, { exact: true }).click();
    await expect(
      page.getByRole('region', { name: `Dados de ${practiceSimulatorLabel}` }),
      "a click on the card's empty space must still pick the source",
    ).toBeVisible();
  });

  test('reaches "Ver" with Tab and shows its source with Enter', async ({ page }) => {
    // Arrange: two simulators, both off; the seeded one shown; the focus on the practice
    // simulator's "Ligada" switch, the card's last control before its greyed-out commands.
    await openPageWithTheSeededSimulatorAndAPracticeSimulator(page);
    const practiceRow = findDataSourceRow(page, practiceSimulatorLabel);
    const viewButton = practiceRow.getByRole('button', { name: 'Ver' });
    await practiceRow.getByRole('switch', { name: 'Ligada' }).focus();

    // Act: Tab to the next stop, then Enter.
    await page.keyboard.press('Tab');
    await expect(viewButton, 'Tab from the switch must land on "Ver"').toBeFocused();
    await page.keyboard.press('Enter');

    // Assert: the practice simulator's data is shown and its "Ver" says so.
    await expect(
      page.getByRole('region', { name: `Dados de ${practiceSimulatorLabel}` }),
      'Enter on the focused "Ver" must show its source',
    ).toBeVisible();
    await expect(viewButton, '"Ver" must say its card is the one shown').toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
