// Test support: draws the item editor panel wired as in the browser but talking to a
// fake server, and presses its buttons the way an operator does. The panel test files
// use it so they all start from the same page. Nothing here keeps state between calls.
import type { Instance, Item, ItemHome, Slices } from '@bajaovrlay/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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
 * draws the editor for a new item of the main session's rundown, with no graphic chosen
 * yet (renderItemEditorPanelForNewRaceClockItem chooses the race clock as well).
 */
export function renderItemEditorPanelOnFakeServer(
  itemBeingEdited: Item | null,
): ItemEditorOnFakeServer {
  return renderItemEditorPanelOnFakeServerWithSlices(
    itemBeingEdited,
    buildSlicesWithTheRaceClockAndTheLowerThird(),
  );
}

/** The race clock, as the "Gráfico" dropdown of the editor names it (its manifest's name). */
export const raceClockGraphicName = 'Relógio de prova';

/**
 * Chooses the graphic of a new item in the editor's "Gráfico" dropdown, by the name the
 * operator reads there. A new item opens with no graphic chosen (never the first one the
 * server lists), so every test that needs a graphic's fields names the graphic here, as
 * the browser tests do (e2e/previewTestSteps.ts).
 */
export function chooseGraphicInTheEditor(graphicName: string): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Gráfico' }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: graphicName }));
}

/**
 * Draws the editor for a new item of the main session's rundown, as
 * renderItemEditorPanelOnFakeServer does, and chooses the race clock by name, so the
 * clock's fields are on screen at their manifest defaults.
 */
export function renderItemEditorPanelForNewRaceClockItem(): ItemEditorOnFakeServer {
  const editorOnFakeServer = renderItemEditorPanelOnFakeServer(null);
  chooseGraphicInTheEditor(raceClockGraphicName);
  return editorOnFakeServer;
}

/**
 * Draws the item editor on a connected page holding exactly these slices, for tests that
 * need something on air or another list of graphics. A new item goes to `homeForNewItem`
 * unless the operator picks another place; left out, the main session's rundown.
 */
export function renderItemEditorPanelOnFakeServerWithSlices(
  itemBeingEdited: Item | null,
  slices: Slices,
  homeForNewItem: ItemHome = { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
): ItemEditorOnFakeServer {
  const onClose = vi.fn<() => void>();
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <ItemEditorPanel
      homeForNewItem={homeForNewItem}
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
    instances: [buildInstanceOnProgramTakenFromItem(itemOnAir)],
  });
}

/** The instance on the program output, on the item's own layer, made by taking the item. */
function buildInstanceOnProgramTakenFromItem(itemOnAir: Item): Instance {
  return buildInstanceTakenFromItem({
    id: idOfTheInstanceTakenFromTheItem,
    item: itemOnAir,
    layerId: itemOnAir.layerId,
    target: 'program',
    takenAt: momentTheItemWasTaken,
  });
}

/** The text of the stand-in button that hands the editor another item, in the test below. */
export const openAnotherItemButtonText = 'Abrir outro item no editor';

/**
 * Stands in for the rundown: the editor for one item, and a button that hands the editor
 * another item, as a click on another row of the rundown does. It never closes the editor.
 */
function ItemEditorWithAnotherItemToOpen(props: { itemOpenedFirst: Item; anotherItem: Item }) {
  const [itemBeingEdited, setItemBeingEdited] = useState(props.itemOpenedFirst);
  return (
    <div>
      <button type="button" onClick={() => setItemBeingEdited(props.anotherItem)}>
        {openAnotherItemButtonText}
      </button>
      <ItemEditorPanel
        homeForNewItem={{ kind: 'rundown', rundownId: idOfTheMainSessionRundown }}
        itemBeingEdited={itemBeingEdited}
        onClose={() => undefined}
      />
    </div>
  );
}

/**
 * Draws the item editor for a stored item that is on air, next to a button that opens
 * `anotherItem` in the editor instead. The server's slices hold both items and the
 * instance made by taking the first one.
 */
export function renderItemEditorPanelForItemOnAirWithAnotherItemToOpen(
  itemOnAir: Item,
  anotherItem: Item,
): ControlPageOnFakeServer['fakeServer'] {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <ItemEditorWithAnotherItemToOpen itemOpenedFirst={itemOnAir} anotherItem={anotherItem} />,
    {
      ...buildSlicesWithTheRaceClockAndTheLowerThird(),
      items: [itemOnAir, anotherItem],
      instances: [buildInstanceOnProgramTakenFromItem(itemOnAir)],
    },
  );
  return controlPage.fakeServer;
}

/** Lets every timer already due run, and React redraw what they changed. */
async function letOneTurnOfTheTimerQueuePass(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Waits until the page has finished everything the server's last answer set off. For a
 * test that must prove something did NOT happen after an answer, when nothing on screen
 * shows that the answer was dealt with (the editor that was waiting for it is gone).
 * The answer is handed to the page at once and what follows runs before any timer, so
 * one turn of the timer queue is enough.
 */
export async function waitForThePageToDealWithTheLastAnswer(): Promise<void> {
  await letOneTurnOfTheTimerQueuePass();
}

/**
 * Lets a dropdown that was just closed (a graphic chosen in "Gráfico") give the focus
 * back to its button, which it does on a timer a moment after closing. A test that
 * asserts where the focus went after a press must let that happen before the press, as
 * it does for a real operator; otherwise the dropdown's late refocus would undo the
 * press's and the test would fail for a reason that is not the editor's.
 */
export async function letTheClosedDropdownGiveFocusBack(): Promise<void> {
  await letOneTurnOfTheTimerQueuePass();
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
          homeForNewItem={{ kind: 'rundown', rundownId: idOfTheMainSessionRundown }}
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
