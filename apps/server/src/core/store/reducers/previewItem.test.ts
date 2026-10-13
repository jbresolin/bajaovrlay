/**
 * The previewItem reducer (apps/server)
 *
 * What this module is for:
 *   Nothing goes to air without being seen first. previewItem shows a prepared item on
 *   the PREVIEW output of the item's layer: the item's field values are turned into data
 *   by the very code a take uses, so what the operator sees in the Prévia monitor is what
 *   a take would put on air. It replaces whatever was previewed on that layer and touches
 *   nothing else: not the program output, not the rundown's cursor.
 *
 * What these tests prove:
 *   - The preview instance is exactly what takeItem would put on air, except that it is
 *     on the preview output and says who asked for it; it carries the item's id.
 *   - What is on the program output stays as it was, on the same layer too.
 *   - The rundown's cursor never moves, wherever it was: the very same rundowns array
 *     comes back, so the store neither saves nor broadcasts the rundowns.
 *   - A second preview on the same layer replaces the first; a preview on another layer
 *     stays.
 *   - A field the item leaves "to the moment of the take" is stamped with the moment of
 *     the preview, and the instance remembers its key for the take that may follow.
 *   - Every refusal of a take is a refusal of a preview too, with the same pt-BR reason.
 *
 * What these tests deliberately do not cover:
 *   - Sending the preview to air (takePreview.test.ts) or throwing it away
 *     (stopPreview.test.ts).
 *   - What a preview made by "Prévia automática" (origin `auto`) discards; every preview
 *     here is asked for by hand. previewItemOrigin.test.ts covers it.
 *   - That a preview starts no auto-out; autoOutAndPreview.test.ts covers it.
 *   - Every detail of resolving field values and of the data check; takeItem's own tests
 *     and resolveItemFields.test.ts cover them, and previewItem runs the same code.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagClockOnProgram,
  buildTeam42LowerThirdOnPreview,
  buildYellowFlagItemOnPreview,
  momentOfThePreviewInMilliseconds,
  readLayerAndOutputOfEachInstance,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockData,
  buildEnduroFinishItem,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildPodiumTeamItem,
  buildRaceDaySlicesWithRundown,
  buildRaceDaySlicesWithTheRaceClockSchema,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/** Builds the main session's three items in their usual order: start, yellow, finish. */
function buildThreeEnduroItems(): Item[] {
  return [buildEnduroStartItem(0), buildYellowFlagItem(1), buildEnduroFinishItem(2)];
}

/** Builds "Largada do enduro" with a clock at zero whose reference moment is left to the server. */
function buildEnduroStartItemThatStartsAtTheTake(): Item {
  const startItem = buildEnduroStartItem(0);
  return {
    ...startItem,
    fields: {
      ...startItem.fields,
      referenceTimeMs: { kind: 'literal', value: 0 },
      referenceWallClockMs: { kind: 'takeTime' },
    },
  };
}

