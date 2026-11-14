/**
 * Chaos: two takes on one layer at once (apps/control, Playwright)
 *
 * What this module is for:
 *   Two consoles take different items on the same layer at the same moment: the race
 *   twoOperators.chaos.ts makes exact with a connection proxy (the second console does not
 *   hear the server's news, so it takes on the air as it last saw it). The promise: one take
 *   wins, the air shows it with one entrance, and the console whose take lost is told why.
 *   Since BAJAOVRLAY-69 every take of a console carries what it showed on the layer, and the
 *   server refuses it when another console changed that layer less than 2 s before, unseen.
 *
 * What these tests prove:
 *   - The take that came first stays on air, with one entrance on the layer.
 *   - The losing console shows a refusal naming its own item, the layer and the item that
 *     won, and saying its take was not applied, once, where the key that sent it lives.
 *
 * What these tests deliberately do not cover:
 *   - Macros, triggers and the command API taking on a layer an operator just took: -69
 *     leaves those unguarded.
 *   - Each case of the 2 s rule (one console pressing twice, after 2 s, a page that had seen
 *     the other take): apps/server's consoles/unseenChangeByAnotherConsole.test.ts.
 */
import { startConnectionProxy } from './faults/connectionProxy';
import { chaosServerPort, secondConsoleProxyPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import {
  fireTheFirstButtonWithKeyOne,
  openTheConsoleAt,
  openTheProgramOutputAt,
} from './steps/pagesOfTheShow';
import { makeLowerThirdButton, readInstanceOnProgram } from './steps/showOnTheChaosServer';
import { countEntrancesOnLayer } from './steps/whatTheAirShowed';

test.describe('two operators at once, on one layer', () => {
  test('both consoles take on the same layer at once: one take wins, and the other console says why', async ({
    context,
    startChaosServer,
  }) => {
    const secondConsoleProxy = await startConnectionProxy(secondConsoleProxyPort, chaosServerPort);
    try {
      // Arrange: two "Tarja" buttons (1: the captain, 2: the team chief); the output; two
      // consoles with nothing on air.
      const server = await startChaosServer('twoTakesOnOneLayer', chaosServerPort);
      const captainItemId = await makeLowerThirdButton(
        server.port,
        'Tarja — capitã da UFPR',
        'Ana Souza',
      );
      await makeLowerThirdButton(server.port, 'Tarja — chefe da UFSC', 'Bruno Lima');
      const output = await openTheProgramOutputAt(context, server.address);
      const firstConsole = await openTheConsoleAt(context, server.address);
      const secondConsole = await openTheConsoleAt(context, secondConsoleProxy.address);

      // Act: the second console stops hearing the server; the first takes the captain;
      // once she is on the server, the second takes the chief, on the air it last saw.
      secondConsoleProxy.holdWhatTheServerSends();
      await fireTheFirstButtonWithKeyOne(firstConsole);
      await expect
        .poll(async () => (await readInstanceOnProgram(chaosServerPort, 'lower-third'))?.itemId, {
          message: "the first console's take must reach the server",
        })
        .toBeDefined();
      await secondConsole.getByRole('heading', { name: 'BajaOvrLay' }).click();
      await secondConsole.keyboard.press('2');
      secondConsoleProxy.release();

      // Assert: the captain stays on air with one entrance, and the second console says
      // its take was refused because the layer had changed.
      // The refusal names the layer, the item that won it, and that this take was not
      // applied, so the operator knows what is on air without looking. Its words, from
      // apps/server's ptBRConsoles.ts: Outra mesa tomou "Tarja — capitã da UFPR" na camada
      // "Tarja" há 0,3 s; sua tomada de "Tarja — chefe da UFSC" não foi feita.
      const refusalOfTheLosingTake = secondConsole
        .getByRole('alert')
        .filter({ hasText: 'Tarja — chefe da UFSC' });
      await expect(
        refusalOfTheLosingTake,
        'the losing console must say its take of the chief was refused',
      ).toContainText(/não (foi|entrou)/);
      await expect(
        refusalOfTheLosingTake,
        'the refusal must name the layer whose air changed',
      ).toContainText('"Tarja"');
      await expect(
        refusalOfTheLosingTake,
        'the refusal must name the take that won the layer',
      ).toContainText('Tarja — capitã da UFPR');
      expect(
        (await readInstanceOnProgram(chaosServerPort, 'lower-third'))?.itemId,
        'the server must keep the captain, the take that came first',
      ).toBe(captainItemId);
      await expect(
        output.page.locator('[data-layer-id="lower-third"] > baja-graphic-lower-third'),
        'the take that won must stay on air',
      ).toContainText('Ana Souza');
      expect(
        countEntrancesOnLayer(output.logLines, 'lower-third'),
        'one take must win: one entrance on the layer, not two',
      ).toBe(1);
    } finally {
      await secondConsoleProxy.stop();
    }
  });
});
