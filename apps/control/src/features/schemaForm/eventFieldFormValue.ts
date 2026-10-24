/**
 * The "Evento" kind of a field (BAJAOVRLAY-44) as the generated form holds it: which
 * fields offer it, which payload fields each may read, and the event field an item stores
 * once the form is checked. The rules themselves are shared with the server
 * (packages/shared/src/eventInbox/eventFieldValue.ts).
 */
import {
  type EventFieldValue,
  type EventPayloadPathChoice,
  EventPayloadPathSchema,
  listEventPayloadPathsThatFitField,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

/** True when some payload field fits this field of the schema, so "Evento" is offered. */
export function canFieldBeFilledByAnEvent(dataSchema: unknown, fieldKey: string): boolean {
  return listEventPayloadPathsThatFitField(dataSchema, fieldKey).length > 0;
}

/** The payload fields this field may read, with their pt-BR labels, in the editor's order. */
export function listEventPathChoicesOfField(
  dataSchema: unknown,
  fieldKey: string,
): EventPayloadPathChoice[] {
  return listEventPayloadPathsThatFitField(dataSchema, fieldKey);
}

/** What reading a field set to "Evento" gives: the event field, or the pt-BR message. */
export type EventFieldOfFormRead =
  { status: 'chosen'; eventField: EventFieldValue } | { status: 'problem'; message: string };

/**
 * The event field a field set to "Evento" stores: the payload field chosen, when it is one
 * that fits; otherwise the message asking to choose one.
 */
export function readEventFieldOfFormField(
  field: SchemaFormFieldDescription,
  formValues: SchemaFormValues,
  dataSchema: unknown,
): EventFieldOfFormRead {
  const chosenPath = readOwnValueOfRecord(formValues.eventPaths ?? {}, field.key) ?? '';
  const parsedPath = EventPayloadPathSchema.safeParse(chosenPath);
  const doesPathFit =
    parsedPath.success &&
    listEventPathChoicesOfField(dataSchema, field.key).some(
      (choice) => choice.path === parsedPath.data,
    );
  if (!parsedPath.success || !doesPathFit) {
    return { status: 'problem', message: ptBR.events.editor.pathMissing(field.label) };
  }
  return { status: 'chosen', eventField: { kind: 'eventField', path: parsedPath.data } };
}
