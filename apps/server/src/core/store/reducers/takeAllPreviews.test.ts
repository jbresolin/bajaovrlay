/**
 * The takeAllPreviews reducer: "Tomar tudo" (apps/server)
 *
 * What this module is for:
 *   Prévia shows the screen as it will be after the take. "Tomar tudo" makes program
 *   equal to that in one state change: every preview instance is taken exactly as
 *   takePreview takes it (the data as seen, a stamped field stamped again with this
 *   command's moment, the item's id kept) and every layer marked "will be cleared" has
 *   its program output emptied; then no preview and no marker is left. The layers are
 *   handled one by one in z-order, lowest first, so the result never depends on the
 *   order instances happen to sit in the slice. The rundown cursors are settled once,
 *   after all the takes, so they do not depend on that order either.
 *   A command that makes several instances cannot use the store's one new instance id
 *   for all of them, so each new program instance gets that id followed by a hyphen and
 *   its layer id; one command makes at most one instance per layer and output.
 *
 * What these tests prove:
 *   - Previews on two layers and a marker on a third: both previews are on program as
 *     new instances (written out in full, the clock's reference moment stamped with the
 *     moment of "Tomar tudo"), the marked layer's program is empty, other layers stay,
 *     and no preview or marker is left.
 *   - With only markers, the marked layers are emptied on program and the rest stays.
 *   - The rundown cursor does not depend on the z-order: after every take, a cursor on
 *     an item this command took moves on to the following item until it rests on one
 *     that was not taken (or on nothing, played to the end, past the last item). Rows:
 *     the cursor item on the upper or the lower layer, the other item taken earlier in
 *     the rundown, the cursor item not taken, and the last two items taken.
 *   - With no preview and no marker the command is refused with NOTHING_IN_PREVIEW.
 *   - When one layer cannot be taken (its data no longer fits the graphic's schema, or
 *     the layer is no longer listed), the whole command is refused, the message names
 *     that layer, and the refusal carries the reason of the take that failed.
 *
 * What these tests deliberately do not cover:
 *   - One event-log row and one broadcast for the whole set, the auto-out waits of the
 *     items taken, and the markers never saved; storeTakeAllPreviews.test.ts covers them
 *     on a real SQLite file.
 *   - takePreview of one layer; takePreview.test.ts and takePreviewCursor.test.ts.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import {
  buildGreenFlagClockOnProgram,
  buildStartItemOnPreviewWithItsMomentStamped,
  buildTeam42LowerThirdOnPreview,
  buildYellowFlagItemOnPreview,
  contextOfTheLaterTake,
  momentOfTheLaterTakeInMilliseconds,
  readLayerAndOutputOfEachInstance,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroClockData,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildPodiumTeamItem,
  buildRaceDaySlicesWithRundown,
  buildRaceDaySlicesWithTheRaceClockSchema,
  buildTeam42LowerThirdTakenByHand,
  buildYellowFlagItem,
  mainSessionRundownId,
} from './rundownSlices.testSupport.js';

/** Builds the lower third of team 42, previewed by hand from its shortcut, on the ticker layer instead. */
function buildTeam42LowerThirdPreviewedOnTheTicker() {
  return { ...buildTeam42LowerThirdOnPreview(), layerId: 'ticker' };
}

/** Builds "Pódio — Baja UFPR" as the second item of the main session, on the lower third. */
function buildPodiumItemInTheMainSession(order: number): Item {
  return {
    ...buildPodiumTeamItem(order),
    home: { kind: 'rundown', rundownId: mainSessionRundownId },
  };
}

/** Returns the same slices with the race clock registered under another manifest. */
function replaceRaceClockManifest(
  slices: SlicesChangedByCommands,
  manifest: Graphic['manifest'],
): SlicesChangedByCommands {
  const graphicsWithTheOtherManifest = slices.graphics.map((graphic) =>
    graphic.id === 'race-clock' ? { ...graphic, manifest } : graphic,
  );
  return { ...slices, graphics: graphicsWithTheOtherManifest };
}

