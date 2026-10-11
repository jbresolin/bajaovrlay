// Test support: draws the item editor panel wired as in the browser but talking to a
// fake server, and presses its buttons the way an operator does. The panel test files
// use it so they all start from the same page. Nothing here keeps state between calls.
import type { Item, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { expect, type Mock, vi } from 'vitest';

import {
  type ControlPageOnFakeServer,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';

import { ItemEditorPanel } from './ItemEditorPanel';
import {
  buildInstanceTakenFromItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
  idOfTheMainSessionRundown,
} from './itemsLikeTheEditorSaves.testSupport';

/** What a panel test gets back: the fake server and the record of "close" requests. */
export type ItemEditorOnFakeServer = {
  fakeServer: ControlPageOnFakeServer['fakeServer'];
  /** The page's store, for tests that need the page to remember an earlier failure. */
  serverStateStore: ControlPageOnFakeServer['serverStateStore'];
  /** Stands in for the rundown's "close the editor"; it records every call. */
  onClose: Mock<() => void>;
};

/**
 * Draws the item editor on a connected page that knows the race clock (with its real
 * manifest) and the interview lower third, with nothing on air. `itemBeingEdited` null
 * draws the editor for a new item of the main session's rundown.
 */
export function renderItemEditorPanelOnFakeServer(
  itemBeingEdited: Item | null,
): ItemEditorOnFakeServer {
  return renderItemEditorPanelOnFakeServerWithSlices(
    itemBeingEdited,
    buildSlicesWithTheRaceClockAndTheLowerThird(),
  );
}

/**
 * Draws the item editor on a connected page holding exactly these slices, for tests that
 * need something on air or another list of graphics.
 */
export function renderItemEditorPanelOnFakeServerWithSlices(
  itemBeingEdited: Item | null,
  slices: Slices,
): ItemEditorOnFakeServer {
  const onClose = vi.fn<() => void>();
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <ItemEditorPanel
      rundownId={idOfTheMainSessionRundown}
      itemBeingEdited={itemBeingEdited}
      onClose={onClose}
    />,
    slices,
  );
  return {
    fakeServer: controlPage.fakeServer,
    serverStateStore: controlPage.serverStateStore,
    onClose,
  };
}

/** The id of the instance the server made when the item of the test below was taken. */
export const idOfTheInstanceTakenFromTheItem = '3f8b6c1d-7e24-4a90-b5d3-1c9e0a7f2b48';

/** Saturday 10:00 in Brasília, when the item of the test below was taken. */
export const momentTheItemWasTaken = '2026-10-10T13:00:00.000Z';

/**
 * Draws the item editor for a stored item that is on air: the server's slices hold the
 * item and, on the program output on the item's own layer, the instance made by taking it.
 */
export function renderItemEditorPanelForItemOnAir(itemOnAir: Item): ItemEditorOnFakeServer {
  return renderItemEditorPanelOnFakeServerWithSlices(itemOnAir, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    items: [itemOnAir],
    instances: [
      buildInstanceTakenFromItem({
        id: idOfTheInstanceTakenFromTheItem,
        item: itemOnAir,
        layerId: itemOnAir.layerId,
        target: 'program',
        takenAt: momentTheItemWasTaken,
      }),
    ],
  });
}

/** The text of the stand-in button that opens the editor in the test below. */
export const openEditorButtonText = 'Abrir o editor de item';

/** Stands in for the rundown: nothing but a button that, once pressed, draws the editor. */
function ItemEditorBehindAButton() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setIsEditorOpen(true)}>
        {openEditorButtonText}
      </button>
      {isEditorOpen && (
        <ItemEditorPanel
          rundownId={idOfTheMainSessionRundown}
          itemBeingEdited={null}
          onClose={() => undefined}
        />
      )}
    </div>
  );
}

/**
 * Draws a connected page that already holds the server's graphics and layers, and only
 * then opens the editor for a new item, by a button press: the order things happen in
 * when the operator presses "+ Item". (renderItemEditorPanelOnFakeServer draws the
 * editor first and lets the server's hello arrive afterwards.) It is drawn inside
 * React's StrictMode, as src/main.tsx draws the real page.
 */
export function renderItemEditorPanelOpenedOnAPageThatAlreadyKnowsTheGraphics(): void {
  renderOnControlPageConnectedToFakeServer(
    <StrictMode>
      <ItemEditorBehindAButton />
    </StrictMode>,
    buildSlicesWithTheRaceClockAndTheLowerThird(),
  );
  fireEvent.click(screen.getByRole('button', { name: openEditorButtonText }));
}

/** Waits until the fake server holds that many commands. */
export async function waitForCommandsReceived(
  commandsExpectedByThen: number,
  fakeServer: ControlPageOnFakeServer['fakeServer'],
): Promise<void> {
  await waitFor(() => {
    expect(
      fakeServer.listCommandsReceived(),
      `the fake server must have received ${commandsExpectedByThen} command(s) by now`,
    ).toHaveLength(commandsExpectedByThen);
  });
}

/** Presses "Salvar item" and waits until the fake server holds that many commands. */
export async function pressSaveAndWaitForCommand(
  commandsExpectedByThen: number,
  fakeServer: ControlPageOnFakeServer['fakeServer'],
): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
  await waitForCommandsReceived(commandsExpectedByThen, fakeServer);
}

/** Presses "Atualizar no ar" and waits until the fake server holds that many commands. */
export async function pressUpdateOnAirAndWaitForCommand(
  commandsExpectedByThen: number,
  fakeServer: ControlPageOnFakeServer['fakeServer'],
): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar no ar' }));
  await waitForCommandsReceived(commandsExpectedByThen, fakeServer);
}
