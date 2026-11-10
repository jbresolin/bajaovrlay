/**
 * Chaos: two operators at once (apps/control, Playwright)
 *
 * What this module is for:
 *   On event day two consoles run at once: the Produtor's and a second one at another desk,
 *   sometimes Dados preparing the next graphics. Two people pressing at the same moment
 *   must never make the air do something neither of them meant, and whoever loses a race
 *   must be told why. "At the same moment" is made exact with a connection proxy: the
 *   second console does not hear the server's news (its answers are held back), so it
 *   presses on the air as it last saw it, exactly as a press a few milliseconds behind the
 *   other console's does.
 *
 * What these tests prove:
 *   - "Próximo" pressed on two consoles at once moves the podium one step, not two, on the
 *     server and on air (built once, played for its take and one step); the console that
 *     lost says the step had already moved, and both show "Passo 2 de 4".
 *   - One operator fixes a lower third's name in the item editor while the other takes the
 *     item: the take goes on air with the old name, the save is accepted, and both consoles
 *     mark the Tarja row "item mudou" so either can update the air.
 *   - Produtor and Dados at once, on a server with the operator login: Dados edits an item
 *     at the moment the Produtor takes it; both are applied, the clock is on the output
 *     with one entrance, the event log names each by role and station, and Dados's
 *     "Disparar" stays greyed out.
 *
 * What these tests deliberately do not cover:
 *   - Two takes on one layer at once: twoTakesOnOneLayer.chaos.ts, quarantined under
 *     BAJAOVRLAY-69.
 *   - What Dados may and may not send, one command at a time: authorizeCommandsByRole.test.ts
 *     and loginRolesWalk.e2e.ts.
 *   - The HTTP shortcut "next-on-layer", which reads the step at arrival on purpose
 *     (docs/decisions.md): two presses there move two steps.
 */
import { type Browser, type Page } from '@playwright/test';

import { findItemEditorOwnTextField } from '../itemEditorOwnFields';
import {
  dataRolePinOfTheBrowserTests,
  producerPinOfTheBrowserTests,
} from '../loginServerOfTheBrowserTests';
import { createRaceClockItemInTheEditor } from '../previewTestSteps';
import { startConnectionProxy } from './faults/connectionProxy';
import { chaosServerPort, secondConsoleProxyPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import {
  findLayerRowInCamadas,
  openTheConsoleAt,
  openTheProgramOutputAt,
  waitUntilTheConsoleIsConnected,
} from './steps/pagesOfTheShow';
import {
  readInstanceOnProgram,
  seededRundownId,
  sendCommandOrFail,
} from './steps/showOnTheChaosServer';
import { countEntrancesOnLayer, countLifecycleCallsOfInstance } from './steps/whatTheAirShowed';

/** The podium's three teams, as the race's first three would be. */
const podiumTeams = [
  { position: 1, carNumber: 42, teamName: 'Carcará Baja', schoolName: 'UFPR' },
  { position: 2, carNumber: 7, teamName: 'Juriti Off-Road', schoolName: 'UFSC' },
  { position: 3, carNumber: 19, teamName: 'Mangue Baja', schoolName: 'UFPE' },
];

/** Makes a podium of the three teams on "Tela cheia" and takes it: four steps, at the first. */
async function takePodium(port: number): Promise<void> {
  const answer = await sendCommandOrFail(port, {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: seededRundownId },
    graphicId: 'podium',
    layerId: 'fullscreen',
    label: 'Pódio do Enduro',
    fields: {
      title: { kind: 'literal', value: 'Pódio do Enduro' },
      entries: { kind: 'literal', value: podiumTeams },
    },
  });
  await sendCommandOrFail(port, { type: 'takeItem', itemId: answer.createdItemId ?? '' });
}

/** The rundown's row of the item with this label. */
function findRundownRow(page: Page, itemLabel: string) {
  return page.getByRole('region', { name: 'Rundown' }).getByRole('listitem', { name: itemLabel });
}

