/**
 * A refused take is shown once, where it was sent from (apps/control)
 *
 * What this module is for:
 *   Four parts of the page send `takeItem`: the rundown column, the quick-fire strip, a
 *   Camadas row's "Disparar" and the item editor's "Salvar e disparar". Until BAJAOVRLAY-69
 *   the page could not tell which one sent a refused take, so the rundown column and the
 *   strip both showed it. A take refused because another console had just taken on the layer
 *   must be read once, beside the button the operator pressed: each part's takes now say
 *   which part sent them, and each part shows its own (gate 2 of PR #64 for the last two).
 *
 * What these tests prove (the whole page drawn, a fake server driven by hand):
 *   - A quick-fire key's take, refused, is shown in the quick-fire strip only.
 *   - A rundown row's "Disparar", refused, is shown in the rundown column only.
 *   - A Camadas row's "Disparar", refused, is shown in Camadas only.
 *   - The item editor's "Salvar e disparar", refused, is shown in the editor only.
 *
 * What these tests deliberately do not cover:
 *   - The refusal's words: the server writes them (apps/server's
 *     consoles/unseenChangeByAnotherConsole.test.ts).
 *   - The same race between two real consoles: e2e/chaos/twoTakesOnOneLayer.chaos.ts.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/App';
import { buildSlicesWithTheRaceClockAndTheLowerThird } from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import {
  buildInterviewItemSavedAfterTheTake,
  buildInterviewLowerThirdAsTaken,
} from '@/features/layers/itemAheadOfTheAirOnCamadas.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithShortcutsAndMacros } from '@/state/quickFireLikeTheServerSends.testSupport';

/** What the server answers a take another console had just beaten, on "Relógio". */
const refusalForAnotherConsole = {
  code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE' as const,
  message:
    'Outra mesa (Produtor) tomou "Bandeira vermelha" na camada "Relógio" há 0,4 s; ' +
    'sua tomada de "Logo Baja" não foi feita.',
};

/** Every alert on the page that carries the refusal's sentence. */
function findAlertsWithTheRefusal(): HTMLElement[] {
  return screen
    .queryAllByRole('alert')
    .filter((alert) => alert.textContent?.includes('não foi feita') === true);
}

describe('a take refused for another console', () => {
  it('is shown in the quick-fire strip only, when a quick-fire key sent it', async () => {
    // Arrange: the whole page, "Atalhos" shown, the endurance rundown in its column.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <App />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: press 1 ("Logo Baja"); the server refuses it.
    fireEvent.keyDown(document.body, { key: '1' });
    fakeServer.refuseLastCommand(refusalForAnotherConsole);
    await screen.findAllByText(/não foi feita/);

    // Assert: one alert, in the strip.
    const alerts = findAlertsWithTheRefusal();
    expect(alerts, 'the refusal must be shown once').toHaveLength(1);
    expect(
      within(screen.getByRole('region', { name: 'Atalhos e macros' })).getByRole('alert'),
      'the refusal must be in the quick-fire strip, where the key belongs',
    ).toHaveTextContent(refusalForAnotherConsole.message);
  });

  it('is shown in the rundown column only, when a row\'s "Disparar" sent it', async () => {
    // Arrange: the whole page, the endurance rundown in its column.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <App />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: press "Disparar" on "Bandeira amarela"; the server refuses it.
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));
    fireEvent.click(yellowFlagRow.getByRole('button', { name: 'Disparar' }));
    fakeServer.refuseLastCommand(refusalForAnotherConsole);
    await screen.findAllByText(/não foi feita/);

    // Assert: one alert, not in the strip.
    const alerts = findAlertsWithTheRefusal();
    expect(alerts, 'the refusal must be shown once').toHaveLength(1);
    expect(
      within(screen.getByRole('region', { name: 'Atalhos e macros' })).queryByRole('alert'),
      'the quick-fire strip must not show a refusal of the rundown column',
    ).toBeNull();
  });

  it('is shown in Camadas only, when a Camadas row\'s "Disparar" sent it', async () => {
    // Arrange: the whole page; the interview lower third on air on "Tarja", its item saved
    // with a new name since, so its Camadas row offers "Disparar".
    const slicesWithShortcuts = buildSlicesWithShortcutsAndMacros();
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<App />, {
      ...slicesWithShortcuts,
      graphics: buildSlicesWithTheRaceClockAndTheLowerThird().graphics,
      items: [...slicesWithShortcuts.items, buildInterviewItemSavedAfterTheTake()],
      instances: [buildInterviewLowerThirdAsTaken('program')],
    });

    // Act: press "Disparar" on the "Tarja" row of Camadas; the server refuses it.
    const camadas = within(screen.getByRole('region', { name: 'Camadas' }));
    const lowerThirdRow = within(camadas.getByRole('listitem', { name: 'Tarja' }));
    fireEvent.click(lowerThirdRow.getByRole('button', { name: 'Disparar' }));
    fakeServer.refuseLastCommand(refusalForAnotherConsole);
    await screen.findAllByText(/não foi feita/);

    // Assert: one alert, in Camadas.
    expect(findAlertsWithTheRefusal(), 'the refusal must be shown once').toHaveLength(1);
    expect(
      camadas.getByRole('alert'),
      'the refusal must be in Camadas, where its "Disparar" is',
    ).toHaveTextContent(refusalForAnotherConsole.message);
  });

  it('is shown in the item editor only, when its "Salvar e disparar" sent it', async () => {
    // Arrange: the whole page, the yellow flag open in the item editor.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <App />,
      buildSlicesWithShortcutsAndMacros(),
    );
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));
    fireEvent.click(yellowFlagRow.getByRole('button', { name: 'Editar item' }));
    const itemEditor = within(await screen.findByRole('region', { name: 'Editor de item' }));

    // Act: press "Salvar e disparar". The editor saves first (the clock's moment is left to
    // the take), the server accepts the save; then it takes, and the server refuses the take.
    fireEvent.click(itemEditor.getByRole('button', { name: 'Salvar e disparar' }));
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the editor must save first').toHaveLength(1);
    });
    fakeServer.acceptLastCommand();
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived().at(-1),
        'the editor must take once the save was accepted',
      ).toEqual(expect.objectContaining({ type: 'takeItem', itemId: 'item-bandeira-amarela' }));
    });
    fakeServer.refuseLastCommand(refusalForAnotherConsole);
    await screen.findAllByText(/não foi feita/);

    // Assert: one alert, in the editor.
    expect(findAlertsWithTheRefusal(), 'the refusal must be shown once').toHaveLength(1);
    expect(
      itemEditor.getByRole('alert'),
      'the refusal must be in the item editor, where its button is',
    ).toHaveTextContent(refusalForAnotherConsole.message);
  });
});
