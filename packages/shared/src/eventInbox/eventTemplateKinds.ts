import type { ItemFields } from '../rundown/fieldValue.js';
import {
  type EventFieldValue,
  type EventPayloadPath,
  EventPayloadPathSchema,
  listEventPayloadPathsThatFitField,
} from './eventFieldValue.js';
import type { InboxEventKind } from './inboxEvent.js';

/**
 * The payload fields each kind's events carry, written by hand from what fills them: the
 * detectors of apps/server (newIncident.ts, newFastestLap.ts, leaderChanged.ts and
 * newSuperChat.ts) and "+ Evento" (createManualEvent.ts). A field a kind may leave out
 * (an incident's penalty, a typed notice's car) is listed: the template simply shows less.
 */
const eventPayloadPathsOfEachKind: Record<InboxEventKind, EventPayloadPath[]> = {
  newIncident: [
    'carNumber',
    'teamName',
    'schoolName',
    'noticeKind',
    'reason',
    'penaltyText',
    'lapNumber',
  ],
  fastestLap: ['carNumber', 'teamName', 'schoolName', 'lapNumber', 'lapTimeMs', 'lapTimeText'],
  leaderChanged: ['carNumber', 'teamName', 'schoolName', 'lapNumber'],
  manual: ['carNumber', 'teamName', 'schoolName', 'noticeKind', 'reason', 'penaltyText'],
  superChat: ['authorName', 'amountText', 'messageText'],
};

/** The payload fields a kind's events carry, in the order above. */
export function listEventPayloadPathsOfKind(kind: InboxEventKind): EventPayloadPath[] {
  return [...eventPayloadPathsOfEachKind[kind]];
}

/**
 * True when an item is a template of this kind (BAJAOVRLAY-67): it reads at least one
 * field from the event, and every field it reads is one the kind's events carry. What
 * "Trocar" in "Regras" offers for a kind; a Super Chat template never shows a penalty.
 */
export function doesTemplateSuitKind(fields: ItemFields, kind: InboxEventKind): boolean {
  const pathsOfTheKind = eventPayloadPathsOfEachKind[kind];
  const pathsRead = Object.values(fields)
    .filter((fieldValue) => fieldValue.kind === 'eventField')
    .map((fieldValue) => fieldValue.path);
  return pathsRead.length > 0 && pathsRead.every((path) => pathsOfTheKind.includes(path));
}

/**
 * The event fields a new template of this kind starts with ("+ Novo modelo" in "Regras",
 * BAJAOVRLAY-67): each field of the graphic named like a payload field the kind carries,
 * read from the event when the payload field's type fits the field. Matched by name on
 * purpose: by type alone a text field would fit the team, the school and the reason alike.
 * The operator changes the rest in the item editor.
 */
export function buildEventFieldsOfANewTemplate(
  dataSchema: unknown,
  kind: InboxEventKind,
): Record<string, EventFieldValue> {
  const fields: Record<string, EventFieldValue> = {};
  for (const fieldKey of listPropertyKeysOfDataSchema(dataSchema)) {
    const parsedPath = EventPayloadPathSchema.safeParse(fieldKey);
    if (!parsedPath.success || !eventPayloadPathsOfEachKind[kind].includes(parsedPath.data)) {
      continue;
    }
    const doesThePathFit = listEventPayloadPathsThatFitField(dataSchema, fieldKey).some(
      (choice) => choice.path === parsedPath.data,
    );
    if (doesThePathFit) {
      fields[fieldKey] = { kind: 'eventField', path: parsedPath.data };
    }
  }
  return fields;
}

/** The keys of a data schema's `properties`, in their order; none when it has no object. */
function listPropertyKeysOfDataSchema(dataSchema: unknown): string[] {
  if (typeof dataSchema !== 'object' || dataSchema === null || !('properties' in dataSchema)) {
    return [];
  }
  const properties = dataSchema.properties;
  if (typeof properties !== 'object' || properties === null) {
    return [];
  }
  return Object.keys(properties);
}
