/**
 * "Tomar" under the "Prévia" monitor previews the next item (apps/control)
 *
 * What this module is for:
 *   With the switch "Prévia automática" on, a take this operator sent that moves the
 *   rundown's cursor on also previews the item the cursor arrives on (João's ruling,
 *   gate 2 of BAJAOVRLAY-15). Space and a row's "Disparar" did it from the start; since
 *   BAJAOVRLAY-16 "Tomar" under the "Prévia" monitor does too. "Tomar" sends
 *   `takePreview`; the server moves the cursor on only when the preview was of the
 *   cursor item. Once the server accepted the take, the page previews the new cursor
 *   item with origin `auto`, as after Space.
 *
 *   The switch sits in the rundown column and "Tomar" in the centre column. Both read
 *   the page's one store for the setting, so flipping the switch changes what "Tomar"
 *   does at once.
 *
 * What these tests prove:
 *   - "Tomar" on the preview of the cursor item sends takePreview and, after the server
 *     accepted it and moved the cursor on, previewItem (auto) for the new cursor item.
 *   - Nothing is previewed after "Tomar" when the switch is off (as stored in the
 *     browser), when the cursor did not move (a preview made by hand in "Edição
 *     rápida"), or when the server refused the take.
 *   - Flipping the switch in the rundown column changes what "Tomar" does, both ways.
 *
 * What these tests deliberately do not cover:
 *   - The rule itself, row by row: features/autoPreview/itemToPreviewAfterTake.test.ts.
 *   - Space and "Disparar": RundownPanelPreviewAfterTake.test.tsx.
 *   - When the server moves the cursor on a takePreview: apps/server's
 *     takePreviewCursor.test.ts.
 *   - The real server and the real outputs: e2e/previewTakeWithTomar.e2e.ts.
 */
import type { Instance, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RundownPanel } from '@/features/rundown/RundownPanel';
import {
  type ControlPageOnFakeServer,
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildLowerThirdPreviewMadeByHand,
  buildRaceClockPreviewOfItem,
} from '@/state/previewLikeTheServerSends.testSupport';
import {
  buildMainRundown,
  buildSlicesWithTheEnduranceRundown,
  enduranceStartItemId,
  yellowFlagItemId,
} from '@/state/rundownLikeTheServerSends.testSupport';
import {
  buildRaceClockGraphic,
  buildRaceClockInstanceOnTheClockLayer,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { PreviewedLayersList } from './PreviewedLayersList';

// The item editor has its own tests; a stand-in takes its place where the rundown is drawn.
vi.mock('@/features/items/ItemEditorPanel', () =>
  import('@/features/rundown/itemEditorStandIn.testSupport'),
);

// Saturday of the endurance race: the start was previewed at 9:58 and is taken at 10:00.
const momentTheStartWasPreviewed = '2026-10-10T12:58:00.000Z';
const momentOfTheTake = '2026-10-10T13:00:00.000Z';

// The name the setting is stored under, and the text the page stores for "off".
const nameOfTheStoredSetting = 'bajaovrlay.previaAutomatica';
const textStoredWhenOff = 'desligada';

const takeTheClockPreview = { type: 'takePreview', layerId: 'clock' };
const previewTheYellowFlagAutomatically = {
  type: 'previewItem',
  itemId: yellowFlagItemId,
  origin: 'auto',
};

type FakeServer = ControlPageOnFakeServer['fakeServer'];

/**
 * What the server sends: the three endurance items with the cursor on the start, the
 * start previewed on the clock layer, and the interview band previewed by hand.
 */
function buildSlicesWithTheStartAndTheBandPreviewed(): Slices {
  return {
    ...buildSlicesWithTheEnduranceRundown(enduranceStartItemId),
    graphics: [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()],
    instances: [
      buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
      buildLowerThirdPreviewMadeByHand(momentTheStartWasPreviewed),
    ],
  };
}

/** The race clock on the program output, taken from the start of the endurance race. */
function buildStartOnProgram(): Instance {
  return { ...buildRaceClockInstanceOnTheClockLayer(momentOfTheTake), itemId: enduranceStartItemId };
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

/** Presses "Tomar" on the line of the layer with this name. */
function pressTomarOnTheLineOf(layerName: string): void {
  const line = within(screen.getByRole('listitem', { name: layerName }));
  fireEvent.click(line.getByRole('button', { name: 'Tomar' }));
}

describe('"Tomar" with "Prévia automática" on', () => {
  it('previews the item the cursor moved on to, once the server accepted the take', async () => {
    // Arrange: the start is previewed and the cursor is on it; the switch is on.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheStartAndTheBandPreviewed(),
    );

    // Act: press "Tomar" on the clock line; the server puts the start on air, moves the
    // cursor on to the yellow flag, and answers ok.
    pressTomarOnTheLineOf('Relógio');
    const commandsBeforeTheServerAcceptedTheTake = [...fakeServer.listCommandsReceived()];
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildStartOnProgram()],
      cursorItemId: yellowFlagItemId,
    });

    // Assert: the take first, alone until the "ok"; then the preview of the yellow flag.
    expect(
      commandsBeforeTheServerAcceptedTheTake,
      'until the server accepts the take, only the take may have been sent',
    ).toEqual([takeTheClockPreview]);
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        'a "Tomar" that moved the cursor on must preview the new cursor item',
      ).toEqual([takeTheClockPreview, previewTheYellowFlagAutomatically]);
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });
});

