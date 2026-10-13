/**
 * Rundown panel: the next item is previewed after a take (apps/control)
 *
 * What this module is for:
 *   João's ruling (gate 2 of BAJAOVRLAY-15): with the switch "Prévia automática" on, a
 *   take that moves the rundown's cursor on also previews the item the cursor arrives
 *   on. So the operator's loop is one key: Space puts an item on air and shows the next
 *   one in the "Prévia" monitor, Space sends that very preview to air and shows the one
 *   after it, and so on. Every item is seen before it airs.
 *
 *   The switch lives in this browser, so the server cannot do it: the page that sent the
 *   take sends the preview, after the server accepted the take, with origin `auto` (the
 *   server then throws away any older automatic preview). A take sent by another
 *   operator previews nothing from this page.
 *
 * What these tests prove:
 *   - Space, Space airs two items in a row with each one previewed in between: the page
 *     sends takeNext, previewItem (auto) for the new cursor item, takePreview for that
 *     preview, previewItem (auto) for the item after it.
 *   - The preview is sent only after the server accepted the take.
 *   - A row's "Disparar" previews the new cursor item when that row was the cursor row,
 *     and previews nothing when it was another row (the cursor did not move).
 *   - Nothing is previewed after a take when the switch is off, when the take was
 *     refused, or when the take was of the last item (the cursor is on nothing).
 *
 * What these tests deliberately do not cover:
 *   - The rule itself, row by row: itemToPreviewAfterTake.test.ts.
 *   - What the server discards for origin `auto`: apps/server's previewItemOrigin.test.ts.
 *   - A cursor moved by another operator, and the arrows: RundownPanelPreview.test.tsx.
 *   - "Tomar" under the "Prévia" monitor, which previews nothing afterwards (it is not a
 *     key of the loop; docs/decisions.md, PR #12 gate 2).
 *   - The real server and the real monitors: e2e/previewKeyboardLoop.e2e.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type ControlPageOnFakeServer,
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildRaceClockPreviewOfItem } from '@/state/previewLikeTheServerSends.testSupport';
import {
  buildMainRundown,
  buildSlicesWithTheEnduranceRundown,
} from '@/state/rundownLikeTheServerSends.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

// Saturday of the endurance race, the minute of the start.
const momentOfTheTake = '2026-10-10T13:00:00.000Z';

const takeNextOfTheMainRundown = { type: 'takeNext', rundownId: 'sessao-principal' };
const previewTheYellowFlagAutomatically = {
  type: 'previewItem',
  itemId: 'item-bandeira-amarela',
  origin: 'auto',
};
const previewTheFinishAutomatically = {
  type: 'previewItem',
  itemId: 'item-chegada-do-enduro',
  origin: 'auto',
};

type FakeServer = ControlPageOnFakeServer['fakeServer'];

/** The race clock on the program output, taken from the rundown item with this id. */
function buildItemOnProgram(itemId: string): Instance {
  return { ...buildRaceClockInstanceOnTheClockLayer(momentOfTheTake), itemId };
}

/** The race clock on the preview output, put there by "Prévia automática" for this item. */
function buildItemInAutoPreview(itemId: string): Instance {
  return { ...buildRaceClockPreviewOfItem(itemId, momentOfTheTake), previewOrigin: 'auto' };
}

/**
 * Plays the server accepting the newest command the way the real one does: first the
 * news (the instances and where the cursor is now), then the "ok" to the command.
 */
function acceptLastCommandWithThisNews(
  fakeServer: FakeServer,
  news: { instances: Instance[]; cursorItemId: string | null },
): void {
  fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: news.instances });
  fakeServer.sendMessage({
    type: 'slice',
    name: 'rundowns',
    slice: [buildMainRundown(news.cursorItemId)],
  });
  fakeServer.acceptLastCommand();
}

/** Draws the rundown panel with the three endurance items and the cursor where the test says. */
function renderRundownPanelWithTheCursorOn(cursorItemId: string | null): ControlPageOnFakeServer {
  return renderOnControlPageConnectedToFakeServer(
    <RundownPanel />,
    buildSlicesWithTheEnduranceRundown(cursorItemId),
  );
}

describe('Space, Space with "Prévia automática" on', () => {
  it('airs two items in a row, each one previewed before it goes on air', async () => {
    // Arrange: the cursor on the start, nothing on air, nothing previewed, the switch on.
    const { fakeServer } = renderRundownPanelWithTheCursorOn('item-largada-do-enduro');

    // Act, first Space: the start goes on air and the cursor moves on to the yellow
    // flag; the page then previews the yellow flag, and the server shows it in preview.
    fireEvent.keyDown(document.body, { key: ' ' });
    const commandsBeforeTheServerAcceptedTheTake = [...fakeServer.listCommandsReceived()];
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildItemOnProgram('item-largada-do-enduro')],
      cursorItemId: 'item-bandeira-amarela',
    });
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        'once the take is accepted the page must preview the item the cursor moved on to',
      ).toEqual([takeNextOfTheMainRundown, previewTheYellowFlagAutomatically]);
    });
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [
        buildItemOnProgram('item-largada-do-enduro'),
        buildItemInAutoPreview('item-bandeira-amarela'),
      ],
      cursorItemId: 'item-bandeira-amarela',
    });

    // Act, second Space: the yellow flag's preview goes on air and the cursor moves on
    // to the finish; the page then previews the finish.
    fireEvent.keyDown(document.body, { key: ' ' });
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildItemOnProgram('item-bandeira-amarela')],
      cursorItemId: 'item-chegada-do-enduro',
    });

    // Assert: the preview waited for the server's "ok" to the take; and the four
    // commands of the loop were sent in order: take, preview the next, take that very
    // preview, preview the one after it.
    expect(
      commandsBeforeTheServerAcceptedTheTake,
      'until the server accepts the take, only the take may have been sent',
    ).toEqual([takeNextOfTheMainRundown]);
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        'Space, Space must take, preview the next item, take that preview, preview the next',
      ).toEqual([
        takeNextOfTheMainRundown,
        previewTheYellowFlagAutomatically,
        { type: 'takePreview', layerId: 'clock' },
        previewTheFinishAutomatically,
      ]);
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });
});

