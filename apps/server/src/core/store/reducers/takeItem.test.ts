/**
 * The takeItem reducer (apps/server)
 *
 * What this module is for:
 *   takeItem puts a prepared item on air with one press. It turns the item's field
 *   values into the data the graphic receives, hands that, with the item's id, to the
 *   internal take step putGraphicOnOutput every take and preview ends in (which writes
 *   the id on the new instance, so the layer panel can name the item on air) and, when
 *   the item taken was the one the rundown's cursor was on, moves the cursor to the item
 *   after it.
 *
 * What these tests prove:
 *   - The instance is exactly what putGraphicOnOutput gives for the same data and the
 *     item's id; it replaces what was on the same layer and leaves other layers alone.
 *   - Taking the cursor item moves the cursor to the item after it, and to nothing after
 *     the last item of the rundown, which is then marked as played to its end
 *     (wasLastItemTakenAtCursor). No other take sets that mark.
 *   - Taking any other item (a row fired ad hoc) leaves the cursor exactly where it was,
 *     an empty cursor included, and hands back the very same rundowns array.
 *   - The items slice, and the other rundown, are untouched.
 *   - An item that does not exist is refused; a refusal of the take step itself (the
 *     item's graphic or layer is gone) comes back unchanged; an item with a field value
 *     the server cannot resolve yet is refused. Each has a pt-BR reason.
 *   - An item whose stored fields the graphic's data schema does not accept is refused
 *     at the take with INVALID_GRAPHIC_DATA (the take step's own check, inherited), and
 *     what was on air and the cursor stay as they were.
 *
 * What these tests deliberately do not cover:
 *   - The auto-out that may follow the take; autoOut.test.ts covers it.
 *   - Every detail of resolving field values; resolveItemFields.test.ts covers it. A field
 *     stamped at the take: takeItemTakeTime.test.ts. A cleared one: takeItemClearedField.test.ts.
 *   - Every way data can break a graphic's schema; putGraphicOnOutputData.test.ts and
 *     graphicDataValidation.test.ts cover them. One case here shows items inherit it.
 */
import type { Graphic, Instance, Item, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import { putGraphicOnOutput } from './putGraphicOnOutput.js';
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

/** Builds the green flag clock already on program, put on air an hour earlier. */
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
  it('gives the same instance as the take step given the same data and the item id', () => {
    // Arrange: the main session with three items, the green clock and a lower third on
    // air; and what the take step gives for the yellow flag clock on those same slices.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildThreeEnduroItems(),
      instances: [buildGreenFlagClockTakenByHand(), buildTeam42LowerThirdTakenByHand()],
    });
    const outcomeOfTheTakeStep = putGraphicOnOutput(
      slicesBefore,
      {
        graphicId: 'race-clock',
        layerId: 'clock',
        data: buildEnduroClockData('yellow'),
        target: 'program',
        takeTimeFieldKeys: [],
        itemId: 'item-bandeira-amarela',
      },
      contextOfTheRundownCommand,
    );
    const instancesOfTheTakeStep =
      outcomeOfTheTakeStep.status === 'applied' ? outcomeOfTheTakeStep.slices.instances : [];

    // Act: take the yellow flag item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-bandeira-amarela' },
      contextOfTheRundownCommand,
    );

    // Assert: the same instances as the take step gives, the new one carrying itemId.
    expect(outcome.status, 'the item must be taken').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(instancesOfTheTakeStep.length, 'the take step must leave two instances').toBe(2);
    expect(
      instancesAfter,
      'takeItem must give what the take step gives, the item id on the new instance',
    ).toEqual(instancesOfTheTakeStep);
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
  /** true when the rundown must come out marked as played to its end. */
  expectedIsPlayedToItsEnd: boolean;
}> = [
  // The scripted flow: taking the cursor item still advances "next" to the following one.
  {
    name: 'moves the cursor from the first item to the second when the cursor item is taken',
    cursorBefore: 'item-largada-do-enduro',
    takenItemId: 'item-largada-do-enduro',
    expectedCursorAfter: 'item-bandeira-amarela',
    expectedIsPlayedToItsEnd: false,
  },
  // The operator fires another row ad hoc with its button (a yellow flag nobody
  // planned): the plan must not move, so Space still fires the start afterwards.
  {
    name: 'leaves the cursor where it was when an item other than the cursor item is taken',
    cursorBefore: 'item-largada-do-enduro',
    takenItemId: 'item-bandeira-amarela',
    expectedCursorAfter: 'item-largada-do-enduro',
    expectedIsPlayedToItsEnd: false,
  },
  // The same, with the ad hoc row above the cursor: taking an earlier item again must
  // not pull the plan backwards either.
  {
    name: 'leaves the cursor where it was when an item before the cursor item is taken',
    cursorBefore: 'item-chegada-do-enduro',
    takenItemId: 'item-largada-do-enduro',
    expectedCursorAfter: 'item-chegada-do-enduro',
    expectedIsPlayedToItsEnd: false,
  },
  // Nothing follows the last item, so the cursor ends on nothing instead of wrapping
  // round to the top, where Space would fire the opening again by accident. The rundown
  // is marked as played to its end, so the control page can say so.
  {
    name: 'leaves the cursor on nothing, and marks the rundown as played to its end, after the last item is taken as the cursor item',
    cursorBefore: 'item-chegada-do-enduro',
    takenItemId: 'item-chegada-do-enduro',
    expectedCursorAfter: null,
    expectedIsPlayedToItsEnd: true,
  },
  // With the cursor on nothing no item is the cursor item, so a take is always ad hoc
  // and the cursor stays on nothing; nothing was played to its end, so there is no mark.
  {
    name: 'leaves an empty cursor empty, and the rundown unmarked, whichever item is taken',
    cursorBefore: null,
    takenItemId: 'item-largada-do-enduro',
    expectedCursorAfter: null,
    expectedIsPlayedToItsEnd: false,
  },
  // The last item fired ad hoc with the cursor elsewhere: the plan did not end, no mark.
  {
    name: 'does not mark the rundown when the last item is taken while the cursor is on another item',
    cursorBefore: 'item-largada-do-enduro',
    takenItemId: 'item-chegada-do-enduro',
    expectedCursorAfter: 'item-largada-do-enduro',
    expectedIsPlayedToItsEnd: false,
  },
];

