/**
 * The createItem reducer (apps/server)
 *
 * What this module is for:
 *   An item is a prepared use of a graphic (graphic, layer, field values, label) that
 *   the operator sets up before the session. createItem adds one to a rundown, at the
 *   end or at a position the command names, and keeps the rundown numbered 0, 1, 2, ...
 *   with no gaps.
 *
 * What these tests prove:
 *   - A new item goes to the end of its rundown when the command names no position.
 *   - A named position inserts the item there and moves the items after it down by one;
 *     a position past the end means the end.
 *   - The new item carries exactly what the command said, with the id the store made.
 *   - The first item of an empty rundown gets the cursor; any later one leaves the cursor
 *     where it was.
 *   - Items of another rundown, and every other slice, are handed back untouched.
 *   - An unknown rundown, layer or graphic is refused with a pt-BR reason.
 *
 * What these tests deliberately do not cover:
 *   - The command's shape (label not empty, order a whole number); the shared schema
 *     tests in packages/shared/src/rundown cover it.
 *   - Whether the typed field values suit the graphic; that is only checked at the take.
 *   - Which field may say takeTime; createItemTakeTimeField.test.ts.
 */
import type { Command, CreateItemCommand, Item, ItemHome } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockFields,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildPodiumTeamItem,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
  mainSessionRundownId,
  readLabelsAndOrdersOfRundown,
} from './rundownSlices.testSupport.js';

/** Builds the createItem for "Chegada do enduro" at the given position (or at the end). */
function buildCreateEnduroFinishCommand(order?: number): CreateItemCommand {
  const command: CreateItemCommand = {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: mainSessionRundownId },
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: buildEnduroClockFields('checkered'),
    label: 'Chegada do enduro',
    color: 'neutral',
    notes: '',
  };
  if (order !== undefined) {
    command.order = order;
  }
  return command;
}

const positionScenarios: Array<{
  name: string;
  orderInCommand: number | undefined;
  expectedRundown: Array<[string, number]>;
}> = [
  // The usual case: the operator presses "+ Item" and the item lands at the bottom.
  {
    name: 'appends the item at the end when the command names no position',
    orderInCommand: undefined,
    expectedRundown: [
      ['Largada do enduro', 0],
      ['Bandeira amarela', 1],
      ['Chegada do enduro', 2],
    ],
  },
  // Inserting at the top is the case where every existing item must move down.
  {
    name: 'inserts the item at position 0 and moves both existing items down',
    orderInCommand: 0,
    expectedRundown: [
      ['Chegada do enduro', 0],
      ['Largada do enduro', 1],
      ['Bandeira amarela', 2],
    ],
  },
  // Inserting in the middle: the item before stays, only the item after moves.
  {
    name: 'inserts the item at position 1 and moves only the item after it',
    orderInCommand: 1,
    expectedRundown: [
      ['Largada do enduro', 0],
      ['Chegada do enduro', 1],
      ['Bandeira amarela', 2],
    ],
  },
  // A position past the end must not leave a gap in the numbering.
  {
    name: 'puts the item at the end when the position is past the end',
    orderInCommand: 9,
    expectedRundown: [
      ['Largada do enduro', 0],
      ['Bandeira amarela', 1],
      ['Chegada do enduro', 2],
    ],
  },
];

describe('createItem, choosing the position of the new item', () => {
  it.each(positionScenarios)('$name', ({ orderInCommand, expectedRundown }) => {
    // Arrange: the main session with the start and the yellow flag already prepared.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [buildEnduroStartItem(0), buildYellowFlagItem(1)],
    });

    // Act: create "Chegada do enduro" at the position this scenario names.
    const outcome = reduceCommand(
      slicesBefore,
      buildCreateEnduroFinishCommand(orderInCommand),
      contextOfTheRundownCommand,
    );

    // Assert: the rundown reads as expected, numbered from 0 with no gaps.
    expect(outcome.status, 'the item must be created').toBe('applied');
    const itemsAfter = outcome.status === 'applied' ? outcome.slices.items : undefined;
    expect(
      readLabelsAndOrdersOfRundown(itemsAfter, mainSessionRundownId),
      'the rundown must hold the three items in this order, numbered 0, 1, 2',
    ).toEqual(expectedRundown);
  });
});

