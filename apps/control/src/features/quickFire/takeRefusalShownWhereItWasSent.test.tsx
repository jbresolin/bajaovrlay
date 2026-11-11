/**
 * A refused take is shown once, where it was sent from (apps/control)
 *
 * What this module is for:
 *   The rundown column and the quick-fire strip both send `takeItem`, and each shows the
 *   refusals of its own buttons. Until BAJAOVRLAY-69 the page could not tell which one sent a
 *   refused take, so both showed it. A take refused because another console had just taken
 *   on the layer must be read once, where the operator pressed: each part's takes now say
 *   which part sent them.
 *
 * What these tests prove (the whole page drawn, a fake server driven by hand):
 *   - A quick-fire key's take, refused, is shown in the quick-fire strip and not in the
 *     rundown column.
 *   - A rundown row's "Disparar", refused, is shown in the rundown column and not in the
 *     quick-fire strip.
 *
 * What these tests deliberately do not cover:
 *   - The refusal's words: the server writes them (apps/server's
 *     consoles/unseenChangeByAnotherConsole.test.ts).
 *   - The same race between two real consoles: e2e/chaos/twoTakesOnOneLayer.chaos.ts.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/App';
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
});
