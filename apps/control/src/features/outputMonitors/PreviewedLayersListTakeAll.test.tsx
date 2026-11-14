/**
 * "vai limpar", "Tomar tudo" and "Descartar tudo" under the "Prévia" monitor (apps/control)
 *
 * What this module is for:
 *   Prévia shows what the screen will look like after the take. A layer can be marked
 *   "will be cleared" (the server's previewClearedLayerIds slice): Prévia then draws it
 *   empty although something is on air there, and the take clears it. Under the monitor
 *   such a layer has a line of its own reading "vai limpar", with the same "Tomar" and
 *   "Descartar" as a preview. When more than one layer has a preview or a mark, two more
 *   buttons send the whole set at once: "Tomar tudo" (takeAllPreviews, one change on the
 *   server, so OBS never shows half of it) and "Descartar tudo" (stopPreview for every
 *   layer, which also removes the marks).
 *
 * What these tests prove:
 *   - A marked layer gets a line reading "vai limpar", in z-order among the previews.
 *   - "Tomar" on that line sends takePreview for its layer (the server clears it) and
 *     "Descartar" sends stopPreview for its layer.
 *   - "Tomar tudo" and "Descartar tudo" are shown only while two or more lines are listed,
 *     whether those lines are previews, marks or one of each.
 *   - "Tomar tudo" sends takeAllPreviews and nothing after it: no automatic preview of the
 *     next rundown item follows, even with the switch on and the cursor moved on.
 *   - "Descartar tudo" sends stopPreview with layerId null.
 *   - A refused "Tomar tudo" is shown under the lines, in the server's words.
 *
 * What these tests deliberately do not cover:
 *   - The lines of plain previews and their labels: PreviewedLayersList.test.tsx.
 *   - A "Tomar tudo" that left layers for another console: PreviewedLayersListLayersNotTaken.test.tsx.
 *   - What the server does with takeAllPreviews (one state change, z-order, refusals):
 *     apps/server's takeAllPreviews.test.ts and storeTakeAllPreviews.test.ts.
 *   - What the Prévia page draws for a mark: apps/renderer's previewComposition.test.ts.
 */
import type { Instance, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildLowerThirdPreviewWhoseItemIsGone,
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
  idOfTheRaceClockOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { PreviewedLayersList } from './PreviewedLayersList';

// Saturday of the endurance race: the clock went on air at 9:30, the start was
// previewed at 9:58, the interview band at 9:59, and "Tomar tudo" is pressed at 10:00.
const momentTheClockWentOnAir = '2026-10-10T12:30:00.000Z';
const momentTheStartWasPreviewed = '2026-10-10T12:58:00.000Z';
const momentTheBandWasPreviewed = '2026-10-10T12:59:00.000Z';
const momentOfTakeAll = '2026-10-10T13:00:00.000Z';

/**
 * What the server sends for these tests: its six layers, the race clock and the lower
 * third, the endurance rundown with its cursor on the start, these instances and these
 * layers marked "vai limpar".
 */
function buildSlicesWithTheseInstancesAndMarks(
  instances: Instance[],
  previewClearedLayerIds: string[],
): Slices {
  return {
    ...buildSlicesWithTheEnduranceRundown(enduranceStartItemId),
    graphics: [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()],
    instances,
    previewClearedLayerIds,
  };
}

/** The clock on air, and its layer marked to be cleared at the next take. */
function buildSlicesWithTheClockOnAirMarkedToBeCleared(): Slices {
  return buildSlicesWithTheseInstancesAndMarks(
    [buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir)],
    ['clock'],
  );
}

/** The clock on air marked to be cleared, and the interview band previewed above it. */
function buildSlicesWithTheClockMarkedAndTheBandPreviewed(): Slices {
  return buildSlicesWithTheseInstancesAndMarks(
    [
      buildLowerThirdPreviewWhoseItemIsGone(momentTheBandWasPreviewed),
      buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir),
    ],
    ['clock'],
  );
}

/**
 * What the server makes of a preview at "Tomar tudo": a new program instance with the
 * preview's graphic, layer, data and item, taken at 10:00, with no preview-only field.
 */
function buildProgramInstanceTakenFromPreview(preview: Instance, newInstanceId: string): Instance {
  const programInstance: Instance = {
    id: newInstanceId,
    layerId: preview.layerId,
    graphicId: preview.graphicId,
    target: 'program',
    resolvedData: preview.resolvedData,
    currentStep: 0,
    status: 'loading',
    takenAt: momentOfTakeAll,
  };
  if (preview.itemId !== undefined) {
    programInstance.itemId = preview.itemId;
  }
  return programInstance;
}