describe('takeItem and the cursor', () => {
  it.each(cursorAfterTakeScenarios)(
    '$name',
    ({ cursorBefore, takenItemId, expectedCursorAfter, expectedIsPlayedToItsEnd }) => {
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

      // Assert: the take happened, the cursor is where this scenario says, items untouched.
      const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
      const expectedMainRundownAfter = expectedIsPlayedToItsEnd
        ? { ...buildMainSessionRundown(expectedCursorAfter), wasLastItemTakenAtCursor: true }
        : buildMainSessionRundown(expectedCursorAfter);
      expect(
        slicesAfter?.instances.map((instance) => instance.itemId),
        'the item named must be the one on air, whatever happens to the cursor',
      ).toEqual([takenItemId]);
      expect(
        slicesAfter?.rundowns,
        'the cursor must move on only when the item taken was the cursor item, and only the last item taken at the cursor marks the rundown as played to its end',
      ).toEqual([expectedMainRundownAfter, buildPodiumRundown(null)]);
      expect(slicesAfter?.items, 'taking an item must not change the items').toBe(
        slicesBefore.items,
      );
    },
  );

  it('hands back the very same rundowns when an item other than the cursor item is taken', () => {
    // Arrange: the main session with three items and the cursor on the start.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: buildThreeEnduroItems(),
    });

    // Act: fire the yellow flag row, which is not the cursor item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-bandeira-amarela' },
      contextOfTheRundownCommand,
    );

    // Assert: the rundowns are the same array, not an equal copy. The store tells a
    // changed slice from an unchanged one by exactly that, so a copy would be saved and
    // sent to every page for nothing.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(rundownsAfter, 'an ad hoc take must not touch the rundowns at all').toBe(
      slicesBefore.rundowns,
    );
  });
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

  it('hands back the refusal of the take step when the item graphic is no longer registered', () => {
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

    // Assert: the very refusal the take step gives for that graphic.
    expect(outcome, 'the refusal must be the one the take step gives').toEqual({
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

    // Assert: the very refusal the take step gives for that data, naming the field, and
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

  it('refuses an item with a field value the server cannot resolve, naming its kind', () => {
    // Arrange: an item whose session name is a formula, a kind no server knows (rule 5
    // forbids expressions anyway). The types do not allow it, so the test forces it in and
    // calls the reducer directly. Through the running server this cannot happen: the
    // command schema answers INVALID_COMMAND first, and a stored item like this one stops
    // the boot. The refusal is a guard (entity references had it until BAJAOVRLAY-19).
    const fieldsWithAFormula = {
      ...buildEnduroStartItem(0).fields,
      sessionName: { kind: 'formula', expression: 'session.sessionName.toUpperCase()' },
    } as unknown as ItemFields;
    const itemWithAFormula: Item = { ...buildEnduroStartItem(0), fields: fieldsWithAFormula };
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [itemWithAFormula] });

    // Act: take it.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: refused, nothing half-resolved goes on air, and the message names the kind.
    expect(outcome, 'a field the server cannot resolve must refuse the take').toEqual({
      status: 'refused',
      error: {
        code: 'UNSUPPORTED_FIELD_KIND',
        message:
          'O campo "sessionName" usa um valor do tipo "formula", que este servidor não ' +
          'sabe resolver. Preencha o campo com um valor digitado, de uma fonte de dados ' +
          'ou dos cadastros.',
      },
    });
  });
});
