/**
 * A Super Chat approved by Dados, put on air by the Produtor, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   The brief's walk of BAJAOVRLAY-35, rehearsed with no live stream: the simulator, with
 *   "Simular Super Chats" on, gives a fictional viewer's paid message about every 5
 *   simulated minutes (about 5 s at 60×). It arrives pending. Dados, logged in on one page,
 *   approves it on "Eventos"; the Produtor, logged in on another, puts it on air with "No
 *   ar"; the renderer (the console's "Programa" monitor, the real renderer page) shows the
 *   Super Chat card. In a real Chromium against the real server started with both PINs
 *   (loginServerOfTheBrowserTests.ts) and a real SQLite file.
 *
 * What these tests prove:
 *   - Before approval the Produtor has no "No ar" for the Super Chat, and nothing reaches
 *     the notice layer.
 *   - Dados's "Aprovar" makes it the Produtor's to air: "No ar" on the Produtor's page puts
 *     the seeded "Super Chat" item on the notice layer, and the renderer draws the viewer's
 *     name and amount on the super-chat card.
 *   - The event log names Dados for the approval and the Produtor for the show.
 *
 * What these tests deliberately do not cover:
 *   - The YouTube source itself: no test reaches Google; the adapter's tests use a local
 *     fake YouTube.
 *   - Every button by role and status; SuperChatModeration.test.tsx and the server's
 *     superChatModerationOnTheStore.test.ts.
 *   - The card's look; packages/graphics/super-chat's screenshots.
 *
 * What it needs: `pnpm build` (the server registers built graphics only, the super-chat
 * card too, and serves the built control page).
 *
 * Sharing the login server with loginRolesWalk.e2e.ts: this test only turns the seeded
 * simulator on and off and moderates its own Super Chat; it creates no item, so that
 * walk's event-log rows stay its own. The simulator is turned off at the end.
 */
import { type Browser, expect, type Page, test } from '@playwright/test';

import {
  changeSimulatorInItsEditForm,
  findDataSourceRow,
  openDataSourcesPageAndWaitUntilConnected,
  pollIntervalOfTheTestsAsTyped,
  turnSourceOffWithItsSwitch,
  turnSourceOnWithItsSwitch,
} from './dataSourcesTestSteps';
import { seededSimulatorLabel } from './emptyTheServerState';
import {
  dataRolePinOfTheBrowserTests,
  loginServerAddress,
  producerPinOfTheBrowserTests,
} from './loginServerOfTheBrowserTests';

test.use({ baseURL: loginServerAddress });

// A Super Chat about every 5 simulated minutes is about 5 s at 60×, after up to 10 s for
// the first poll; 30 s leaves room on a slow machine before its clear message.
const waitForASuperChatInMilliseconds = 30_000;
// One command and one broadcast; the renderer's in-animation takes under a second.
const waitForTheAirInMilliseconds = 10_000;
const longestThisTestMayTakeInMilliseconds = 120_000;

/** The parts of GET /api/v1/state this test reads. */
type StateThisTestReads = {
  events: Array<{
    eventId: string;
    kind: string;
    status: string;
    payload: { authorName?: string; amountText?: string };
  }>;
  instances: Array<{ target: string; layerId: string; eventId?: string }>;
  eventLog: Array<{ actor: string; command: string; result: { status: string } }>;
};

/** Opens a page of its own (its own cookies) on the login server. */
async function openPageOfItsOwn(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: loginServerAddress });
  return context.newPage();
}

/** Logs in on "#/entrar" as an operator does, and waits until the page is connected. */
async function logInAs(
  page: Page,
  login: { roleName: 'Produtor' | 'Dados'; pin: string; station: string },
): Promise<void> {
  await page.goto('/');
  await expect(page, 'a page without a session is on the login').toHaveURL(/#\/entrar$/);
  await page.getByRole('radio', { name: login.roleName }).check();
  await page.getByLabel('PIN').fill(login.pin);
  await page.getByLabel('Estação').fill(login.station);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'once logged in, the page connects',
  ).toHaveText('Conectado');
}

/** The server's state, read with the page's own session. */
async function readStateWithTheSessionOf(page: Page): Promise<StateThisTestReads> {
  const stateResponse = await page.request.get('/api/v1/state');
  return (await stateResponse.json()) as StateThisTestReads;
}

/**
 * Turns the seeded simulator on at 60×, read every 0,5 s, with "Simular Super Chats" on,
 * from the "Fontes de dados" page.
 */
async function startTheSimulatorWithSuperChats(page: Page): Promise<void> {
  await openDataSourcesPageAndWaitUntilConnected(page);
  await changeSimulatorInItsEditForm(page, seededSimulatorLabel, {
    pollIntervalAsTyped: pollIntervalOfTheTestsAsTyped,
    speedAsTyped: '60',
  });
  await findDataSourceRow(page, seededSimulatorLabel)
    .getByRole('button', { name: 'Editar' })
    .click();
  const editForm = page.getByRole('region', { name: `Editar fonte: ${seededSimulatorLabel}` });
  const superChatsSwitch = editForm.getByRole('switch', { name: 'Simular Super Chats' });
  if ((await superChatsSwitch.getAttribute('aria-checked')) !== 'true') {
    await superChatsSwitch.click();
  }
  await editForm.getByRole('button', { name: 'Salvar fonte' }).click();
  await expect(editForm, 'the edit form closes once the server accepted it').toBeHidden();
  await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
}

