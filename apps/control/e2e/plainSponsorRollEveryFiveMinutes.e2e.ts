/**
 * The seeded sponsors trigger, every 5 minutes on auto, puts the plain roll on air and the
 * roll leaves after its pass (apps/control, BAJAOVRLAY-64, the brief's E2E)
 *
 * What this module is for:
 *   Every new database comes with "Patrocinadores (simples)": an item on the plain sponsor
 *   roll reading every sponsor of Cadastros, its macro, and a trigger "Patrocinadores a cada
 *   30 min", off and asking. The operator switches it on, sets it to "Automático" every 5
 *   minutes, and from then on the roll comes back by itself, every 5 minutes counted from
 *   that moment, and leaves when its one pass ends.
 *
 * What this test proves, against a real server of its own, its built pages and a real
 * SQLite file:
 *   - the operator edits the seeded trigger on "Gatilhos" (#/eventos) and saves it;
 *   - with the server clock moved to 4 s before the 5 minutes were up (its NTP server's time
 *     moved, then "Acertar relógio agora"), the trigger fires by itself and the roll goes on
 *     air with Bosch, Diamante, drawn on the program output OBS loads (`/render/`);
 *   - its auto-out is the pass of one Diamante sponsor, 8,4 s, and the layer is empty again
 *     once it has passed, not before 8 s.
 *
 * What it deliberately does not cover:
 *   - The window, the sleep, a roll still on air, "Pausar gatilhos"; the server's
 *     intervalTriggers.test.ts proves them on fake time.
 *   - The turns between sponsors; the graphic's own tests (one sponsor here, so no turn).
 *
 * Why a server of its own: the shared server runs with NTP off, and its clock is the one
 * every other test reads; this test moves the clock of its own server only, through an NTP
 * server of its own (fakeNtpServerOfTheBrowserTests.ts).
 *
 * What it needs: the control page, the renderer and the plain sponsor roll built
 * (`pnpm build`), since the own server serves them itself.
 */
import { expect, type Page, test } from '@playwright/test';

import { portOffsetOfTheBrowserTests } from './emptyTheServerState';
import { buildLogoOfTeam7 } from './entityLibraryTestSteps';
import { sendCommandOrFail } from './eventInboxOnTheRealServer';
import { startFakeNtpServerOfATest } from './fakeNtpServerOfTheBrowserTests';
import { type OwnServer, startOwnServer, stopOwnServer } from './ownServerOfABrowserTest';

/**
 * This file's own server: away from the shared one (5187), the page (5188), the restart
 * test's (5189) and the login server (5181), moved with them by BAJAOVRLAY_E2E_PORT_OFFSET.
 */
const ownServerPort = 5190 + portOffsetOfTheBrowserTests;
const ownServerAddress = `http://127.0.0.1:${String(ownServerPort)}`;

/** The seeded trigger and item, by the names and ids the server seeds them with. */
const seededTriggerName = 'Patrocinadores a cada 30 min';
const seededTriggerId = 'patrocinadores-a-cada-30-min';
const seededItemId = 'patrocinadores-simples';

/** One Diamante sponsor's pass: the 0,4 s entrance and its 8 s hold. */
const passOfOneDiamanteSponsorMs = 8400;

// The firing comes 4 s after the step; the take, the renderer and a slow CI machine on top.
const waitForTheFiringInMilliseconds = 20_000;
const longestThisTestMayTakeInMilliseconds = 120_000;

/** What the test reads of GET /api/v1/state. */
type StateThePlainRollTestReads = {
  triggers: Array<{ id: string; isEnabled: boolean; intervalCountedFromMs?: number }>;
  instances: Array<{
    layerId: string;
    target: string;
    itemId?: string;
    autoOutAfterMs?: number;
  }>;
};

/** Reads the own server's state. */
async function readStateOfTheOwnServer(): Promise<StateThePlainRollTestReads> {
  const response = await fetch(`${ownServerAddress}/api/v1/state`);
  return (await response.json()) as StateThePlainRollTestReads;
}

/** The plain roll on the bug layer's program output, or undefined when it is off air. */
async function findThePlainRollOnAir() {
  const state = await readStateOfTheOwnServer();
  return state.instances.find(
    (instance) =>
      instance.layerId === 'bug' &&
      instance.target === 'program' &&
      instance.itemId === seededItemId,
  );
}

/** Bosch, Diamante, with a logo uploaded to the own server's media store, saved in Cadastros. */
async function saveBoschWithItsLogo(): Promise<void> {
  const form = new FormData();
  form.append(
    'file',
    new File([new Uint8Array(buildLogoOfTeam7())], 'logo-bosch.png', { type: 'image/png' }),
  );
  const uploadResponse = await fetch(`${ownServerAddress}/api/v1/media`, {
    method: 'POST',
    body: form,
  });
  const { mediaId } = (await uploadResponse.json()) as { mediaId: string };
  await sendCommandOrFail(ownServerPort, {
    type: 'upsertEntity',
    entityType: 'sponsor',
    record: {
      sponsorId: 'bosch',
      name: 'Bosch',
      tier: 'diamante',
      logoMediaId: mediaId,
      rollWeight: 10,
    },
  });
}

