import {
  type CommandError,
  isItemFilledByAnEvent,
  readSampleEventPayload,
} from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import type { EventFillOfItem } from '../../core/store/reducers/putItemOnOutput.js';
import type { SlicesChangedByCommands } from '../../core/store/reducers/reducerTypes.js';

/** What fills a previewed item: an event's payload, a sample, nothing, or why not. */
export type EventFillOfPreviewChoice =
  | { status: 'chosen'; eventFill: EventFillOfItem | undefined }
  | { status: 'refused'; error: CommandError };

/**
 * What fills an item's event fields in "Prévia" (previewItem, BAJAOVRLAY-44):
 * - with an event named ("Prévia" in the Eventos tab): that event's payload, its id and its
 *   rule's duration, so "Tomar" puts the event itself on air; an event the inbox does not
 *   hold is refused (EVENT_NOT_FOUND);
 * - an item filled by events, with no event named ("Prévia" of the item): the sample event
 *   of the kind of the first rule naming the item (an incident's when none does), with no
 *   id, so the operator sees the look and "Tomar" is refused;
 * - any other item: nothing, a preview as before.
 */
export function chooseEventFillOfPreview(
  slices: SlicesChangedByCommands,
  itemId: string,
  eventId: string | undefined,
): EventFillOfPreviewChoice {
  if (eventId !== undefined) {
    const event = slices.events.find((candidate) => candidate.eventId === eventId);
    if (event === undefined) {
      return {
        status: 'refused',
        error: { code: 'EVENT_NOT_FOUND', message: ptBR.eventErrors.eventNotFound },
      };
    }
    const rule = slices.eventRules.find((candidate) => candidate.kind === event.kind);
    const eventFill: EventFillOfItem = { payload: event.payload, eventId: event.eventId };
    if (rule !== undefined) {
      eventFill.autoOutAfterMs = rule.durationMs;
    }
    return { status: 'chosen', eventFill };
  }

  const item = slices.items.find((candidate) => candidate.id === itemId);
  if (item === undefined || !isItemFilledByAnEvent(item.fields)) {
    return { status: 'chosen', eventFill: undefined };
  }
  const kindOfTheItem =
    slices.eventRules.find((rule) => rule.itemId === itemId)?.kind ?? 'newIncident';
  return { status: 'chosen', eventFill: { payload: readSampleEventPayload(kindOfTheItem) } };
}