describe('createItem, what the new item holds', () => {
  it('carries exactly what the command said, with the id the store made', () => {
    // Arrange: an empty main session, and a create with colour, notes and auto-out.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [] });
    const createWithEverything: Command = {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: mainSessionRundownId },
      graphicId: 'race-clock',
      layerId: 'clock',
      fields: buildEnduroClockFields('red'),
      label: 'Bandeira vermelha',
      color: 'danger',
      notes: 'Só com ordem da direção de prova.',
      autoOutAfterMs: 15_000,
    };

    // Act: create it.
    const outcome = reduceCommand(slicesBefore, createWithEverything, contextOfTheRundownCommand);

    // Assert: one item, equal to the command plus the id and position 0.
    const expectedItem: Item = {
      id: contextOfTheRundownCommand.newItemId,
      home: { kind: 'rundown', rundownId: mainSessionRundownId },
      order: 0,
      graphicId: 'race-clock',
      layerId: 'clock',
      fields: buildEnduroClockFields('red'),
      label: 'Bandeira vermelha',
      color: 'danger',
      notes: 'Só com ordem da direção de prova.',
      autoOutAfterMs: 15_000,
    };
    const itemsAfter = outcome.status === 'applied' ? outcome.slices.items : undefined;
    expect(itemsAfter, 'the new item must be exactly what the command described').toEqual([
      expectedItem,
    ]);
  });

  it('leaves autoOutAfterMs out of the item when the command has none', () => {
    // Arrange: an empty main session.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [] });

    // Act: create an item that stays on air until cleared.
    const outcome = reduceCommand(
      slicesBefore,
      buildCreateEnduroFinishCommand(),
      contextOfTheRundownCommand,
    );

    // Assert: the item has no autoOutAfterMs key at all (not an `undefined` one).
    const newItem = outcome.status === 'applied' ? outcome.slices.items[0] : undefined;
    expect(
      newItem !== undefined && 'autoOutAfterMs' in newItem,
      'an item with no auto-out must not carry the autoOutAfterMs key',
    ).toBe(false);
  });
});

describe('createItem and the cursor', () => {
  it('puts the cursor on the first item of an empty rundown', () => {
    // Arrange: an empty main session, its cursor on nothing.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [] });

    // Act: create the first item.
    const outcome = reduceCommand(
      slicesBefore,
      buildCreateEnduroFinishCommand(),
      contextOfTheRundownCommand,
    );

    // Assert: the main session's cursor is on the new item; the podium's is untouched.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(rundownsAfter, 'the first item of a rundown must become its next item').toEqual([
      buildMainSessionRundown(contextOfTheRundownCommand.newItemId),
      buildPodiumRundown(null),
    ]);
  });

  it('leaves the cursor where it was when the rundown already has items', () => {
    // Arrange: a main session with two items and its cursor on nothing, as after the
    // operator took the last item.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [buildEnduroStartItem(0), buildYellowFlagItem(1)],
    });

    // Act: create a third item.
    const outcome = reduceCommand(
      slicesBefore,
      buildCreateEnduroFinishCommand(),
      contextOfTheRundownCommand,
    );

    // Assert: the rundowns slice is the very same array, so it is not saved or broadcast.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(rundownsAfter, 'a later item must not move the cursor').toBe(slicesBefore.rundowns);
  });
});

describe('createItem and everything it must not touch', () => {
  it('hands back the other rundown item and the other slices untouched', () => {
    // Arrange: one item in each rundown; the podium item is frozen so a change throws.
    const podiumItem = Object.freeze(buildPodiumTeamItem(0));
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: [buildEnduroStartItem(0), podiumItem],
    });

    // Act: insert a new item at the top of the main session.
    const outcome = reduceCommand(
      slicesBefore,
      buildCreateEnduroFinishCommand(0),
      contextOfTheRundownCommand,
    );

    // Assert: the podium item is the same object, and layers, graphics and instances are
    // the same arrays.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.items.find((item) => item.id === 'item-podio-baja-ufpr'),
      'an item of another rundown must be the very same object',
    ).toBe(podiumItem);
    expect(slicesAfter?.instances, 'createItem must not change what is on air').toBe(
      slicesBefore.instances,
    );
    expect(slicesAfter?.layers, 'createItem must not change the layers').toBe(slicesBefore.layers);
    expect(slicesAfter?.graphics, 'createItem must not change the graphics').toBe(
      slicesBefore.graphics,
    );
  });
});

const refusedCreateScenarios: Array<{
  name: string;
  changedPart: Partial<{ home: ItemHome; layerId: string; graphicId: string }>;
  expectedError: { code: string; message: string };
}> = [
  // An item in a rundown nobody can open would be lost from the operator's view.
  {
    name: 'refuses an item for a rundown that does not exist',
    changedPart: { home: { kind: 'rundown', rundownId: 'treino-livre' } },
    expectedError: { code: 'RUNDOWN_NOT_FOUND', message: 'O rundown "treino-livre" não existe.' },
  },
  // Better to say so now than when the operator presses Space on air.
  {
    name: 'refuses an item on a layer that does not exist',
    changedPart: { layerId: 'placar' },
    expectedError: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
  },
  // A graphic that is not registered has no package the renderer could load.
  {
    name: 'refuses an item of a graphic that is not registered',
    changedPart: { graphicId: 'classificacao-geral' },
    expectedError: {
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "classificacao-geral" não está registrado.',
    },
  },
];

describe('createItem, when it must be refused', () => {
  it.each(refusedCreateScenarios)('$name', ({ changedPart, expectedError }) => {
    // Arrange: the main session with one item, and a create with one wrong reference.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [buildEnduroStartItem(0)] });
    const createWithWrongReference = { ...buildCreateEnduroFinishCommand(), ...changedPart };

    // Act: try to create it.
    const outcome = reduceCommand(
      slicesBefore,
      createWithWrongReference,
      contextOfTheRundownCommand,
    );

    // Assert: refused with a stable code and the pt-BR reason.
    expect(outcome, 'the create must be refused with the pt-BR reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