/** Switches the seeded trigger on, "Automático", every 5 minutes, on "Gatilhos", and saves. */
async function setTheSeededTriggerToAutoEveryFiveMinutes(page: Page): Promise<void> {
  await page.goto(`${ownServerAddress}/#/eventos`);
  await page.getByRole('button', { name: 'Gatilhos' }).click();
  await page.getByRole('button', { name: `Editar ${seededTriggerName}` }).click();
  await page.getByRole('switch', { name: 'Gatilho ligado' }).click();
  await page.getByRole('combobox', { name: 'Modo', exact: true }).click();
  await page.getByRole('option', { name: 'Automático', exact: true }).click();
  await page.getByLabel('A cada (minutos, de 5 a 240)').fill('5');
  await page.getByRole('button', { name: 'Salvar gatilho' }).click();
}

test('the seeded trigger on auto every 5 minutes puts the plain roll on air, and the roll leaves after its pass', async ({
  page,
  context,
}) => {
  test.setTimeout(longestThisTestMayTakeInMilliseconds);
  const fakeNtpServer = await startFakeNtpServerOfATest();
  let ownServer: OwnServer | undefined;
  try {
    // Arrange: the own server on a new database, its clock on the test's NTP server; Bosch
    // in Cadastros; OBS showing the program output; the operator switches the seeded
    // trigger on, on auto every 5 minutes.
    // A new database each time, in the folder playwright.config.ts empties before a run: a
    // repeat on the last one would find the trigger already on, and the click turn it off.
    const runName = `plainSponsorRollEveryFiveMinutes-${String(Date.now())}`;
    ownServer = await startOwnServer({
      port: ownServerPort,
      databasePath: `apps/control/e2e-data/${runName}.sqlite`,
      dataFolder: `apps/control/e2e-data/${runName}`,
      moreVariables: { BAJAOVRLAY_NTP_SERVERS: fakeNtpServer.address },
    });
    await saveBoschWithItsLogo();
    const obsPage = await context.newPage();
    await obsPage.goto(`${ownServerAddress}/render/`);
    await expect(
      obsPage.locator('[data-layer-id="bug"]'),
      'OBS draws the bug layer',
    ).toBeAttached();
    await setTheSeededTriggerToAutoEveryFiveMinutes(page);
    await expect
      .poll(
        async () =>
          (await readStateOfTheOwnServer()).triggers.find(
            (trigger) => trigger.id === seededTriggerId,
          )?.isEnabled,
        { message: 'the trigger must be saved switched on' },
      )
      .toBe(true);
    const seededTrigger = (await readStateOfTheOwnServer()).triggers.find(
      (trigger) => trigger.id === seededTriggerId,
    );
    const switchedOnAtMs = seededTrigger?.intervalCountedFromMs ?? Date.now();

    // Act: real time moves to 4 s before the 5 minutes are up, and the producer presses
    // "Acertar relógio agora", which steps the server clock to it.
    fakeNtpServer.setRealTimeAheadOfTheMachineBy(switchedOnAtMs + 5 * 60_000 - 4_000 - Date.now());
    const stepResponse = await fetch(`${ownServerAddress}/api/v1/server-clock/set-now`, {
      method: 'POST',
    });

    // Assert: the step taken; the roll on air with its pass as auto-out, drawn on the program
    // output with Bosch under "PATROCÍNIO DIAMANTE"; then gone after its pass, not before 8 s.
    expect(stepResponse.status, '"Acertar relógio agora" must step the server clock').toBe(200);
    await expect
      .poll(async () => (await findThePlainRollOnAir())?.autoOutAfterMs, {
        message: 'the trigger must put the roll on air by itself, its pass as its auto-out',
        timeout: waitForTheFiringInMilliseconds,
      })
      .toBe(passOfOneDiamanteSponsorMs);
    const seenOnAirAtMs = Date.now();
    await expect(
      obsPage
        .locator('[data-layer-id="bug"] > baja-graphic-sponsor-roll-plain')
        .getByTestId('sponsor-roll-plain-heading'),
      'the program output must draw Bosch’s level',
    ).toHaveText('PATROCÍNIO DIAMANTE', { timeout: waitForTheFiringInMilliseconds });
    await expect
      .poll(async () => findThePlainRollOnAir(), {
        message: 'the roll must leave when its pass ends',
        timeout: passOfOneDiamanteSponsorMs + waitForTheFiringInMilliseconds,
      })
      .toBeUndefined();
    expect(
      Date.now() - seenOnAirAtMs,
      'the roll must stay for its pass, not leave at once',
    ).toBeGreaterThanOrEqual(8000 - 1000);
  } finally {
    if (ownServer !== undefined) {
      await stopOwnServer(ownServer);
    }
    fakeNtpServer.stop();
  }
});