describe('a take that must not be followed by a preview', () => {
  it('previews nothing after Space while "Prévia automática" is off', async () => {
    // Arrange: the cursor on the start, and the switch clicked off.
    const { fakeServer } = renderRundownPanelWithTheCursorOn('item-largada-do-enduro');
    fireEvent.click(screen.getByRole('switch', { name: 'Prévia automática' }));

    // Act: press Space; the server accepts and moves the cursor on to the yellow flag.
    fireEvent.keyDown(document.body, { key: ' ' });
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildItemOnProgram('item-largada-do-enduro')],
      cursorItemId: 'item-bandeira-amarela',
    });
    await letThePageFinishWhatItStarted();

    // Assert: the take is the only command.
    expect(
      fakeServer.listCommandsReceived(),
      'with "Prévia automática" off a take must not be followed by a preview',
    ).toEqual([takeNextOfTheMainRundown]);
  });

  it('previews nothing after the last item was taken, when the cursor is on nothing', async () => {
    // Arrange: the cursor on the finish, the last item of the rundown.
    const { fakeServer } = renderRundownPanelWithTheCursorOn('item-chegada-do-enduro');

    // Act: press Space; the server accepts and leaves the cursor on nothing.
    fireEvent.keyDown(document.body, { key: ' ' });
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildItemOnProgram('item-chegada-do-enduro')],
      cursorItemId: null,
    });
    await letThePageFinishWhatItStarted();

    // Assert: the take is the only command; there is no next item to look at.
    expect(
      fakeServer.listCommandsReceived(),
      'at the end of the rundown there is no item to preview after the take',
    ).toEqual([takeNextOfTheMainRundown]);
  });

  it('previews nothing when the server refuses the take', async () => {
    // Arrange: the cursor on the start, and Space was pressed.
    const { fakeServer } = renderRundownPanelWithTheCursorOn('item-largada-do-enduro');
    fireEvent.keyDown(document.body, { key: ' ' });

    // Act: the server refuses the take. Meanwhile another operator moved the cursor on
    // to the yellow flag, so the cursor did change while this page waited.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'rundowns',
      slice: [buildMainRundown('item-bandeira-amarela')],
    });
    fakeServer.refuseLastCommand({
      code: 'INVALID_GRAPHIC_DATA',
      message:
        'Dados inválidos para o gráfico "race-clock": o campo "sessionName" é obrigatório e não foi enviado.',
    });
    await letThePageFinishWhatItStarted();

    // Assert: no preview followed, although the cursor moved: nothing went on air.
    expect(
      fakeServer.listCommandsReceived(),
      'a refused take must never be followed by a preview',
    ).toEqual([takeNextOfTheMainRundown]);
  });
});

describe('the "Disparar" button of a rundown row with "Prévia automática" on', () => {
  it('previews the new cursor item when the row fired was the cursor row', async () => {
    // Arrange: the cursor on the start.
    const { fakeServer } = renderRundownPanelWithTheCursorOn('item-largada-do-enduro');
    const startRow = within(screen.getByRole('listitem', { name: 'Largada do enduro' }));

    // Act: press "Disparar" on the start; the server accepts and moves the cursor on.
    fireEvent.click(startRow.getByRole('button', { name: 'Disparar' }));
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildItemOnProgram('item-largada-do-enduro')],
      cursorItemId: 'item-bandeira-amarela',
    });

    // Assert: the take of that row, then the preview of the item the cursor moved on to.
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        'a "Disparar" that moved the cursor on must preview the new next item',
      ).toEqual([
        { type: 'takeItem', itemId: 'item-largada-do-enduro' },
        previewTheYellowFlagAutomatically,
      ]);
    });
    fakeServer.acceptLastCommand();
  });

  it('previews nothing when the row fired was not the cursor row', async () => {
    // Arrange: the cursor on the start.
    const { fakeServer } = renderRundownPanelWithTheCursorOn('item-largada-do-enduro');
    const finishRow = within(screen.getByRole('listitem', { name: 'Chegada do enduro' }));

    // Act: press "Disparar" on the finish, out of order; the server accepts and leaves
    // the cursor on the start, because the plan did not change.
    fireEvent.click(finishRow.getByRole('button', { name: 'Disparar' }));
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildItemOnProgram('item-chegada-do-enduro')],
      cursorItemId: 'item-largada-do-enduro',
    });
    await letThePageFinishWhatItStarted();

    // Assert: the take is the only command.
    expect(
      fakeServer.listCommandsReceived(),
      'a take that left the cursor where it was must not be followed by a preview',
    ).toEqual([{ type: 'takeItem', itemId: 'item-chegada-do-enduro' }]);
  });
});
