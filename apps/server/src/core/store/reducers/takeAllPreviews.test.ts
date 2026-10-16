/**
 * The takeAllPreviews reducer: "Tomar tudo" (apps/server)
 *
 * What this module is for:
 *   Prévia shows the screen as it will be after the take. "Tomar tudo" makes program
 *   equal to that in one state change: every preview instance is taken exactly as
 *   takePreview takes it (the data as seen, a stamped field stamped again with this
 *   command's moment, the item's id kept, the rundown cursor rule per item) and every
 *   layer marked "will be cleared" has its program output emptied; then no preview and
 *   no marker is left. The layers are handled one by one in z-order, lowest first, so the
 *   result never depends on the order instances happen to sit in the slice.
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
 *   - Two previewed items of one rundown, the first at the cursor: the clock (z 30) is
 *     taken before the lower third (z 40), so the cursor moves on twice and ends on the
 *     item after the second.
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

/** Builds the lower third of team 42 previewed by hand on the ticker layer instead. */
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
  it('takes the layers lowest first, so two items of one rundown move the cursor on twice', () => {
    // Arrange: the main session holds "Largada do enduro" (clock), "Pódio — Baja UFPR"
    // (lower third) and "Bandeira amarela" (clock), the cursor on the first; the first two
    // are previewed. Taken in z-order, the clock (30) goes before the lower third (40):
    // the cursor moves from the first item to the second, then from the second to the
    // third. Taken the other way round it would end on the second, which is why the
    // order is fixed rather than left to the order of the instances slice.
    const podiumItemPreviewed = {
      ...buildTeam42LowerThirdOnPreview(),
      itemId: 'item-podio-baja-ufpr',
    };
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: [buildEnduroStartItem(0), buildPodiumItemInTheMainSession(1), buildYellowFlagItem(2)],
      // The lower third sits first in the slice on purpose: the slice order must not count.
      instances: [podiumItemPreviewed, buildStartItemOnPreviewWithItsMomentStamped()],
    });

    // Act: press "Tomar tudo".
    const outcome = reduceCommand(slicesBefore, { type: 'takeAllPreviews' }, contextOfTheLaterTake);

    // Assert: the cursor ends on "Bandeira amarela", the item after the second one taken.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.rundowns.find((rundown) => rundown.id === mainSessionRundownId)?.cursorItemId,
      'the cursor must move on once per item taken at the cursor, lowest layer first',
    ).toBe('item-bandeira-amarela');
  });
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