/** Reads the layer names of the lines on screen, top line first. */
function listLayerNamesOfTheLines(): (string | null)[] {
  const list = screen.queryByRole('list', { name: 'Em prévia' });
  if (list === null) {
    return [];
  }
  return within(list)
    .getAllByRole('listitem')
    .map((line) => line.getAttribute('aria-label'));
}

describe('a layer marked "vai limpar" under the "Prévia" monitor', () => {
  it('gets a line of its own that says "vai limpar", in z-order with the previews', () => {
    // Arrange: the band (upper layer) previewed, the clock (lower layer) marked.
    const slices = buildSlicesWithTheClockMarkedAndTheBandPreviewed();

    // Act: draw the area.
    renderOnControlPageConnectedToFakeServer(<PreviewedLayersList />, slices);

    // Assert: two lines, the clock's first, and it says the layer will be cleared.
    expect(
      listLayerNamesOfTheLines(),
      'a marked layer is listed like a preview, from the bottom layer to the top one',
    ).toEqual(['Relógio', 'Tarja']);
    const clockLine = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockLine.getByText('vai limpar'),
      'the line of a marked layer must say the take will clear it',
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Nada em prévia.'),
      'a mark is something in preview, so the area must not say it is empty',
    ).toBeNull();
  });

  const buttonScenarios = [
    // "Tomar" on a marked line is the same takePreview as on a preview: the server
    // clears the layer's program output because the layer is marked. It says the page
    // showed the clock on air there (BAJAOVRLAY-69).
    {
      name: '"Tomar" on the marked line sends takePreview for that layer',
      buttonName: 'Tomar',
      expectedCommand: {
        type: 'takePreview',
        layerId: 'clock',
        instanceIdSeenOnAir: idOfTheRaceClockOnAir,
      },
    },
    // "Descartar" takes the mark away and leaves what is on air alone.
    {
      name: '"Descartar" on the marked line sends stopPreview for that layer',
      buttonName: 'Descartar',
      expectedCommand: { type: 'stopPreview', layerId: 'clock' },
    },
  ];

  it.each(buttonScenarios)('$name', ({ buttonName, expectedCommand }) => {
    // Arrange: only the clock's layer is marked.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheClockOnAirMarkedToBeCleared(),
    );

    // Act: press the button on the clock's line.
    const clockLine = within(screen.getByRole('listitem', { name: 'Relógio' }));
    fireEvent.click(clockLine.getByRole('button', { name: buttonName }));

    // Assert: one command, naming the clock layer.
    expect(
      fakeServer.listCommandsReceived(),
      `"${buttonName}" on a marked line must send one command for that layer`,
    ).toEqual([expectedCommand]);
    fakeServer.acceptLastCommand();
  });
});

