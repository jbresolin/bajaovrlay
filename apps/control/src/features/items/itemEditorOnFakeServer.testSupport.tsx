// Test support: draws the item editor panel wired as in the browser but talking to a
// fake server, and presses "Salvar item" the way an operator does. The three panel test
// files use it so they all start from the same page. Nothing here keeps state between
// calls.
import type { Item, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { expect, type Mock, vi } from 'vitest';

import {
  type ControlPageOnFakeServer,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { ItemEditorPanel } from './ItemEditorPanel';
import {
  buildDriverLowerThirdGraphic,
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
 * What the server sends after boot, plus a second graphic the editor has no form for
 * (the driver lower third), so the graphic dropdown has two choices.
 */
export function buildSlicesWithTheRaceClockAndTheDriverLowerThird(): Slices {
  const slicesAfterBoot = buildSlicesWithNothingOnAir();
  return {
    ...slicesAfterBoot,
    graphics: [...slicesAfterBoot.graphics, buildDriverLowerThirdGraphic()],
  };
}

/**
 * Draws the item editor on a connected page that knows the race clock and the driver
 * lower third. `itemBeingEdited` null draws the editor for a new item of the main
 * session's rundown.
 */
export function renderItemEditorPanelOnFakeServer(
  itemBeingEdited: Item | null,
): ItemEditorOnFakeServer {
  const onClose = vi.fn<() => void>();
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <ItemEditorPanel
      rundownId={idOfTheMainSessionRundown}
      itemBeingEdited={itemBeingEdited}
      onClose={onClose}
    />,
    buildSlicesWithTheRaceClockAndTheDriverLowerThird(),
  );
  return {
    fakeServer: controlPage.fakeServer,
    serverStateStore: controlPage.serverStateStore,
    onClose,
  };
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
    buildSlicesWithTheRaceClockAndTheDriverLowerThird(),
  );
  fireEvent.click(screen.getByRole('button', { name: openEditorButtonText }));
}

/** Presses "Salvar item" and waits until the fake server holds that many commands. */
export async function pressSaveAndWaitForCommand(
  commandsExpectedByThen: number,
  fakeServer: ControlPageOnFakeServer['fakeServer'],
): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
  await waitFor(() => {
    expect(fakeServer.listCommandsReceived(), '"Salvar item" must send a command').toHaveLength(
      commandsExpectedByThen,
    );
  });
}
