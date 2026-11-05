import type { CommandError, Item, ItemFields, ProgramHistoryShown } from '@bajaovrlay/shared';

import { ptBR } from '../../messages/ptBR.js';
import { reduceClearLayer } from '../reducers/clearLayer.js';
import { putThisItemOnOutput } from '../reducers/putItemOnOutput.js';
import type { ReducerContext, SlicesChangedByCommands } from '../reducers/reducerTypes.js';

/** What putting back one layer gives: the new slices, or why it cannot be done. */
export type PutBackOutcome =
  | { status: 'applied'; slices: SlicesChangedByCommands }
  | { status: 'refused'; error: CommandError };

/**
 * Puts back on a layer's program output what the history says it showed. "vazio" clears
 * the program output (a preview on the layer stays, as after an auto-out). An item is
 * taken again through the take's own steps (putThisItemOnOutput): bound, library and
 * take-time fields are read now, the typed values come back as literal fields, on the
 * layer it was on even if the item has moved since, and the item's own "alterado no ar"
 * list and an event's time on air are carried back to the new instance. The rundown's
 * cursor is not moved: an undo is not "next". `context.newInstanceId` is the id the new
 * instance gets. The history itself is left alone; the caller pops it.
 * Refused, with the item's name, when the item was deleted since or its graphic is no
 * longer listed, and for anything a take of it would be refused for.
 */
export function putBackWhatLayerShowed(
  slices: SlicesChangedByCommands,
  layerId: string,
  shownBefore: ProgramHistoryShown,
  context: ReducerContext,
): PutBackOutcome {
  if (shownBefore.kind === 'empty') {
    const clearOutcome = reduceClearLayer(slices, {
      type: 'clearLayer',
      layerId,
      target: 'program',
    });
    if (clearOutcome.status === 'refused') {
      return clearOutcome;
    }
    return { status: 'applied', slices: clearOutcome.slices };
  }

  const item = slices.items.find((candidate) => candidate.id === shownBefore.itemId);
  if (item === undefined) {
    return {
      status: 'refused',
      error: {
        code: 'ITEM_NOT_FOUND',
        message: ptBR.programHistoryErrors.itemDeletedSince(shownBefore.itemLabel),
      },
    };
  }
  const isGraphicListed = slices.graphics.some((graphic) => graphic.id === item.graphicId);
  if (!isGraphicListed) {
    return {
      status: 'refused',
      error: {
        code: 'GRAPHIC_NOT_FOUND',
        message: ptBR.programHistoryErrors.graphicNoLongerListed(
          item.graphicId,
          shownBefore.itemLabel,
        ),
      },
    };
  }

  const itemAsItWasOnAir: Item = {
    ...item,
    layerId,
    fields: writeTypedValuesAsLiteralFields(item.fields, shownBefore.typedValues),
  };
  const takeOutcome = putThisItemOnOutput(slices, itemAsItWasOnAir, 'program', context);
  if (takeOutcome.status === 'refused') {
    return takeOutcome;
  }
  const instancesAfter = takeOutcome.slices.instances.map((instance) => {
    if (instance.id !== context.newInstanceId) {
      return instance;
    }
    const instanceAsItWas = { ...instance };
    if (shownBefore.fieldsChangedOnAir !== undefined) {
      instanceAsItWas.fieldsChangedOnAir = shownBefore.fieldsChangedOnAir;
    }
    if (shownBefore.autoOutAfterMs !== undefined) {
      instanceAsItWas.autoOutAfterMs = shownBefore.autoOutAfterMs;
    }
    return instanceAsItWas;
  });
  return { status: 'applied', slices: { ...takeOutcome.slices, instances: instancesAfter } };
}

/**
 * The item's fields with each typed value written over it as a literal, so the take puts
 * that value on air; a null literal is "no value", which the take leaves out of the data.
 */
function writeTypedValuesAsLiteralFields(
  itemFields: ItemFields,
  typedValues: Record<string, unknown>,
): ItemFields {
  const fieldsAsTheyWereOnAir: ItemFields = { ...itemFields };
  for (const [fieldKey, value] of Object.entries(typedValues)) {
    fieldsAsTheyWereOnAir[fieldKey] = { kind: 'literal', value };
  }
  return fieldsAsTheyWereOnAir;
}