/** Logs in on "#/entrar" as an operator does, and waits until the console is connected. */
async function openTheConsoleLoggedInAs(
  browser: Browser,
  address: string,
  login: { roleName: 'Produtor' | 'Dados'; pin: string; station: string },
): Promise<Page> {
  // A context of its own: each operator has their own session cookie, as on two laptops.
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${address}/`);
  await expect(page, 'a page without a session is on the login').toHaveURL(/#\/entrar$/);
  await page.getByRole('radio', { name: login.roleName }).check();
  await page.getByLabel('PIN').fill(login.pin);
  await page.getByLabel('Estação').fill(login.station);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await waitUntilTheConsoleIsConnected(page);
  return page;
}

test.describe('two operators at once', () => {
  test('"Próximo" pressed on two consoles at once moves the podium one step, and the late one says why', async ({
    context,
    startChaosServer,
  }) => {
    const secondConsoleProxy = await startConnectionProxy(secondConsoleProxyPort, chaosServerPort);
    try {
      // Arrange: the output; a podium taken, on air at its first step; two consoles, both
      // showing it there.
      const server = await startChaosServer('nextOnTwoConsoles', chaosServerPort);
      const output = await openTheProgramOutputAt(context, server.address);
      await takePodium(server.port);
      const firstConsole = await openTheConsoleAt(context, server.address);
      const secondConsole = await openTheConsoleAt(context, secondConsoleProxy.address);
      for (const consolePage of [firstConsole, secondConsole]) {
        await expect(
          findLayerRowInCamadas(consolePage, 'Tela cheia'),
          'each console must show the podium at its first step',
        ).toContainText('Passo 1 de 4');
      }

      // Act: the second console stops hearing the server; the first presses "Próximo",
      // and once the step moved, the second presses too, on the step it still shows.
      secondConsoleProxy.holdWhatTheServerSends();
      await findLayerRowInCamadas(firstConsole, 'Tela cheia')
        .getByRole('button', { name: 'Próximo' })
        .click();
      await expect
        .poll(
          async () => (await readInstanceOnProgram(chaosServerPort, 'fullscreen'))?.currentStep,
          {
            message: 'the first "Próximo" must move the podium',
          },
        )
        .toBe(1);
      await findLayerRowInCamadas(secondConsole, 'Tela cheia')
        .getByRole('button', { name: 'Próximo' })
        .click();
      secondConsoleProxy.release();

      // Assert: one step on the server and on air (the podium built once, played for its
      // take and one step, not two); the late console says the step had moved; both
      // consoles show the second step.
      await expect(
        secondConsole
          .getByRole('alert')
          .filter({ hasText: /já passou para o passo 2; o Próximo anterior já foi aplicado\./ }),
        'the late console must say its "Próximo" came after the step had moved',
      ).toBeVisible();
      expect(
        (await readInstanceOnProgram(chaosServerPort, 'fullscreen'))?.currentStep,
        'two presses at once must move the podium one step, not two',
      ).toBe(1);
      const podiumOnAir = await readInstanceOnProgram(chaosServerPort, 'fullscreen');
      const podiumId = podiumOnAir?.id ?? 'no podium on air';
      await expect
        .poll(() => countLifecycleCallsOfInstance(output.logLines, podiumId, 'playAction'), {
          message: 'the output must play the take and the step',
        })
        .toBeGreaterThanOrEqual(2);
      expect(
        countLifecycleCallsOfInstance(output.logLines, podiumId, 'playAction'),
        'the output must play the podium twice: its take and one step, not a second step',
      ).toBe(2);
      expect(
        countLifecycleCallsOfInstance(output.logLines, podiumId, 'load'),
        'the podium must be built once on the output: no second entrance',
      ).toBe(1);
      for (const consolePage of [firstConsole, secondConsole]) {
        await expect(
          findLayerRowInCamadas(consolePage, 'Tela cheia'),
          'each console must show the podium at its second step',
        ).toContainText('Passo 2 de 4');
      }
    } finally {
      await secondConsoleProxy.stop();
    }
  });

  test('a name fixed in the editor while the other operator takes the item: the take keeps the old name and both consoles say "item mudou"', async ({
    context,
    startChaosServer,
  }) => {
    // Arrange: a lower third in the rundown with a typo in the name; the output; two
    // consoles; the first opens the item and fixes the name, not yet saved.
    const server = await startChaosServer('editWhileTake', chaosServerPort);
    await sendCommandOrFail(server.port, {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: seededRundownId },
      graphicId: 'lower-third',
      layerId: 'lower-third',
      label: 'Tarja — capitã da UFPR',
      fields: {
        name: { kind: 'literal', value: 'Ana Sousa' },
        role: { kind: 'literal', value: 'Capitã da equipe 42, Baja UFPR' },
      },
    });
    const output = await openTheProgramOutputAt(context, server.address);
    const editingConsole = await openTheConsoleAt(context, server.address);
    const takingConsole = await openTheConsoleAt(context, server.address);
    await findRundownRow(editingConsole, 'Tarja — capitã da UFPR')
      .getByRole('button', { name: 'Editar item', exact: true })
      .click();
    const itemEditor = editingConsole.getByRole('region', { name: 'Editor de item' });
    await itemEditor.getByLabel('Nome', { exact: true }).fill('Ana Souza');

    // Act: the other operator takes the item; then the first saves the fixed name.
    await findRundownRow(takingConsole, 'Tarja — capitã da UFPR')
      .getByRole('button', { name: 'Disparar' })
      .click();
    await expect(
      output.page.locator('[data-layer-id="lower-third"] > baja-graphic-lower-third'),
      'the take must put the lower third on air',
    ).toContainText('Ana Sousa');
    await itemEditor.getByRole('button', { name: 'Salvar item' }).click();

    // Assert: the save was accepted, the air kept the name it was taken with, and both
    // consoles mark the row "item mudou".
    await expect(itemEditor, 'the editor must close once the save was accepted').toBeHidden();
    for (const consolePage of [editingConsole, takingConsole]) {
      await expect(
        findLayerRowInCamadas(consolePage, 'Tarja').getByText('item mudou'),
        'each console must say the item moved on after the take',
      ).toBeVisible();
    }
    await expect(
      output.page.getByTestId('lower-third-name'),
      'the air must keep the name the item was taken with until someone updates it',
    ).toHaveText('Ana Sousa');
  });

  test('Produtor takes an item at the moment Dados edits it: both are applied, each named in the log', async ({
    browser,
    startChaosServer,
  }) => {
    const consolesOfTheOperators: Page[] = [];
    try {
      // Arrange: a server with the operator login; Dados at "Mesa 2" makes a race clock
      // item; the Produtor at "Mesa 1" sees it; Dados opens it and changes its label.
      const server = await startChaosServer('producerAndDataRole', chaosServerPort, {
        BAJAOVRLAY_PIN_PRODUCER: producerPinOfTheBrowserTests,
        BAJAOVRLAY_PIN_DATA: dataRolePinOfTheBrowserTests,
      });
      const dataConsole = await openTheConsoleLoggedInAs(browser, server.address, {
        roleName: 'Dados',
        pin: dataRolePinOfTheBrowserTests,
        station: 'Mesa 2',
      });
      consolesOfTheOperators.push(dataConsole);
      const producerConsole = await openTheConsoleLoggedInAs(browser, server.address, {
        roleName: 'Produtor',
        pin: producerPinOfTheBrowserTests,
        station: 'Mesa 1',
      });
      consolesOfTheOperators.push(producerConsole);
      // The output OBS loads needs no login; a context of its own, closed with the others.
      const outputContext = await browser.newContext();
      const output = await openTheProgramOutputAt(outputContext, server.address);
      consolesOfTheOperators.push(output.page);
      await createRaceClockItemInTheEditor(
        dataConsole,
        'Largada do Enduro',
        'Enduro de Resistência',
      );
      await expect(
        findRundownRow(producerConsole, 'Largada do Enduro'),
        "the Produtor's console must list the item Dados made",
      ).toBeVisible();
      await findRundownRow(dataConsole, 'Largada do Enduro')
        .getByRole('button', { name: 'Editar item', exact: true })
        .click();
      const itemEditor = dataConsole.getByRole('region', { name: 'Editor de item' });
      await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill('Largada do Enduro 26BR');

      // Act: at the same moment, the Produtor presses "Disparar" and Dados "Salvar item".
      await Promise.all([
        findRundownRow(producerConsole, 'Largada do Enduro')
          .getByRole('button', { name: 'Disparar' })
          .click(),
        itemEditor.getByRole('button', { name: 'Salvar item' }).click(),
      ]);

      // Assert: the clock is on the output, with one entrance; the label is saved; both
      // were applied and logged with who did them; Dados's "Disparar" is still greyed out.
      await expect(
        output.page
          .locator('[data-layer-id="clock"] > baja-graphic-race-clock')
          .getByTestId('race-clock-session-name'),
        "the Produtor's take must be on the output",
      ).toHaveText('Enduro de Resistência');
      expect(
        countEntrancesOnLayer(output.logLines, 'clock'),
        'the take must play its entrance once on the output',
      ).toBe(1);
      await expect(itemEditor, "Dados's save must be accepted").toBeHidden();
      await expect(
        findLayerRowInCamadas(producerConsole, 'Relógio'),
        "the Produtor's take must put the item on air",
      ).toContainText('Largada do Enduro');
      await expect(
        findRundownRow(dataConsole, 'Largada do Enduro 26BR').getByRole('button', {
          name: 'Disparar',
        }),
        '"Disparar" stays greyed out for Dados',
      ).toBeDisabled();
      const stateResponse = await producerConsole.request.get(`${server.address}/api/v1/state`);
      const state = (await stateResponse.json()) as {
        eventLog: Array<{ actor: string; command: string; result: { status: string } }>;
      };
      const rowsOfTheItem = state.eventLog
        .filter((row) => ['updateItemFields', 'takeItem'].includes(row.command))
        .map((row) => `${row.actor} ${row.command} ${row.result.status}`)
        .sort();
      expect(rowsOfTheItem, 'the event log must name who did what, both applied').toEqual([
        'dados:Mesa 2 updateItemFields ok',
        'produtor:Mesa 1 takeItem ok',
      ]);
    } finally {
      for (const consolePage of consolesOfTheOperators) {
        await consolePage.context().close();
      }
    }
  });
});