describe('takeAllPreviews that takes the whole set', () => {
  it('puts every preview on program, empties every marked layer and leaves nothing in Prévia', () => {
    // Arrange: on air, the green clock and the lower third of team 42; in Prévia, the
    // "Largada do enduro" clock (its reference moment stamped at the preview) and a lower
    // third on the ticker, and the lower third layer marked "will be cleared".
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildEnduroStartItem(0)],
      instances: [
        buildGreenFlagClockOnProgram(),
        buildTeam42LowerThirdTakenByHand(),
        buildStartItemOnPreviewWithItsMomentStamped(),
        buildTeam42LowerThirdPreviewedOnTheTicker(),
      ],
      previewClearedLayerIds: ['lower-third'],
    });

    // Act: press "Tomar tudo" at 14:47:30.250.
    const outcome = reduceCommand(slicesBefore, { type: 'takeAllPreviews' }, contextOfTheLaterTake);

    // Assert: the ticker (z 20) and the clock (z 30) are on program as new instances, the
    // lower third (z 40) is gone, and nothing is left in Prévia.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(outcome.status, 'the whole set must be taken').toBe('applied');
    expect(slicesAfter?.instances, 'program must be what Prévia showed').toEqual([
      {
        id: `${contextOfTheLaterTake.newInstanceId}-ticker`,
        layerId: 'ticker',
        graphicId: 'team-lower-third',
        target: 'program',
        resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
        currentStep: 0,
        status: 'loading',
        takenAt: '2026-10-09T14:47:30.250Z',
        itemId: 'item-atalho-tarja-baja-ufpr',
      },
      {
        id: `${contextOfTheLaterTake.newInstanceId}-clock`,
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: {
          ...buildEnduroClockData('green'),
          referenceTimeMs: 0,
          referenceWallClockMs: momentOfTheLaterTakeInMilliseconds,
        },
        currentStep: 0,
        status: 'loading',
        takenAt: '2026-10-09T14:47:30.250Z',
        itemId: 'item-largada-do-enduro',
      },
    ]);
    expect(slicesAfter?.previewClearedLayerIds, 'no marker may be left').toEqual([]);
  });

  it('with only markers, empties the marked layers on program and keeps the rest', () => {
    // Arrange: the clock and the lower third on air; only the lower third is marked.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      instances: [buildGreenFlagClockOnProgram(), buildTeam42LowerThirdTakenByHand()],
      previewClearedLayerIds: ['lower-third'],
    });

    // Act: press "Tomar tudo".
    const outcome = reduceCommand(slicesBefore, { type: 'takeAllPreviews' }, contextOfTheLaterTake);

    // Assert: only the clock is left on air, and the marker is gone.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLayerAndOutputOfEachInstance(slicesAfter?.instances),
      'only the marked layer may be emptied',
    ).toEqual(['clock on program']);
    expect(slicesAfter?.previewClearedLayerIds, 'no marker may be left').toEqual([]);
  });
});

describe('takeAllPreviews and the rundown cursor', () => {
  // "Pódio — Baja UFPR" previewed from its item on the lower third (z 40), and "Largada
  // do enduro" previewed on the clock (z 30): the lower third is the upper layer.
  const podiumItemPreviewed = {
    ...buildTeam42LowerThirdOnPreview(),
    itemId: 'item-podio-baja-ufpr',
  };
  const bothItemsPreviewed = [podiumItemPreviewed, buildStartItemOnPreviewWithItsMomentStamped()];

  const cursorScenarios = [
    // The ruling's case: the cursor item is on the upper layer and the next item, also
    // taken, on the lower one. Promoted lowest first, the old per-item rule left the
    // cursor on "Largada do enduro", which was already on air.
    {
      name: 'moves past both when the cursor item is on the upper layer and the next one taken is lower',
      itemsOfTheMainSession: [
        buildPodiumItemInTheMainSession(0),
        buildEnduroStartItem(1),
        buildYellowFlagItem(2),
      ],
      cursorItemIdBefore: 'item-podio-baja-ufpr',
      expectedCursor: { cursorItemId: 'item-bandeira-amarela', wasLastItemTakenAtCursor: false },
    },
    // The same two items the other way round in z-order: the answer must be the same,
    // because the cursor no longer depends on the order the layers are promoted in.
    {
      name: 'moves past both when the cursor item is on the lower layer and the next one taken is upper',
      itemsOfTheMainSession: [
        buildEnduroStartItem(0),
        buildPodiumItemInTheMainSession(1),
        buildYellowFlagItem(2),
      ],
      cursorItemIdBefore: 'item-largada-do-enduro',
      expectedCursor: { cursorItemId: 'item-bandeira-amarela', wasLastItemTakenAtCursor: false },
    },
    // The lower-layer item sits earlier in the rundown than the cursor: only the cursor
    // item counts, so the cursor goes to the item after it, as takeItem would.
    {
      name: 'moves only past the cursor item when the other item taken is earlier in the rundown',
      itemsOfTheMainSession: [
        buildEnduroStartItem(0),
        buildPodiumItemInTheMainSession(1),
        buildYellowFlagItem(2),
      ],
      cursorItemIdBefore: 'item-podio-baja-ufpr',
      expectedCursor: { cursorItemId: 'item-bandeira-amarela', wasLastItemTakenAtCursor: false },
    },
    // Neither item taken is the plan's next item: both were fired ad hoc, so the cursor
    // stays where the operator left it.
    {
      name: 'leaves the cursor alone when its item is not among those taken',
      itemsOfTheMainSession: [
        buildEnduroStartItem(0),
        buildPodiumItemInTheMainSession(1),
        buildYellowFlagItem(2),
      ],
      cursorItemIdBefore: 'item-bandeira-amarela',
      expectedCursor: { cursorItemId: 'item-bandeira-amarela', wasLastItemTakenAtCursor: false },
    },
    // The two items taken are the last two of the rundown: the cursor runs past the end
    // and the rundown is marked as played to its end, exactly as takeItem of the last
    // item at the cursor marks it.
    {
      name: 'leaves the cursor on nothing, played to the end, when the last items are taken',
      itemsOfTheMainSession: [buildPodiumItemInTheMainSession(0), buildEnduroStartItem(1)],
      cursorItemIdBefore: 'item-podio-baja-ufpr',
      expectedCursor: { cursorItemId: null, wasLastItemTakenAtCursor: true },
    },
  ];

  it.each(cursorScenarios)(
    '$name',
    ({ itemsOfTheMainSession, cursorItemIdBefore, expectedCursor }) => {
      // Arrange: the main session with the row's items and cursor, and both items in
      // Prévia. The lower third sits first in the slice on purpose: the slice order must
      // not count either.
      const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
        rundowns: [buildMainSessionRundown(cursorItemIdBefore), buildPodiumRundown(null)],
        items: itemsOfTheMainSession,
        instances: bothItemsPreviewed,
      });

      // Act: press "Tomar tudo".
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'takeAllPreviews' },
        contextOfTheLaterTake,
      );

      // Assert: the cursor is on the first item at or after it that was not just taken.
      const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
      const mainSessionAfter = slicesAfter?.rundowns.find(
        (rundown) => rundown.id === mainSessionRundownId,
      );
      expect(
        {
          cursorItemId: mainSessionAfter?.cursorItemId,
          wasLastItemTakenAtCursor: mainSessionAfter?.wasLastItemTakenAtCursor ?? false,
        },
        'the cursor must never be left on an item this "Tomar tudo" just put on air',
      ).toEqual(expectedCursor);
    },
  );
});

