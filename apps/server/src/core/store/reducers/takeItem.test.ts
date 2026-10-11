/**
 * The takeItem reducer (apps/server)
 *
 * What this module is for:
 *   takeItem puts a prepared item on air with one press. It turns the item's field
 *   values into the data the graphic receives, hands that to the very same takeGraphic
 *   reducer a take by hand uses, stamps the new instance with the item's id (so the
 *   layer panel can name the item on air) and moves the rundown's cursor to the item
 *   after the one taken.
 *
 * What these tests prove:
 *   - The instance is exactly what a direct takeGraphic with the same data gives, plus
 *     `itemId`; it replaces what was on the same layer and leaves other layers alone.
 *   - The cursor moves to the item after the one taken, wherever it was before, and
 *     becomes null after the last item of the rundown.
 *   - The items slice, and the other rundown, are untouched.
 *   - An item that does not exist is refused; a refusal of takeGraphic itself (the
 *     item's graphic or layer is gone) comes back unchanged; an item with a field value
 *     the server cannot resolve yet is refused. Each has a pt-BR reason.
 *   - An item whose stored fields the graphic's data schema does not accept is refused
 *     at the take with INVALID_GRAPHIC_DATA (takeGraphic's own check, inherited), and
 *     what was on air and the cursor stay as they were.
 *
 * What these tests deliberately do not cover:
 *   - The auto-out that may follow the take; autoOut.test.ts covers it.
 *   - Every detail of resolving field values; resolveItemFields.test.ts covers it.
 *   - Every way data can break a graphic's schema; takeGraphicData.test.ts and
 *     graphicDataValidation.test.ts cover them. One case here shows items inherit it.
 */
import type { Graphic, Instance, Item, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockData,
  buildEnduroFinishItem,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildRaceDaySlicesWithRundown,
  buildTeam42LowerThirdTakenByHand,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/** Builds the main session's three items in their usual order: start, yellow, finish. */
function buildThreeEnduroItems(): Item[] {
  return [buildEnduroStartItem(0), buildYellowFlagItem(1), buildEnduroFinishItem(2)];
}

/** Builds the green flag clock already on program, taken by hand an hour earlier. */
function buildGreenFlagClockTakenByHand(): Instance {
  return {
    id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: buildEnduroClockData('green'),
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T13:00:00.000Z',
  };
}

describe('takeItem, the instance it puts on air', () => {
  it('gives the same instance as a direct takeGraphic with the same data, plus itemId', () => {
    // Arrange: the main session with three items, the green clock and a lower third on
    // air; and what a take by hand of the yellow flag clock gives on those same slices.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildThreeEnduroItems(),
      instances: [buildGreenFlagClockTakenByHand(), buildTeam42LowerThirdTakenByHand()],
    });
    const outcomeOfTakeByHand = reduceCommand(
      slicesBefore,
      {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: buildEnduroClockData('yellow'),
        target: 'program',
      },
      contextOfTheRundownCommand,
    );
    const instancesOfTakeByHand =
      outcomeOfTakeByHand.status === 'applied' ? outcomeOfTakeByHand.slices.instances : [];

    // Act: take the yellow flag item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-bandeira-amarela' },
      contextOfTheRundownCommand,
    );

    // Assert: the same instances as the take by hand, the new one also carrying itemId.
    expect(outcome.status, 'the item must be taken').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(instancesOfTakeByHand.length, 'the take by hand must leave two instances').toBe(2);
    expect(
      instancesAfter,
      'takeItem must give what takeGraphic gives, plus the item id on the new instance',
    ).toEqual([
      buildTeam42LowerThirdTakenByHand(),
      { ...instancesOfTakeByHand[1], itemId: 'item-bandeira-amarela' },
    ]);
  });

  it('puts the item on the program output with its resolved field values', () => {
    // Arrange: the main session with three items and nothing on air.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: buildThreeEnduroItems() });

    // Act: take the start item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: one instance, written out in full so the reader sees every field.
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(instancesAfter, 'the start item must be the one instance on air').toEqual([
      {
        id: contextOfTheRundownCommand.newInstanceId,
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: buildEnduroClockData('green'),
        currentStep: 0,
        status: 'loading',
        takenAt: '2026-10-09T14:32:05.000Z',
        itemId: 'item-largada-do-enduro',
      },
    ]);
  });
});

const cursorAfterTakeScenarios: Array<{
  name: string;
  cursorBefore: string | null;
  takenItemId: string;
  expectedCursorAfter: string | null;
}> = [
  // The scripted flow: the cursor item is taken and "next" becomes the following one.
  {
    name: 'moves the cursor from the first item to the second when the first is taken',
    cursorBefore: 'item-largada-do-enduro',
    takenItemId: 'item-largada-do-enduro',
    expectedCursorAfter: 'item-bandeira-amarela',
  },
  // The operator takes a row out of order with its button: the show goes on from there.
  {
    name: 'puts the cursor after the taken item even when the cursor was elsewhere',
    cursorBefore: 'item-largada-do-enduro',
    takenItemId: 'item-bandeira-amarela',
    expectedCursorAfter: 'item-chegada-do-enduro',
  },
  // Nothing follows the last item, so the cursor ends on nothing instead of wrapping
  // round to the top, where Space would fire the opening again by accident.
  {
    name: 'leaves the cursor on nothing after the last item is taken',
    cursorBefore: 'item-chegada-do-enduro',
    takenItemId: 'item-chegada-do-enduro',
    expectedCursorAfter: null,
  },
  // A take with the cursor on nothing still tells the rundown where the show is.
  {
    name: 'puts an empty cursor on the item after the one taken',
    cursorBefore: null,
    takenItemId: 'item-largada-do-enduro',
    expectedCursorAfter: 'item-bandeira-amarela',
  },
];

