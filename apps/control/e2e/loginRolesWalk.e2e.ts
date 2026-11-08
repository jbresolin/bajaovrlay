/**
 * Logging in as Dados and as Produtor, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   The brief's walk of BAJAOVRLAY-29. On the studio LAN the control page asks who you
 *   are: Dados prepares the show and never changes what is on air; Produtor runs it. This
 *   test walks both in a real Chromium against a real server started with the two PINs
 *   (loginServerOfTheBrowserTests.ts), which serves the built page as the stream PC does.
 *
 * What these tests prove:
 *   - With no session the page opens on "#/entrar", the only page it shows.
 *   - Logged in as Dados at "Mesa 2", the header says "Dados · Mesa 2"; Dados prepares a
 *     race clock item in the rundown and edits its label; its "Disparar" is greyed out
 *     and its tooltip says "O papel Dados não pode mudar o que está no ar. Peça ao Produtor."
 *   - "Sair" goes back to "#/entrar", and the page has no session any more.
 *   - Logged in as Produtor at "Mesa 1", "Disparar" puts the item Dados prepared on air.
 *   - The event log names each of them: the item's creation and edit `dados:Mesa 2`, the
 *     take `produtor:Mesa 1`.
 *
 * What these tests deliberately do not cover:
 *   - The server's own refusal of a take sent by Dados, the lockout and expiry; the
 *     server's tests do (authorizeCommandsByRole, operatorLoginRoutes, the hub's).
 *   - Every greyed-out control and shortcut; the component tests in src/features/login/.
 *
 * What it needs: `pnpm build` first (the server serves the built page and the built race
 * clock), as every browser test of this folder does for the graphics.
 */
import { expect, type Page, test } from '@playwright/test';

import { findItemEditorOwnTextField } from './itemEditorOwnFields';
import {
  dataRolePinOfTheBrowserTests,
  loginServerAddress,
  producerPinOfTheBrowserTests,
} from './loginServerOfTheBrowserTests';
import { createRaceClockItemInTheEditor } from './previewTestSteps';

test.use({ baseURL: loginServerAddress });

/** The parts of GET /api/v1/state this test reads. */
type StateThisTestReads = {
  eventLog: Array<{ actor: string; command: string; result: { status: string } }>;
};

/** Logs in on "#/entrar" as an operator does, and waits until the console is connected. */
async function logInAs(
  page: Page,
  login: { roleName: 'Produtor' | 'Dados'; pin: string; station: string },
): Promise<void> {
  await expect(page, 'a page without a session is on the login').toHaveURL(/#\/entrar$/);
  await page.getByRole('radio', { name: login.roleName }).check();
  await page.getByLabel('PIN').fill(login.pin);
  await page.getByLabel('Estação').fill(login.station);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'once logged in, the console connects',
  ).toHaveText('Conectado');
}

/** The rundown's row of the item with this label. */
function findRundownRow(page: Page, itemLabel: string) {
  return page.getByRole('region', { name: 'Rundown' }).getByRole('listitem', { name: itemLabel });
}

test('Dados prepares and edits an item but cannot take it; Produtor takes it', async ({ page }) => {
  // Arrange: the page opened with no session.
  await page.goto('/');
  await expect(page.getByText('Entrar', { exact: true }).first(), 'the login page').toBeVisible();

  // Act, as Dados: log in, prepare the race clock, then edit its label.
  await logInAs(page, {
    roleName: 'Dados',
    pin: dataRolePinOfTheBrowserTests,
    station: 'Mesa 2',
  });
  await expect(
    page.getByText('Dados · Mesa 2'),
    'the header names the role and station',
  ).toBeVisible();
  await createRaceClockItemInTheEditor(page, 'Largada do Enduro', 'Enduro de Resistência');
  await findRundownRow(page, 'Largada do Enduro')
    .getByRole('button', { name: 'Editar item' })
    .click();
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill('Largada do Enduro 26BR');
  await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
  await expect(itemEditor, 'the editor closes once the server accepted the edit').toBeHidden();

  // Assert, as Dados: the edit is in the rundown, and "Disparar" is greyed out, saying why.
  const rowAsDados = findRundownRow(page, 'Largada do Enduro 26BR');
  await expect(rowAsDados, 'Dados edits items').toBeVisible();
  const takeButtonAsDados = rowAsDados.getByRole('button', { name: 'Disparar' });
  await expect(
    takeButtonAsDados,
    '"Disparar" is greyed out for Dados, never hidden',
  ).toBeDisabled();
  // A disabled button gets no hover; the area around it carries the tooltip.
  await takeButtonAsDados.locator('..').hover();
  await expect(page.getByRole('tooltip'), 'the tooltip says why, in pt-BR').toHaveText(
    'O papel Dados não pode mudar o que está no ar. Peça ao Produtor.',
  );

  // Act: "Sair", then log in as Produtor and take the item.
  await page.getByRole('button', { name: 'Sair' }).click();
  await logInAs(page, {
    roleName: 'Produtor',
    pin: producerPinOfTheBrowserTests,
    station: 'Mesa 1',
  });
  await findRundownRow(page, 'Largada do Enduro 26BR')
    .getByRole('button', { name: 'Disparar' })
    .click();

  // Assert, as Produtor: Camadas names the item on the clock layer, and the event log
  // names each operator by role and station.
  await expect(
    page.getByRole('region', { name: 'Camadas' }).getByRole('listitem', { name: 'Relógio' }),
    'the Produtor’s take puts the item on air',
  ).toContainText('Largada do Enduro 26BR');
  const stateResponse = await page.request.get('/api/v1/state');
  const state = (await stateResponse.json()) as StateThisTestReads;
  const rowsOfTheItem = state.eventLog
    .filter((row) => ['createItem', 'updateItemFields', 'takeItem'].includes(row.command))
    .map((row) => ({ actor: row.actor, command: row.command, status: row.result.status }));
  expect(rowsOfTheItem, 'the event log names who did what').toEqual([
    { actor: 'dados:Mesa 2', command: 'createItem', status: 'ok' },
    { actor: 'dados:Mesa 2', command: 'updateItemFields', status: 'ok' },
    { actor: 'produtor:Mesa 1', command: 'takeItem', status: 'ok' },
  ]);
});

test('"Sair" leaves the page with no session', async ({ page }) => {
  // Arrange: the Produtor logged in at "Mesa 1".
  await page.goto('/');
  await logInAs(page, {
    roleName: 'Produtor',
    pin: producerPinOfTheBrowserTests,
    station: 'Mesa 1',
  });

  // Act: "Sair".
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page, '"Sair" goes back to the login').toHaveURL(/#\/entrar$/);

  // Assert: the page's own read of the state is refused now.
  const stateResponse = await page.request.get('/api/v1/state');
  expect(stateResponse.status(), 'no session after "Sair"').toBe(401);
});