describe('previewItem, the instance it puts on the preview output', () => {
  it('creates a preview instance from the item and leaves the program output alone', () => {
    // Arrange: the green flag clock on air, and three items prepared in the main session.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildThreeEnduroItems(),
      instances: [buildGreenFlagClockOnProgram()],
    });

    // Act: preview the yellow flag item, which lives on the same layer as the clock on air.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewItem', itemId: 'item-bandeira-amarela', origin: 'manual' },
      contextOfTheRundownCommand,
    );

    // Assert: the clock on air is untouched and the yellow flag sits beside it on the
    // preview output, written out in full so the reader sees every field.
    expect(outcome.status, 'the item must be previewed').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(instancesAfter, 'program must be as it was, with the item beside it on preview').toEqual(
      [
        buildGreenFlagClockOnProgram(),
        {
          id: contextOfTheRundownCommand.newInstanceId,
          layerId: 'clock',
          graphicId: 'race-clock',
          target: 'preview',
          resolvedData: buildEnduroClockData('yellow'),
          currentStep: 0,
          status: 'loading',
          takenAt: '2026-10-09T14:32:05.000Z',
          previewOrigin: 'manual',
          itemId: 'item-bandeira-amarela',
        },
      ],
    );
  });

  it('shows exactly what takeItem would put on air, only on the other output', () => {
    // Arrange: the same slices, and what a take of the yellow flag item gives on them.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: buildThreeEnduroItems() });
    const outcomeOfTake = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-bandeira-amarela' },
      contextOfTheRundownCommand,
    );
    const instanceOfTake =
      outcomeOfTake.status === 'applied' ? outcomeOfTake.slices.instances[0] : undefined;

    // Act: preview the same item at the same moment.
    const outcomeOfPreview = reduceCommand(
      slicesBefore,
      { type: 'previewItem', itemId: 'item-bandeira-amarela', origin: 'manual' },
      contextOfTheRundownCommand,
    );

    // Assert: the same instance, field for field, except for the output it is on and
    // the mark every preview carries saying who asked for it.
    const instancesOfPreview =
      outcomeOfPreview.status === 'applied' ? outcomeOfPreview.slices.instances : undefined;
    expect(instanceOfTake?.target, 'the take must have gone to program').toBe('program');
    expect(
      instancesOfPreview,
      'the preview must differ from the take in nothing but the output and its origin mark',
    ).toEqual([{ ...instanceOfTake, target: 'preview', previewOrigin: 'manual' }]);
  });

  it('stamps a field left to the moment of the take, and remembers which field it was', () => {
    // Arrange: the start item whose clock leaves its reference moment to the server, with
    // the race clock registered with its real data schema (which allows that stamp).
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildEnduroStartItemThatStartsAtTheTake()],
    });

    // Act: preview it at 14:32:05.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewItem', itemId: 'item-largada-do-enduro', origin: 'manual' },
      contextOfTheRundownCommand,
    );

    // Assert: the previewed clock counts from the preview, so the operator sees it run,
    // and the instance says which field the take must stamp again.
    const previewInstance = outcome.status === 'applied' ? outcome.slices.instances[0] : undefined;
    expect(
      previewInstance?.resolvedData.referenceWallClockMs,
      'the previewed clock must count from the moment of the preview',
    ).toBe(momentOfThePreviewInMilliseconds);
    expect(
      previewInstance?.takeTimeFieldKeys,
      'the preview must remember the stamped field for the take',
    ).toEqual(['referenceWallClockMs']);
  });
});

describe('previewItem and the rundown cursor', () => {
  const cursorScenarios = [
    // The usual case with "Prévia automática": the cursor item itself is previewed.
    {
      name: 'leaves the cursor on the previewed item when that item is the cursor item',
      cursorItemId: 'item-bandeira-amarela',
    },
    // The "Prévia" button of another row: the plan (the cursor) is not touched.
    {
      name: 'leaves the cursor on another item when a different row is previewed',
      cursorItemId: 'item-largada-do-enduro',
    },
    // A cursor on nothing stays on nothing; a preview never picks the next item.
    {
      name: 'leaves the cursor on nothing when it was on nothing',
      cursorItemId: null,
    },
  ];

  it.each(cursorScenarios)('$name', ({ cursorItemId }) => {
    // Arrange: the main session with its cursor where the row says.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown(cursorItemId), buildPodiumRundown(null)],
      items: buildThreeEnduroItems(),
    });

    // Act: preview the yellow flag item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewItem', itemId: 'item-bandeira-amarela', origin: 'manual' },
      contextOfTheRundownCommand,
    );

    // Assert: the very same rundowns and items arrays come back, so nothing about the
    // rundown is saved or broadcast.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.rundowns, 'a preview must never move the cursor').toBe(
      slicesBefore.rundowns,
    );
    expect(slicesAfter?.items, 'a preview must never change an item').toBe(slicesBefore.items);
  });
});

