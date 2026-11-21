import { areJsonValuesEqual, type ItemFields } from '@bajaovrlay/shared';

import { buildItemFieldsOfCarPicks, type CarPickOfGroup } from '@/features/schemaForm';
import { ptBR } from '@/i18n/ptBR';
import {
  useReadServerStateNow,
  useSendCommandAndReadItsRefusal,
} from '@/state/ControlPageStateProvider';

/**
 * How a save of the picks ended: stored, saying whether the item changed (the same pair
 * again stores nothing), or why not, in pt-BR.
 */
export type OutcomeOfCarPicksSave =
  { status: 'saved'; hasChangedTheItem: boolean } | { status: 'refused'; message: string };

/**
 * Of the fields the picks write, only those that differ from what the item stores: the
 * server merges updateItemFields key by key, so the rest of the item is left as it is, and
 * the same pair picked again sends nothing at all.
 */
function keepOnlyFieldsThatChange(
  storedFields: ItemFields,
  fieldsOfThePicks: ItemFields,
): ItemFields {
  const fieldsThatChange: ItemFields = {};
  for (const [fieldKey, fieldOfThePick] of Object.entries(fieldsOfThePicks)) {
    if (!areJsonValuesEqual(storedFields[fieldKey], fieldOfThePick)) {
      fieldsThatChange[fieldKey] = fieldOfThePick;
    }
  }
  return fieldsThatChange;
}

/**
 * Returns the function "Escolher carros" (BAJAOVRLAY-82) saves its picks with: each car
 * group's fields as the editor's picker writes them, sent as one `updateItemFields` with
 * only the fields that change. The item is read from the store at the press, not as the
 * box opened, so a change another console saved meanwhile is compared with, not undone.
 * Dados may send it (the server's rule); the take or preview that follows is the
 * Produtor's, and is the caller's.
 */
export function useSaveCarPicksIntoItem(): (
  itemId: string,
  dataSchema: unknown,
  picksOfGroups: CarPickOfGroup[],
) => Promise<OutcomeOfCarPicksSave> {
  const readServerStateNow = useReadServerStateNow();
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();

  return async (itemId, dataSchema, picksOfGroups) => {
    const itemNow = readServerStateNow().items.find((candidate) => candidate.id === itemId);
    if (itemNow === undefined) {
      return { status: 'refused', message: ptBR.quickCarPick.itemGone };
    }
    const fieldsOfThePicks = buildItemFieldsOfCarPicks(dataSchema, picksOfGroups);
    if (fieldsOfThePicks.status === 'problem') {
      return { status: 'refused', message: fieldsOfThePicks.message };
    }
    const fieldsThatChange = keepOnlyFieldsThatChange(itemNow.fields, fieldsOfThePicks.fields);
    if (Object.keys(fieldsThatChange).length === 0) {
      return { status: 'saved', hasChangedTheItem: false };
    }
    const refusal = await sendCommandAndReadItsRefusal({
      type: 'updateItemFields',
      itemId,
      fields: fieldsThatChange,
    });
    return refusal === null
      ? { status: 'saved', hasChangedTheItem: true }
      : { status: 'refused', message: refusal };
  };
}
