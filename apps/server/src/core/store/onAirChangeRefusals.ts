// The refusals about instances without an item and about saving what was changed on air
// into the item (BAJAOVRLAY-37), each with its stable code and pt-BR message.
import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/**
 * The refusal for saving into the item of an instance that has none: one put on air by
 * hand before BAJAOVRLAY-37. The message points at "Salvar como item", which Camadas
 * offers on such a row.
 */
export function refuseInstanceWithoutItem(layerName: string): CommandError {
  return {
    code: 'INSTANCE_WITHOUT_ITEM',
    message: ptBR.onAirChangeErrors.instanceWithoutItem(layerName),
  };
}

/**
 * The refusal for sending to air a preview that has no item. No command makes one any
 * more and previews are dropped at every boot, so this guards the rule "everything on air
 * comes from an item" rather than a case an operator can reach.
 */
export function refusePreviewWithoutItem(layerName: string): CommandError {
  return {
    code: 'INSTANCE_WITHOUT_ITEM',
    message: ptBR.onAirChangeErrors.previewWithoutItem(layerName),
  };
}

/** The refusal for saving into the item when nothing was changed on air since the take. */
export function refuseNothingChangedOnAir(itemLabel: string): CommandError {
  return {
    code: 'NOTHING_CHANGED_ON_AIR',
    message: ptBR.onAirChangeErrors.nothingChangedOnAir(itemLabel),
  };
}
