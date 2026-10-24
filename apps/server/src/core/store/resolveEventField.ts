import {
  type CommandError,
  type EventFieldValue,
  type Graphic,
  type InboxEventPayload,
  ptBREventInbox,
  readEventFieldFromPayload,
} from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { readTitleOfField } from './itemBindingFields.js';

/** What one event field gives: its key and value, nothing (left out), or why not. */
export type EventFieldOutcome =
  | { status: 'filled'; keysAndValues: Array<[string, unknown]> }
  | { status: 'refused'; error: CommandError };

/**
 * One field filled by the event the item shows (BAJAOVRLAY-44): the payload's value at
 * the field's path. With no event at all (a take of the item by itself: Space, a shortcut
 * button, a macro step), the item is refused as a template (ITEM_FILLED_BY_EVENT): it has
 * nothing to show. An event that lacks the value leaves an optional field out and refuses
 * a required one (EVENT_FIELD_NOT_FILLED, the field's title first).
 */
export function resolveEventField(
  fieldKey: string,
  eventField: EventFieldValue,
  eventPayload: InboxEventPayload | undefined,
  graphic: Graphic | undefined,
  requiredFieldKeys: string[],
): EventFieldOutcome {
  if (eventPayload === undefined) {
    return {
      status: 'refused',
      error: { code: 'ITEM_FILLED_BY_EVENT', message: ptBR.eventErrors.itemFilledByAnEvent },
    };
  }
  const value = readEventFieldFromPayload(eventField, eventPayload);
  if (value !== undefined) {
    return { status: 'filled', keysAndValues: [[fieldKey, value]] };
  }
  if (!requiredFieldKeys.includes(fieldKey)) {
    return { status: 'filled', keysAndValues: [] };
  }
  const fieldTitle = graphic === undefined ? fieldKey : readTitleOfField(graphic, fieldKey);
  const pathLabel = ptBREventInbox.payloadPathLabels[eventField.path];
  return {
    status: 'refused',
    error: {
      code: 'EVENT_FIELD_NOT_FILLED',
      message: ptBR.eventErrors.eventFieldNotFilled(fieldTitle, pathLabel),
    },
  };
}
