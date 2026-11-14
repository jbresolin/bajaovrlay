/**
 * Rundown panel: the list and its buttons (apps/control)
 *
 * What this module is for:
 *   The left column of the control page is the rundown: the items an operator prepared
 *   for the session, in the order they will be fired, with a mark on the one that is
 *   next (the cursor). Each row says what the item is and has a button to fire it.
 *
 * What these tests prove:
 *   - The panel shows the rundown's name and one row per item, in the item's `order`,
 *     whatever order the server listed them in, and only the items of that rundown.
 *   - Each row shows the item's colour, its label, the graphic's name and the layer's.
 *   - Only the row at the cursor is marked as next; with no cursor, no row is; and the
 *     mark follows the server when a new cursor arrives.
 *   - "Disparar" sends `takeItem` with the id of its own row; the page changes nothing
 *     by itself and waits for the server's slices.
 *   - A refusal from the server is shown in the panel, in the server's pt-BR words.
 *   - An empty rundown, and a server with no rundown, each say so instead of a blank box.
 *   - Without a connection every button of the panel is disabled.
 *
 * What these tests deliberately do not cover:
 *   - Reordering by drag (RundownPanelReorder.test.tsx), the Space key
 *     (RundownPanelKeyboard.test.tsx), the arrow keys and the click on a label
 *     (RundownPanelCursor.test.tsx), "Excluir" and its two presses
 *     (RundownPanelDelete.test.tsx) and opening the item editor
 *     (RundownPanelItemEditor.test.tsx).
 *   - The real server: a fake one stands in; e2e/rundownTakeWithSpace.e2e.ts uses the real one.
 *   - Colours on screen: the test reads which colour NAME a row's chip carries; that the
 *     name maps to a design token is checked by eye in the browser.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildMainRundown,
  buildRaceClockItem,
  buildSlicesWithTheEnduranceRundown,
} from '@/state/rundownLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

/** Reads the item labels off the rows, top to bottom, as the operator sees them. */
function listItemLabelsInRowOrder(): (string | null)[] {
  return screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-label'));
}

/** Reads the labels of the rows that are marked as the next item (the cursor). */
function listItemLabelsMarkedAsNext(): (string | null)[] {
  return screen
    .getAllByRole('listitem')
    .filter((row) => row.getAttribute('aria-current') === 'true')
    .map((row) => row.getAttribute('aria-label'));
}