describe('a "Tomar" that must not be followed by a preview', () => {
  it('previews nothing while "Prévia automática" is off in this browser', async () => {
    // Arrange: the operator switched it off on an earlier day; the start is previewed.
    window.localStorage.setItem(nameOfTheStoredSetting, textStoredWhenOff);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheStartAndTheBandPreviewed(),
    );

    // Act: press "Tomar" on the clock line; the server moves the cursor on.
    pressTomarOnTheLineOf('Relógio');
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildStartOnProgram()],
      cursorItemId: yellowFlagItemId,
    });
    await letThePageFinishWhatItStarted();

    // Assert: the take is the only command.
    expect(
      fakeServer.listCommandsReceived(),
      'with "Prévia automática" off a "Tomar" must not be followed by a preview',
    ).toEqual([takeTheClockPreview]);
  });

  it('previews nothing when the take left the cursor where it was', async () => {
    // Arrange: the start and the interview band are previewed; the band was made by
    // hand in "Edição rápida", so it is no rundown item.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheStartAndTheBandPreviewed(),
    );

    // Act: press "Tomar" on the band's line; the server airs it and leaves the cursor
    // on the start.
    pressTomarOnTheLineOf('Tarja');
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed)],
      cursorItemId: enduranceStartItemId,
    });
    await letThePageFinishWhatItStarted();

    // Assert: the take is the only command; the next item did not change.
    expect(
      fakeServer.listCommandsReceived(),
      'a "Tomar" that left the cursor where it was must not be followed by a preview',
    ).toEqual([{ type: 'takePreview', layerId: 'lower-third' }]);
  });

  it('previews nothing when the server refuses the take', async () => {
    // Arrange: the start is previewed, and "Tomar" was pressed on the clock line.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheStartAndTheBandPreviewed(),
    );
    pressTomarOnTheLineOf('Relógio');

    // Act: the server refuses. Meanwhile another operator moved the cursor on to the
    // yellow flag, so the cursor did change while this page waited.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'rundowns',
      slice: [buildMainRundown(yellowFlagItemId)],
    });
    fakeServer.refuseLastCommand({
      code: 'LAYER_PREVIEW_EMPTY',
      message: 'Não há nada em prévia na camada "Relógio" para colocar no ar.',
    });
    await letThePageFinishWhatItStarted();

    // Assert: no preview followed: nothing went on air.
    expect(
      fakeServer.listCommandsReceived(),
      'a refused "Tomar" must never be followed by a preview',
    ).toEqual([takeTheClockPreview]);
  });
});

describe('the switch in the rundown column and "Tomar" under the "Prévia" monitor', () => {
  const switchScenarios = [
    // Stored off, switched on in the rundown: "Tomar" must now preview the next item.
    {
      name: 'switching it on in the rundown makes "Tomar" preview the next item',
      storedText: textStoredWhenOff,
      expectedCommands: [takeTheClockPreview, previewTheYellowFlagAutomatically],
    },
    // On by default, switched off in the rundown: "Tomar" must now only take.
    {
      name: 'switching it off in the rundown makes "Tomar" only take',
      storedText: null,
      expectedCommands: [takeTheClockPreview],
    },
  ];

  it.each(switchScenarios)('$name', async ({ storedText, expectedCommands }) => {
    // Arrange: the rundown and the lines under "Prévia" on one page, the start previewed,
    // and the switch as this row stored it.
    if (storedText !== null) {
      window.localStorage.setItem(nameOfTheStoredSetting, storedText);
    }
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <>
        <RundownPanel />
        <PreviewedLayersList />
      </>,
      buildSlicesWithTheStartAndTheBandPreviewed(),
    );

    // Act: flip the switch in the rundown column, then press "Tomar" on the clock line;
    // the server moves the cursor on to the yellow flag.
    fireEvent.click(screen.getByRole('switch', { name: 'Prévia automática' }));
    pressTomarOnTheLineOf('Relógio');
    acceptLastCommandWithThisNews(fakeServer, {
      instances: [buildStartOnProgram()],
      cursorItemId: yellowFlagItemId,
    });
    await letThePageFinishWhatItStarted();

    // Assert: "Tomar" followed the switch as it was just flipped.
    expect(
      fakeServer.listCommandsReceived(),
      'the switch and "Tomar" must read the same setting, so a flip changes what "Tomar" does',
    ).toEqual(expectedCommands);
  });
});