describe('previewItem on a layer that already has a preview', () => {
  it('replaces the preview of the same layer and leaves the preview of another layer', () => {
    // Arrange: the yellow flag previewed on the clock layer, a lower third previewed by
    // hand on its own layer, and the green clock on air.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildThreeEnduroItems(),
      instances: [
        buildGreenFlagClockOnProgram(),
        buildYellowFlagItemOnPreview(),
        buildTeam42LowerThirdOnPreview(),
      ],
    });

    // Act: preview the finish item, which also lives on the clock layer.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewItem', itemId: 'item-chegada-do-enduro', origin: 'manual' },
      { ...contextOfTheRundownCommand, newInstanceId: 'd4b8a2f6-0c1e-4a3d-9f57-8e6c4b2a1d09' },
    );

    // Assert: one preview per layer; the yellow flag gave way to the finish, the lower
    // third and the clock on air stayed.
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(
      readLayerAndOutputOfEachInstance(instancesAfter),
      'a layer must hold at most one preview, and other layers and program must stay',
    ).toEqual(['clock on program', 'lower-third on preview', 'clock on preview']);
    expect(
      instancesAfter?.map((instance) => instance.itemId),
      'the preview of the clock layer must now be the finish item',
    ).toEqual([undefined, undefined, 'item-chegada-do-enduro']);
  });
});

describe('previewItem that must be refused', () => {
  const refusedPreviewScenarios = [
    // The row was deleted by another operator just before the press.
    {
      name: 'refuses an item that does not exist',
      itemId: 'item-que-foi-excluido',
      items: buildThreeEnduroItems(),
      expectedError: {
        code: 'ITEM_NOT_FOUND',
        message: 'O item "item-que-foi-excluido" não existe; ele pode ter sido excluído.',
      },
    },
    // The item's graphic package was removed: takeGraphic's own refusal comes back.
    {
      name: 'refuses an item whose graphic is not registered, as a take does',
      itemId: 'item-podio-baja-ufpr',
      items: [{ ...buildPodiumTeamItem(0), graphicId: 'podium-card' }],
      expectedError: {
        code: 'GRAPHIC_NOT_FOUND',
        message: 'O gráfico "podium-card" não está registrado.',
      },
    },
    // Data the race clock's schema refuses must not reach the Prévia monitor either.
    {
      name: 'refuses an item whose data the graphic does not accept, as a take does',
      itemId: 'item-largada-do-enduro',
      items: [
        {
          ...buildEnduroStartItem(0),
          fields: {
            ...buildEnduroStartItem(0).fields,
            referenceTimeMs: { kind: 'literal' as const, value: -5_000 },
          },
        },
      ],
      expectedError: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'Dados inválidos para o gráfico "race-clock": o campo "referenceTimeMs" tem um valor que o gráfico não aceita.',
      },
    },
    // "The moment of the take" asked of a field that is a duration, not a moment.
    {
      name: 'refuses an item that leaves a field that is not a moment to the server, as a take does',
      itemId: 'item-largada-do-enduro',
      items: [
        {
          ...buildEnduroStartItem(0),
          fields: {
            ...buildEnduroStartItem(0).fields,
            referenceTimeMs: { kind: 'takeTime' as const },
          },
        },
      ],
      expectedError: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
      },
    },
  ];

  it.each(refusedPreviewScenarios)('$name', ({ itemId, items, expectedError }) => {
    // Arrange: the items of this row, with the race clock registered with its real data
    // schema and the yellow flag already previewed on the clock layer.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items,
      instances: [buildYellowFlagItemOnPreview()],
    });

    // Act: preview the item of this row.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewItem', itemId, origin: 'manual' },
      contextOfTheRundownCommand,
    );

    // Assert: refused with the reason a take gives; a refusal carries no new slices, so
    // the preview that was there stays.
    expect(outcome, 'the preview must be refused with the reason of the row').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
