import { z } from 'zod';

import { listValueTypesThatFitDataSchemaField } from '../bindings/bindingFitsGraphicField.js';
import type { BindableValueType } from '../dataShapes/bindablePaths.js';
import type { ItemFields } from '../rundown/fieldValue.js';
import type { InboxEventPayload } from './inboxEvent.js';
import { ptBREventInbox } from './ptBREventInbox.js';

/** The fields of an event's payload an item field may read, by name. */
export const EventPayloadPathSchema = z.enum([
  'carNumber',
  'teamName',
  'schoolName',
  'noticeKind',
  'reason',
  'penaltyText',
  'lapNumber',
  'lapTimeMs',
  'lapTimeText',
]);

/** One payload path. */
export type EventPayloadPath = z.infer<typeof EventPayloadPathSchema>;

/**
 * An item field filled by the event the item shows ("Evento" in the item editor,
 * BAJAOVRLAY-44): `path` names the payload's field. An item with one is a template: it
 * goes on air only through an event (showEvent), never by a take of its own, and Prévia
 * fills it from a sample event. Strict, like takeTime: a value written beside it is
 * refused, not dropped.
 */
export const EventFieldValueSchema = z.strictObject({
  kind: z.literal('eventField'),
  path: EventPayloadPathSchema,
});

/** An event field value after validation. */
export type EventFieldValue = z.infer<typeof EventFieldValueSchema>;

/** One payload path as the item editor offers it: its pt-BR label and its value type. */
export type EventPayloadPathChoice = {
  path: EventPayloadPath;
  label: string;
  valueType: BindableValueType;
};

/** Every payload path with its type, in the order the editor lists them. Written by hand. */
const eventPayloadPathTypes: Array<{ path: EventPayloadPath; valueType: BindableValueType }> = [
  { path: 'carNumber', valueType: 'integer' },
  { path: 'teamName', valueType: 'text' },
  { path: 'schoolName', valueType: 'text' },
  { path: 'noticeKind', valueType: 'text' },
  { path: 'reason', valueType: 'text' },
  { path: 'penaltyText', valueType: 'text' },
  { path: 'lapNumber', valueType: 'integer' },
  { path: 'lapTimeMs', valueType: 'integer' },
  { path: 'lapTimeText', valueType: 'text' },
];

/** Lists every payload path an event field may read, with its label and value type. */
export function listEventPayloadPaths(): EventPayloadPathChoice[] {
  return eventPayloadPathTypes.map(({ path, valueType }) => ({
    path,
    label: ptBREventInbox.payloadPathLabels[path],
    valueType,
  }));
}

/**
 * The payload paths whose type fits one field of a graphic's data schema, by the same
 * rule as a binding's (a text field takes text, an integer field integers…), so the
 * editor offers "Evento" only where a path fits, and only those paths.
 */
export function listEventPayloadPathsThatFitField(
  dataSchema: unknown,
  fieldKey: string,
): EventPayloadPathChoice[] {
  const valueTypesThatFit = listValueTypesThatFitDataSchemaField(dataSchema, fieldKey);
  return listEventPayloadPaths().filter((choice) => valueTypesThatFit.includes(choice.valueType));
}

/**
 * Why an event field cannot be saved on this field of the schema (pt-BR, without the
 * field's title, which the caller puts first), or undefined when its path fits.
 */
export function findProblemInEventFieldForField(
  eventField: EventFieldValue,
  dataSchema: unknown,
  fieldKey: string,
): string | undefined {
  const pathsThatFit = listEventPayloadPathsThatFitField(dataSchema, fieldKey);
  const doesPathFit = pathsThatFit.some((choice) => choice.path === eventField.path);
  if (doesPathFit) {
    return undefined;
  }
  return ptBREventInbox.fieldReasons.pathDoesNotFit(
    ptBREventInbox.payloadPathLabels[eventField.path],
  );
}

/** The value the event field reads in a payload, or undefined when the event lacks it. */
export function readEventFieldFromPayload(
  eventField: EventFieldValue,
  payload: InboxEventPayload,
): unknown {
  return payload[eventField.path];
}

/** True when any field of the item is filled by an event: the item is a template. */
export function isItemFilledByAnEvent(fields: ItemFields): boolean {
  return Object.values(fields).some((fieldValue) => fieldValue.kind === 'eventField');
}