describe('the rundown panel', () => {
  it('shows the name of the rundown and its items in order', () => {
    // Arrange: the main rundown with the start, the yellow flag and the finish.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: the rundown is named and the three rows are in firing order.
    expect(
      screen.getByRole('heading', { name: 'Sessão principal' }),
      'the panel must say which rundown it shows',
    ).toBeInTheDocument();
    expect(listItemLabelsInRowOrder(), 'the rows must follow the order of the items').toEqual([
      'Largada do enduro',
      'Bandeira amarela',
      'Chegada do enduro',
    ]);
  });

  it("orders the rows by each item's order even when the server lists them shuffled", () => {
    // Arrange: the same rundown, but the items sent last one first.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    slices.items.reverse();

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: the rows are still start, yellow flag, finish.
    expect(
      listItemLabelsInRowOrder(),
      'the `order` of each item decides the row order, not the order of the list',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
  });

  it('lists only the items of the rundown it shows', () => {
    // Arrange: the main rundown, plus a podium item that belongs to an awards rundown.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    slices.rundowns.push({
      id: 'premiacao',
      name: 'Premiação',
      sessionLabel: 'Domingo à tarde',
      cursorItemId: null,
    });
    slices.items.push({
      ...buildRaceClockItem({
        id: 'item-podio-geral',
        order: 0,
        label: 'Pódio geral',
        color: 'highlight',
        flagState: 'finished',
      }),
      home: { kind: 'rundown', rundownId: 'premiacao' },
    });

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: the panel shows the first rundown the server sent, without the podium.
    expect(
      listItemLabelsInRowOrder(),
      "an item of another rundown must not appear among the main rundown's rows",
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
  });

  it('shows the colour, the graphic and the layer of each item on its row', () => {
    // Arrange: the main rundown; its yellow flag item is the race clock, on the clock
    // layer, marked with the "warning" colour.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: the yellow flag row carries all three.
    const yellowFlagRow = screen.getByRole('listitem', { name: 'Bandeira amarela' });
    expect(
      within(yellowFlagRow).getByText('Bandeira amarela'),
      'the row must show the label the operator gave the item',
    ).toBeInTheDocument();
    expect(
      within(yellowFlagRow).getByText('Relógio de prova'),
      'the row must show the name of the graphic the item uses',
    ).toBeInTheDocument();
    expect(
      within(yellowFlagRow).getByText('Relógio'),
      'the row must show the name of the layer the item goes on',
    ).toBeInTheDocument();
    expect(
      yellowFlagRow.querySelector('[data-item-color]')?.getAttribute('data-item-color'),
      'the colour chip of the row must carry the colour the item was given',
    ).toBe('warning');
  });

  it('falls back to the ids when the graphic or the layer is not known to the page', () => {
    // Arrange: the main rundown, but the server lists no graphic and no layer (a package
    // that was removed after the item was prepared).
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    slices.graphics = [];
    slices.layers = [];

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: the row is still there and names both by id.
    const startRow = within(screen.getByRole('listitem', { name: 'Largada do enduro' }));
    expect(
      startRow.getByText('race-clock'),
      'an item whose graphic has no known name must still be listed, by the graphic id',
    ).toBeInTheDocument();
    expect(
      startRow.getByText('clock'),
      'an item whose layer has no known name must still be listed, by the layer id',
    ).toBeInTheDocument();
  });
});

describe('the cursor of the rundown', () => {
  it('marks only the row at the cursor as the next item', () => {
    // Arrange: the main rundown with its cursor on the yellow flag.
    const slices = buildSlicesWithTheEnduranceRundown('item-bandeira-amarela');

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: the yellow flag row, and only it, is marked and says "Próximo".
    expect(
      listItemLabelsMarkedAsNext(),
      'exactly the row at the cursor must be marked as the current one',
    ).toEqual(['Bandeira amarela']);
    expect(
      within(screen.getByRole('listitem', { name: 'Bandeira amarela' })).getByText('Próximo'),
      'the row at the cursor must say "Próximo" in words, not by colour alone',
    ).toBeInTheDocument();
    expect(screen.getAllByText('Próximo'), 'no other row may say "Próximo"').toHaveLength(1);
  });

  it('marks no row when the rundown has no cursor', () => {
    // Arrange: the main rundown after its last item was fired: nothing is next.
    const slices = buildSlicesWithTheEnduranceRundown(null);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: no row is marked.
    expect(
      listItemLabelsMarkedAsNext(),
      'with no cursor, no row may be marked as the next item',
    ).toEqual([]);
  });

  it('moves the mark when the server sends a new cursor', () => {
    // Arrange: the panel with the cursor on the start.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Act: the server reports the cursor on the yellow flag, as it does after a take.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'rundowns',
      slice: [buildMainRundown('item-bandeira-amarela')],
    });

    // Assert: the mark is on the yellow flag now.
    expect(listItemLabelsMarkedAsNext(), 'the mark must follow the cursor the server sent').toEqual(
      ['Bandeira amarela'],
    );
  });
});