describe('takeItem and the cursor', () => {
  it.each(cursorAfterTakeScenarios)(
    '$name',
    ({ cursorBefore, takenItemId, expectedCursorAfter }) => {
      // Arrange: the main session with three items and the cursor of this scenario.
      const slicesBefore = buildRaceDaySlicesWithRundown({
        rundowns: [buildMainSessionRundown(cursorBefore), buildPodiumRundown(null)],
        items: buildThreeEnduroItems(),
      });

      // Act: take the item this scenario names.
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'takeItem', itemId: takenItemId },
        contextOfTheRundownCommand,
      );

      // Assert: the cursor is on the item after the one taken; the items are untouched.
      const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
      expect(slicesAfter?.rundowns, 'the cursor must be on the item after the one taken').toEqual([
        buildMainSessionRundown(expectedCursorAfter),
        buildPodiumRundown(null),
      ]);
      expect(slicesAfter?.items, 'taking an item must not change the items').toBe(
        slicesBefore.items,
      );
    },
  );
});

describe('takeItem, when it must be refused', () => {
  it('refuses an item that does not exist, with a pt-BR reason', () => {
    // Arrange: the main session with its three items.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: buildThreeEnduroItems() });

    // Act: take an item another operator has just deleted.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-volta-mais-rapida' },
      contextOfTheRundownCommand,
    );

    // Assert: refused with a stable code and the pt-BR reason.
    expect(outcome, 'an unknown item must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'ITEM_NOT_FOUND',
        message: 'O item "item-volta-mais-rapida" não existe; ele pode ter sido excluído.',
      },
    });
  });

  it('hands back the refusal of takeGraphic when the item graphic is no longer registered', () => {
    // Arrange: an item prepared for a standings table whose package was since removed.
    const standingsItem: Item = {
      ...buildEnduroStartItem(0),
      id: 'item-classificacao-geral',
      graphicId: 'classificacao-geral',
      layerId: 'fullscreen',
      label: 'Classificação geral',
    };
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [standingsItem] });

    // Act: take it.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-classificacao-geral' },
      contextOfTheRundownCommand,
    );

    // Assert: the very refusal a take by hand of that graphic gets.
    expect(outcome, 'the refusal must be the one takeGraphic gives').toEqual({
      status: 'refused',
      error: {
        code: 'GRAPHIC_NOT_FOUND',
        message: 'O gráfico "classificacao-geral" não está registrado.',
      },
    });
  });

  it('refuses an item whose stored fields the data schema of its graphic does not accept', () => {
    // Arrange: the race clock registered with its real data schema; the start item saved
    // with a negative clock time (createItem does not check field values against the
    // graphic, so such an item can be stored); the cursor on that item and the green
    // clock on air.
    const startItemWithNegativeTime: Item = {
      ...buildEnduroStartItem(0),
      fields: {
        ...buildEnduroStartItem(0).fields,
        referenceTimeMs: { kind: 'literal', value: -5000 },
      },
    };
    const raceClockWithItsDataSchema: Graphic = {
      id: 'race-clock',
      manifest: raceClockManifestForTests,
      defaultLayerId: 'clock',
      category: 'clock',
      thumbnailUrl: null,
      defaultFields: {},
    };
    const slicesBefore = {
      ...buildRaceDaySlicesWithRundown({
        rundowns: [buildMainSessionRundown('item-largada-do-enduro')],
        items: [startItemWithNegativeTime, buildYellowFlagItem(1)],
        instances: [buildGreenFlagClockTakenByHand()],
      }),
      graphics: [raceClockWithItsDataSchema],
    };
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: take the item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: the very refusal a take by hand with that data gets, naming the field, and
    // nothing changed: the green clock is still on air and the cursor is still on the item.
    expect(outcome, 'an item with data the graphic refuses must be refused at the take').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'Dados inválidos para o gráfico "race-clock": o campo "referenceTimeMs" tem um valor que o gráfico não aceita.',
      },
    });
    expect(
      slicesBefore,
      'a refused take must change nothing, the clock on air and the cursor included',
    ).toEqual(copyOfSlicesBefore);
  });

  it('refuses an item with a field value the server cannot resolve yet, naming M2', () => {
    // Arrange: an item whose session name is bound to a data source, which only M2 will
    // understand. Today's types allow only literals, so the test has to force it in and
    // call the reducer directly. Through the running server this cannot happen yet: the
    // command schema answers INVALID_COMMAND first, and a stored item like this one
    // stops the boot. The refusal is a guard kept ready for M2.
    const fieldsWithBinding = {
      ...buildEnduroStartItem(0).fields,
      sessionName: { kind: 'binding', sourceId: 'cronometragem', path: 'session.name' },
    } as unknown as ItemFields;
    const itemWithBinding: Item = { ...buildEnduroStartItem(0), fields: fieldsWithBinding };
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [itemWithBinding] });

    // Act: take it.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: refused, nothing half-resolved goes on air, and the message names M2.
    expect(outcome, 'a field the server cannot resolve must refuse the take').toEqual({
      status: 'refused',
      error: {
        code: 'UNSUPPORTED_FIELD_KIND',
        message:
          'O campo "sessionName" usa um valor do tipo "binding", que o servidor só vai ' +
          'saber resolver no marco M2 (BAJAOVRLAY-20). Por enquanto, preencha o campo com ' +
          'um valor literal.',
      },
    });
  });
});
