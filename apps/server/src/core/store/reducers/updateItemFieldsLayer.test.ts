/**
 * updateItemFields and the layer of an item (apps/server)
 *
 * What this module is for:
 *   "Editar item" changes a saved item, which counts for the next takes; it never moves
 *   what is already on air ("Edição rápida" is for that). Since BAJAOVRLAY-36 the command
 *   also carries an optional `layerId` (its name stays updateItemFields, to avoid churn).
 *   The graphic of an item can never change: the command schema has no graphicId, and
 *   one sent anyway is dropped at validation.
 *
 * What these tests prove:
 *   - A layer change is accepted and changes the item's layer only.
 *   - An instance on air from that item stays on its old layer, untouched.
 *   - The next take of the item goes to the new layer, beside the old instance.
 *   - Naming the layer the item already has hands back the very same slices.
 *   - A layer that does not exist is refused with LAYER_NOT_FOUND.
 *   - A graphicId sent through the command schema changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - The other parts of the command; updateItemFields.test.ts covers them.
 *   - The schema's own rules for layerId; itemCommands.test.ts in packages/shared.
 */
import { CommandSchema, type Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockData,
  buildEnduroStartItem,
  buildRaceDaySlicesWithRundown,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/** Builds "Largada do enduro" on air on the clock layer, taken from its item at 14:00. */
function buildStartItemOnAir(): Instance {
  return {
    id: '5f1b3d7e-9a2c-4e6f-8b0d-1c3e5a7f9b24',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: buildEnduroClockData('green'),
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:00:00.000Z',
    itemId: 'item-largada-do-enduro',
  };
}

/** Builds the race day with the start item saved and on air on the clock layer. */
function buildRaceDayWithTheStartItemOnAir() {
  return buildRaceDaySlicesWithRundown({
    items: [buildEnduroStartItem(0)],
    instances: [buildStartItemOnAir()],
  });
}

describe('updateItemFields with a new layer', () => {
  it('moves the item to the new layer and leaves the instance on air where it is', () => {
    // Arrange: the start item on air on the clock layer.
    const slicesBefore = buildRaceDayWithTheStartItemOnAir();

    // Act: in "Editar item", move the item to the fullscreen layer.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'updateItemFields', itemId: 'item-largada-do-enduro', layerId: 'fullscreen' },
      contextOfTheRundownCommand,
    );

    // Assert: the item says fullscreen and nothing else changed on it; the instance on air
    // is the very same array, still on the clock layer.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.items, 'only the layer of the item may change').toEqual([
      { ...buildEnduroStartItem(0), layerId: 'fullscreen' },
    ]);
    expect(slicesAfter?.instances, 'the graphic on air must not move').toBe(slicesBefore.instances);
  });

  it('sends the next take of the item to the new layer, beside the old instance', () => {
    // Arrange: the start item on air on the clock layer, then moved to fullscreen.
    const slicesAtTheEdit = reduceCommand(
      buildRaceDayWithTheStartItemOnAir(),
      { type: 'updateItemFields', itemId: 'item-largada-do-enduro', layerId: 'fullscreen' },
      contextOfTheRundownCommand,
    );
    const slicesBefore = slicesAtTheEdit.status === 'applied' ? slicesAtTheEdit.slices : undefined;
    if (slicesBefore === undefined) {
      throw new Error('the layer change must be accepted for this test to mean anything');
    }

    // Act: take the item again.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: the old instance is still on the clock layer, the new one is on fullscreen.
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(
      instancesAfter?.map((instance) => [instance.layerId, instance.itemId]),
      'the next take must use the new layer and leave the old instance alone',
    ).toEqual([
      ['clock', 'item-largada-do-enduro'],
      ['fullscreen', 'item-largada-do-enduro'],
    ]);
  });

  it('hands back the very same slices when the layer named is the one the item has', () => {
    // Arrange: the start item, on the clock layer.
    const slicesBefore = buildRaceDayWithTheStartItemOnAir();

    // Act: save the editor with the clock layer still chosen.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'updateItemFields', itemId: 'item-largada-do-enduro', layerId: 'clock' },
      contextOfTheRundownCommand,
    );

    // Assert: nothing to save, log or broadcast.
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'an unchanged layer must leave no trace',
    ).toBe(slicesBefore);
  });

  it('refuses a layer that does not exist, changing nothing', () => {
    // Arrange: the start item, on the clock layer.
    const slicesBefore = buildRaceDayWithTheStartItemOnAir();

    // Act: move the item to a layer nobody defined.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'updateItemFields', itemId: 'item-largada-do-enduro', layerId: 'placar' },
      contextOfTheRundownCommand,
    );

    // Assert: refused in pt-BR with the code every layer command uses for this mistake.
    expect(outcome, 'a layer that does not exist must be refused').toEqual({
      status: 'refused',
      error: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
    });
  });
});

describe('updateItemFields and the graphic of an item', () => {
  it('cannot change the graphic: a graphicId is dropped before the reducer sees it', () => {
    // Arrange: the start item, and an update that tries to make it a team lower third.
    const slicesBefore = buildRaceDayWithTheStartItemOnAir();
    const updateTryingToChangeTheGraphic = CommandSchema.parse({
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      graphicId: 'team-lower-third',
    });

    // Act: run the update as the store would, after validation.
    const outcome = reduceCommand(
      slicesBefore,
      updateTryingToChangeTheGraphic,
      contextOfTheRundownCommand,
    );

    // Assert: the very same slices: the item is still the race clock.
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'an item must keep its graphic for life',
    ).toBe(slicesBefore);
  });
});