describe('takeAllPreviews that must be refused', () => {
  // The race clock's manifest as it would be if its flag list lost the yellow flag.
  const manifestWithoutTheYellowFlag = {
    ...raceClockManifestForTests,
    schema: {
      ...raceClockManifestForTests.schema,
      properties: {
        ...raceClockManifestForTests.schema.properties,
        state: { type: 'string', enum: ['pre', 'green', 'red', 'checkered', 'finished'] },
      },
    },
  };

  const refusedScenarios = [
    // "Tomar tudo" with an empty Prévia: there is something on air, but nothing to take.
    {
      name: 'refuses when there is no preview and no marker',
      slicesBefore: buildRaceDaySlicesWithRundown({
        items: [],
        instances: [buildGreenFlagClockOnProgram(), buildTeam42LowerThirdTakenByHand()],
      }),
      expectedError: {
        code: 'NOTHING_IN_PREVIEW',
        message:
          'Não há nada em prévia para colocar no ar: nenhuma camada tem prévia nem está marcada para limpar.',
      },
    },
    // The lower third on the ticker could be taken, the yellow clock could not: nothing
    // is taken, so OBS never shows half of the set the operator saw.
    {
      name: 'refuses the whole set when one preview no longer fits its graphic, naming the layer',
      slicesBefore: replaceRaceClockManifest(
        buildRaceDaySlicesWithTheRaceClockSchema({
          items: [buildYellowFlagItem(0)],
          instances: [buildTeam42LowerThirdPreviewedOnTheTicker(), buildYellowFlagItemOnPreview()],
          previewClearedLayerIds: ['lower-third'],
        }),
        manifestWithoutTheYellowFlag,
      ),
      expectedError: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          '"Tomar tudo" não foi feito e nada mudou: a camada "Relógio" não pode ir ao ar. Dados inválidos para o gráfico "race-clock": o campo "state" tem um valor que o gráfico não aceita.',
      },
    },
    // A preview on a layer the server no longer lists cannot be taken (no command removes
    // a layer today, so only a damaged state gets here); it is named by its id.
    {
      name: 'refuses the whole set when a preview sits on a layer that is not listed',
      slicesBefore: buildRaceDaySlicesWithRundown({
        items: [],
        instances: [
          buildTeam42LowerThirdPreviewedOnTheTicker(),
          {
            ...buildTeam42LowerThirdOnPreview(),
            id: 'b2d4f6a8-0c1e-4a3b-9d5f-7e9a1c3e5f70',
            layerId: 'placar',
          },
        ],
      }),
      expectedError: {
        code: 'LAYER_NOT_FOUND',
        message:
          '"Tomar tudo" não foi feito e nada mudou: a camada "placar" não pode ir ao ar. A camada "placar" não existe.',
      },
    },
  ];

  it.each(refusedScenarios)('$name', ({ slicesBefore, expectedError }) => {
    // Arrange: the slices of this row (see the table above).

    // Act: press "Tomar tudo".
    const outcome = reduceCommand(slicesBefore, { type: 'takeAllPreviews' }, contextOfTheLaterTake);

    // Assert: refused with the reason of the row. A refusal carries no new slices, so
    // every preview and marker stays and program is untouched.
    expect(outcome, 'the whole command must be refused with the reason of the row').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
