/**
 * The "Fontes de dados" page: picking which source's data is shown (apps/control)
 *
 * What this module is for:
 *   Beside the list, the page shows the data of one source: the first until the operator
 *   picks another. A source is picked by a click anywhere on its card, except on the
 *   card's own buttons, switch and links, which do their own job. Each card also has a
 *   "Ver" button, so a keyboard user can pick it with Tab and Enter.
 *
 * What these tests prove:
 *   - A click on the empty space of a card shows that source's data.
 *   - A click on a card's "Atualizar agora" polls the source and leaves the data shown
 *     as it was; so does a flip of its "Ligada" switch.
 *   - "Ver" is a button in the Tab order, it says which card is the one shown, and it
 *     picks its source.
 *
 * What these tests deliberately do not cover:
 *   - A real browser turning Enter on the focused "Ver" into a press, and a click on a
 *     greyed-out (disabled) control, which a real browser hands to the card under it.
 *     The test browser (jsdom) does neither, so here the proof is that "Ver" is a real
 *     button that takes the focus and the press is a click on it; Tab, Enter and the
 *     disabled click are in dataSourceCardPicking.e2e.ts, in a real browser.
 *   - What the shown data looks like: DataSourcesPageDetail.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildRehearsalReplayThatIsOk,
  buildSimulatorThatIsOk,
  buildSlicesWithDataSources,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesPage } from './DataSourcesPage';

/** Draws the page with the simulator (data at lap 34, shown first) and the rehearsal replay. */
function renderPageWithTheSimulatorAndTheRehearsalReplay() {
  return renderOnControlPageConnectedToFakeServer(
    <DataSourcesPage />,
    buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsOk(), buildRehearsalReplayThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    }),
  );
}

/** Finds the card of the rehearsal replay, "Ensaio de sexta", in the list. */
function findCardOfTheRehearsalReplay(): HTMLElement {
  const sourceList = screen.getByRole('list', { name: 'Fontes de dados' });
  return within(sourceList).getByRole('listitem', { name: 'Ensaio de sexta' });
}

describe('a click on a source card', () => {
  it("shows the source's data when the click lands on the card's empty space", () => {
    // Arrange: the simulator's data shown first, the replay beside it in the list.
    renderPageWithTheSimulatorAndTheRehearsalReplay();

    // Act: click the replay's card itself, away from any button.
    fireEvent.click(findCardOfTheRehearsalReplay());

    // Assert: the replay's data area is the one shown now.
    expect(
      screen.getByRole('region', { name: 'Dados de Ensaio de sexta' }),
      'a click anywhere on a card must show that source',
    ).toBeInTheDocument();
  });

  it('does not change the source shown when the click is on "Atualizar agora"', () => {
    // Arrange: the simulator's data shown first, the replay beside it in the list.
    const { fakeServer } = renderPageWithTheSimulatorAndTheRehearsalReplay();

    // Act: press "Atualizar agora" on the replay's card.
    fireEvent.click(
      within(findCardOfTheRehearsalReplay()).getByRole('button', { name: 'Atualizar agora' }),
    );

    // Assert: the replay was polled, and the simulator's data is still the one shown.
    expect(fakeServer.listCommandsReceived(), 'the button must still do its own job').toEqual([
      { type: 'pollDataSourceNow', sourceId: buildRehearsalReplayThatIsOk().id },
    ]);
    expect(
      screen.getByRole('region', { name: 'Dados de Simulador — Enduro' }),
      "a card's button must not pick the source as a side effect",
    ).toBeInTheDocument();
  });

  it('does not change the source shown when the click is on the "Ligada" switch', () => {
    // Arrange: the simulator's data shown first, the replay (on) beside it in the list.
    const { fakeServer } = renderPageWithTheSimulatorAndTheRehearsalReplay();

    // Act: flip the replay's switch, to turn it off.
    fireEvent.click(within(findCardOfTheRehearsalReplay()).getByRole('switch', { name: 'Ligada' }));

    // Assert: the server was asked to turn the replay off, and the simulator's data is
    // still the one shown.
    expect(fakeServer.listCommandsReceived(), 'the switch must still do its own job').toEqual([
      {
        type: 'setDataSourceEnabled',
        sourceId: buildRehearsalReplayThatIsOk().id,
        isEnabled: false,
      },
    ]);
    expect(
      screen.getByRole('region', { name: 'Dados de Simulador — Enduro' }),
      "a card's switch must not pick the source as a side effect",
    ).toBeInTheDocument();
  });
});

describe('"Ver" on a source card', () => {
  it('is a button that takes the focus, as Tab gives it', () => {
    // Arrange: the two sources in the list.
    renderPageWithTheSimulatorAndTheRehearsalReplay();
    const viewButton = within(findCardOfTheRehearsalReplay()).getByRole('button', { name: 'Ver' });

    // Act: give it the focus, as Tab would.
    viewButton.focus();

    // Assert: it holds the focus, and nothing has taken it out of the Tab order.
    expect(document.activeElement, '"Ver" must be able to hold the focus').toBe(viewButton);
    expect(viewButton.tabIndex, '"Ver" must be in the Tab order').toBe(0);
  });

  it('says which card is shown: the first one until another is picked', () => {
    // Arrange: the two sources in the list.
    renderPageWithTheSimulatorAndTheRehearsalReplay();

    // Act: nothing; look at the two "Ver" buttons.
    const viewButtons = within(screen.getByRole('list', { name: 'Fontes de dados' })).getAllByRole(
      'button',
      { name: 'Ver' },
    );

    // Assert: the simulator's is pressed, the replay's is not.
    expect(
      viewButtons.map((button) => button.getAttribute('aria-pressed')),
      'only the shown source has its "Ver" pressed',
    ).toEqual(['true', 'false']);
  });

  it("shows the source's data when pressed, as Enter on the focused button does", () => {
    // Arrange: the two sources in the list, the focus on the replay's "Ver".
    renderPageWithTheSimulatorAndTheRehearsalReplay();
    const viewButton = within(findCardOfTheRehearsalReplay()).getByRole('button', { name: 'Ver' });
    viewButton.focus();

    // Act: press it (a browser turns Enter on a focused button into this press).
    fireEvent.click(viewButton);

    // Assert: the replay's data area, saying it has no data yet, and "Ver" pressed.
    const replayData = within(screen.getByRole('region', { name: 'Dados de Ensaio de sexta' }));
    expect(
      replayData.getByText('Esta fonte ainda não tem dados.'),
      'the picked source has no data yet, and says so',
    ).toBeInTheDocument();
    expect(viewButton, '"Ver" must now say its card is the one shown').toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