describe('"Tomar tudo" and "Descartar tudo" under the "Prévia" monitor', () => {
  const visibilityScenarios: Array<{
    name: string;
    buildSlices: () => Slices;
    areTheButtonsExpected: boolean;
  }> = [
    // One preview alone: its own "Tomar" is all the operator needs.
    {
      name: 'are hidden with one preview',
      buildSlices: () =>
        buildSlicesWithTheseInstancesAndMarks(
          [buildLowerThirdPreviewWhoseItemIsGone(momentTheBandWasPreviewed)],
          [],
        ),
      areTheButtonsExpected: false,
    },
    // One mark alone: the same, a single line.
    {
      name: 'are hidden with one marked layer',
      buildSlices: buildSlicesWithTheClockOnAirMarkedToBeCleared,
      areTheButtonsExpected: false,
    },
    // Two previews on two layers: a set the operator wants to take in one cut.
    {
      name: 'are shown with two previews',
      buildSlices: () =>
        buildSlicesWithTheseInstancesAndMarks(
          [
            buildLowerThirdPreviewWhoseItemIsGone(momentTheBandWasPreviewed),
            buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
          ],
          [],
        ),
      areTheButtonsExpected: true,
    },
    // A preview and a mark count as two lines too: the band comes in as the clock goes.
    {
      name: 'are shown with one preview and one marked layer',
      buildSlices: buildSlicesWithTheClockMarkedAndTheBandPreviewed,
      areTheButtonsExpected: true,
    },
  ];

  it.each(visibilityScenarios)('$name', ({ buildSlices, areTheButtonsExpected }) => {
    // Arrange: the state of this row.
    const slices = buildSlices();

    // Act: draw the area.
    renderOnControlPageConnectedToFakeServer(<PreviewedLayersList />, slices);

    // Assert: both buttons are there, or neither is.
    const isTakeAllShown = screen.queryByRole('button', { name: 'Tomar tudo' }) !== null;
    const isDiscardAllShown = screen.queryByRole('button', { name: 'Descartar tudo' }) !== null;
    expect(
      isTakeAllShown,
      '"Tomar tudo" must be shown exactly when two or more lines are listed',
    ).toBe(areTheButtonsExpected);
    expect(
      isDiscardAllShown,
      '"Descartar tudo" must be shown exactly when two or more lines are listed',
    ).toBe(areTheButtonsExpected);
  });

  it('"Tomar tudo" sends takeAllPreviews, and no automatic preview follows it', async () => {
    // Arrange: the start (the cursor item) and the band are previewed, and the switch
    // "Prévia automática" is on, as it is by default.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheseInstancesAndMarks(
        [
          buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
          buildLowerThirdPreviewWhoseItemIsGone(momentTheBandWasPreviewed),
        ],
        [],
      ),
    );

    // Act: press "Tomar tudo"; the server takes both, moves the cursor on to the yellow
    // flag, sends the one slices message of that change, as the real one does, and
    // answers ok.
    fireEvent.click(screen.getByRole('button', { name: 'Tomar tudo' }));
    fakeServer.sendMessage({
      type: 'slices',
      slices: {
        instances: [
          buildProgramInstanceTakenFromPreview(
            buildLowerThirdPreviewWhoseItemIsGone(momentTheBandWasPreviewed),
            '0d6f3b2e-8a41-4c97-b5e2-1f9a7c3d6e50-lower-third',
          ),
          buildProgramInstanceTakenFromPreview(
            buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
            '0d6f3b2e-8a41-4c97-b5e2-1f9a7c3d6e50-clock',
          ),
        ],
        rundowns: [buildMainRundown(yellowFlagItemId)],
        eventLog: [
          {
            id: 12,
            ts: momentOfTakeAll,
            actor: 'operador:3f2a9c1e',
            command: 'takeAllPreviews',
            payload: { type: 'takeAllPreviews' },
            result: { status: 'ok' },
          },
        ],
      },
      serverNowMs: Date.parse(momentOfTakeAll),
    });
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: one command, with nothing in it but its type and what the page showed on air on
    // each layer it takes (nothing on either; BAJAOVRLAY-69), and nothing after it.
    expect(
      fakeServer.listCommandsReceived(),
      '"Tomar tudo" must send takeAllPreviews alone and preview nothing afterwards',
    ).toEqual([
      { type: 'takeAllPreviews', instanceIdsSeenOnAir: { clock: null, 'lower-third': null } },
    ]);
  });

  it('"Descartar tudo" sends stopPreview for every layer at once', () => {
    // Arrange: the clock's layer marked and the band previewed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheClockMarkedAndTheBandPreviewed(),
    );

    // Act: press "Descartar tudo".
    fireEvent.click(screen.getByRole('button', { name: 'Descartar tudo' }));

    // Assert: the "every layer" form of stopPreview, which removes the marks too.
    expect(
      fakeServer.listCommandsReceived(),
      '"Descartar tudo" must send stopPreview with layerId null',
    ).toEqual([{ type: 'stopPreview', layerId: null }]);
    fakeServer.acceptLastCommand();
  });

  it('shows the server\'s pt-BR message under the lines when "Tomar tudo" is refused', async () => {
    // Arrange: two lines, and "Tomar tudo" pressed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheClockMarkedAndTheBandPreviewed(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tomar tudo' }));

    // Act: another operator discarded everything a moment earlier, so the server refuses.
    fakeServer.refuseLastCommand({
      code: 'NOTHING_IN_PREVIEW',
      message:
        'Não há nada em prévia para colocar no ar: nenhuma camada tem prévia nem está marcada para limpar.',
    });

    // Assert: the reason is on screen, next to the buttons.
    expect(
      await screen.findByRole('alert'),
      'a refused "Tomar tudo" must be explained under the lines, in the words of the server',
    ).toHaveTextContent(
      'Não há nada em prévia para colocar no ar: nenhuma camada tem prévia nem está marcada para limpar.',
    );
  });
});