describe('the buttons of a rundown row', () => {
  const rowButtonScenarios = [
    // The row at the cursor: the everyday take. Nothing is on air, so it says the page
    // showed the clock layer empty (BAJAOVRLAY-69).
    {
      name: '"Disparar" on the first row sends takeItem for that item',
      itemLabel: 'Largada do enduro',
      buttonName: 'Disparar',
      expectedCommand: {
        type: 'takeItem',
        itemId: 'item-largada-do-enduro',
        instanceIdSeenOnAir: null,
      },
    },
    // A row that is NOT at the cursor: any item can be fired out of order, and the
    // button must carry the id of its own row, not the cursor's.
    {
      name: '"Disparar" on the last row sends takeItem for that item',
      itemLabel: 'Chegada do enduro',
      buttonName: 'Disparar',
      expectedCommand: {
        type: 'takeItem',
        itemId: 'item-chegada-do-enduro',
        instanceIdSeenOnAir: null,
      },
    },
  ];

  it.each(rowButtonScenarios)('$name', ({ itemLabel, buttonName, expectedCommand }) => {
    // Arrange: the panel with the three endurance items, cursor on the start.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Act: press the button on that item's row.
    const row = within(screen.getByRole('listitem', { name: itemLabel }));
    fireEvent.click(row.getByRole('button', { name: buttonName }));

    // Assert: the server received that one command, and the page changed nothing itself.
    expect(
      fakeServer.listCommandsReceived(),
      `"${buttonName}" on "${itemLabel}" must send exactly one command naming that item`,
    ).toEqual([expectedCommand]);
    expect(
      listItemLabelsInRowOrder(),
      'the rows must stay as the server last sent them until a new slice arrives',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it("shows the server's pt-BR message in the panel when a take is refused", async () => {
    // Arrange: the panel, with "Disparar" pressed on the start.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);
    const startRow = within(screen.getByRole('listitem', { name: 'Largada do enduro' }));
    fireEvent.click(startRow.getByRole('button', { name: 'Disparar' }));

    // Act: the server answers that the item no longer exists (another operator deleted it).
    fakeServer.refuseLastCommand({
      code: 'ITEM_NOT_FOUND',
      message: 'Este item não existe mais no rundown.',
    });

    // Assert: the message appears in the panel, in the server's own words.
    expect(
      await screen.findByRole('alert'),
      'a refused take must be explained where the operator pressed the button',
    ).toHaveTextContent('Este item não existe mais no rundown.');
  });

  it('disables every button of the panel while the connection is down', () => {
    // Arrange: the panel with the three endurance items.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Act: the line drops.
    fakeServer.dropConnection();

    // Assert: nothing can be pressed, and the last known rundown stays readable.
    for (const button of screen.getAllByRole('button')) {
      expect(
        button,
        `the button "${button.textContent}" must not be pressable without a connection`,
      ).toBeDisabled();
    }
    expect(
      listItemLabelsInRowOrder(),
      'the last known rundown must stay on screen while the connection is down',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
  });
});

describe('a rundown with nothing to list', () => {
  it('says the rundown has no items yet and still offers "+ Item"', () => {
    // Arrange: a server right after its first boot: the seeded rundown, no items.
    const slices = buildSlicesWithNothingOnAir();

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: a sentence instead of an empty box, and the way to add the first item.
    expect(
      screen.getByText('Nenhum item neste rundown. Use "+ Item" para preparar o primeiro.'),
      'an empty rundown must say so and point at the button that fills it',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ Item' }),
      'an empty rundown must offer the button that adds an item',
    ).toBeInTheDocument();
  });

  it('says so when the server has no rundown at all, and offers no "+ Item"', () => {
    // Arrange: a server that sent no rundown (it should always have one; if it ever does
    // not, the page must explain rather than offer a button that cannot work).
    const slices = buildSlicesWithNothingOnAir();
    slices.rundowns = [];

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: the explanation is shown and there is no way to add an item to nowhere.
    expect(
      screen.getByText('O servidor não enviou nenhum rundown.'),
      'a missing rundown must be explained in pt-BR',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '+ Item' }),
      'without a rundown there is nowhere to add an item, so the button must not be offered',
    ).toBeNull();
  });
});