test('Dados approves a Super Chat, the Produtor puts it on air, the renderer shows it', async ({
  browser,
}) => {
  test.setTimeout(longestThisTestMayTakeInMilliseconds);

  // Arrange: the Produtor at "Mesa 1" starts the simulator with Super Chats and opens the
  // console's "Eventos" tab; Dados at "Mesa 2" opens the "Eventos" page.
  const producerPage = await openPageOfItsOwn(browser);
  await logInAs(producerPage, {
    roleName: 'Produtor',
    pin: producerPinOfTheBrowserTests,
    station: 'Mesa 1',
  });
  await startTheSimulatorWithSuperChats(producerPage);
  await producerPage.goto('/');
  await producerPage.getByRole('tab', { name: /^Eventos/ }).click();
  const dataRolePage = await openPageOfItsOwn(browser);
  await logInAs(dataRolePage, {
    roleName: 'Dados',
    pin: dataRolePinOfTheBrowserTests,
    station: 'Mesa 2',
  });
  await dataRolePage.goto('/#/eventos');

  // Act 1: wait for the first Super Chat to wait for approval on Dados's page.
  const awaitingApproval = dataRolePage.getByRole('list', {
    name: 'Super Chats aguardando aprovação',
  });
  const firstSuperChatRow = awaitingApproval.getByRole('listitem').first();
  await expect(firstSuperChatRow, 'a simulated Super Chat must arrive for Dados').toBeVisible({
    timeout: waitForASuperChatInMilliseconds,
  });
  const stateWithItPending = await readStateWithTheSessionOf(dataRolePage);
  const superChat = stateWithItPending.events.find(
    (event) => event.kind === 'superChat' && event.status === 'pending',
  );
  const authorName = superChat?.payload.authorName ?? '';
  const amountText = superChat?.payload.amountText ?? '';
  const superChatRowOfDados = awaitingApproval
    .getByRole('listitem')
    .filter({ hasText: authorName })
    .first();

  // Assert 1: the Produtor has no "No ar" for it, and nothing is on the notice layer.
  const producerWaitingRow = producerPage
    .getByRole('list', { name: 'Eventos esperando' })
    .getByRole('listitem')
    .filter({ hasText: authorName });
  await expect(
    producerWaitingRow.getByRole('button', { name: 'No ar' }),
    'a Super Chat no one approved offers no "No ar"',
  ).toHaveCount(0);
  const noticeBeforeApproval = (await readStateWithTheSessionOf(producerPage)).instances.filter(
    (instance) => instance.target === 'program' && instance.layerId === 'notice',
  );
  expect(noticeBeforeApproval, 'nothing may reach the notice layer before approval').toEqual([]);

  // Act 2: Dados approves it; the Produtor presses "No ar" on it.
  await superChatRowOfDados.getByRole('button', { name: 'Aprovar' }).click();
  const approvedRow = producerWaitingRow.first();
  await approvedRow.getByRole('button', { name: 'No ar' }).click();

  // Assert 2: the server shows it on the notice layer, and the renderer draws its card with
  // the viewer's name and amount.
  await expect
    .poll(
      async () =>
        (await readStateWithTheSessionOf(producerPage)).instances.find(
          (instance) => instance.target === 'program' && instance.layerId === 'notice',
        )?.eventId,
      { message: 'the Super Chat must go on air', timeout: waitForTheAirInMilliseconds },
    )
    .toBe(superChat?.eventId);
  const cardInTheProgramMonitor = producerPage
    .frameLocator('iframe[title="Programa"]')
    .locator('[data-layer-id="notice"] > baja-graphic-super-chat');
  await expect(cardInTheProgramMonitor, 'the renderer draws the viewer').toContainText(authorName, {
    timeout: waitForTheAirInMilliseconds,
  });
  await expect(cardInTheProgramMonitor, 'and the amount').toContainText(amountText);

  // Assert 3: the event log names who approved and who aired it.
  const eventLog = (await readStateWithTheSessionOf(producerPage)).eventLog;
  const moderationRows = eventLog
    .filter((row) => ['approveEvent', 'showEvent'].includes(row.command))
    .map((row) => ({ actor: row.actor, command: row.command, status: row.result.status }));
  expect(moderationRows, 'the log names Dados for the approval, the Produtor for the air').toEqual([
    { actor: 'dados:Mesa 2', command: 'approveEvent', status: 'ok' },
    { actor: 'produtor:Mesa 1', command: 'showEvent', status: 'ok' },
  ]);

  // Clean up: the simulator off, so the login walk shares a quiet server.
  await openDataSourcesPageAndWaitUntilConnected(producerPage);
  await turnSourceOffWithItsSwitch(producerPage, seededSimulatorLabel);
});
