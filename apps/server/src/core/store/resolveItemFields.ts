import {
  type BindingFieldValue,
  type BindingTransformContext,
  type CommandError,
  type EntityLibrary,
  findClockFieldKeysByRole,
  type Graphic,
  type InboxEventPayload,
  type ItemFields,
  resolveBindingAgainstSources,
  type SourcesForBindings,
  wholeClockBindingPath,
} from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { listRequiredFieldKeysOfGraphic } from './graphicSchemaProperties.js';
import { readTitleOfField } from './itemBindingFields.js';
import { resolveEntityField } from './resolveEntityFields.js';
import { resolveEventField } from './resolveEventField.js';
import { refuseUnsupportedFieldKind } from './rundownCommandRefusals.js';

/** What resolving an item's fields gives: the data for the graphic, or why it cannot be made. */
export type ItemFieldsResolution =
  | { status: 'resolved'; data: Record<string, unknown> }
  | { status: 'refused'; error: CommandError };

/**
 * Everything the resolver reads, handed in as plain data so it reads nothing itself:
 * - `fields`: the item's field values;
 * - `graphic`: the item's graphic as registered now (undefined when it is not), for which
 *   fields are required, their titles in a refusal, and the clock fields by role;
 * - `momentOfTheTake`: the moment the store gave the command (ISO 8601), which a
 *   `takeTime` field becomes;
 * - `sources`: the data sources, their last good snapshots and the operator's overrides;
 * - `entities`: the entity library (teams, people, sponsors, schedule), for `entity` fields;
 * - `eventPayload`: only when an event is shown or previewed with the item, what fills
 *   its event fields (BAJAOVRLAY-44).
 */
export type ItemFieldsResolutionRequest = {
  fields: ItemFields;
  graphic: Graphic | undefined;
  momentOfTheTake: string;
  sources: SourcesForBindings;
  eventPayload?: InboxEventPayload | undefined;
  entities: EntityLibrary;
};

/**
 * Turns an item's field values into the plain data its graphic receives at the take or
 * the preview. Pure: the same request always gives the same data. A `literal` passes
 * through as typed; a `takeTime` becomes the moment of the take in wall-clock ms; a
 * `binding` reads its source's last good snapshot (a stale one too, concept §5.4) with the
 * overrides laid over it, at its path, through its transforms, which are handed the
 * library's teams (resolveBindingAgainstSources in shared). The whole clock (the path `clock`, stored on the field with the role
 * clockTime) fills the graphic's four clock fields by role, so the clock never takes a new
 * time with an old moment. An `entity` reference reads one attribute of one record of the
 * library, an image as its /media URL (resolveEntityFields.ts, BAJAOVRLAY-19). An
 * `eventField` reads the payload of the event shown with the item (resolveEventField.ts,
 * BAJAOVRLAY-44).
 * One field it cannot fill refuses the whole item (BINDING_NOT_RESOLVED or
 * ENTITY_NOT_RESOLVED, the field's title first): a missing source, a source with no data
 * yet, a shape it does not send, a record not in the library, or a value absent on a
 * required field. A value absent on an optional field leaves that field out, as a
 * cleared literal does. A graphic must never go on air with part of its data missing
 * (concept §5.1).
 */
export function resolveItemFieldsIntoGraphicData(
  request: ItemFieldsResolutionRequest,
): ItemFieldsResolution {
  const { fields, graphic, momentOfTheTake, sources, entities } = request;
  // The store always writes the moment with toISOString, which Date.parse reads back to
  // the exact millisecond. A text that is not a date would give NaN here; a graphic whose
  // schema asks for a whole number (the race clock does) then refuses the take.
  const momentOfTheTakeInMilliseconds = Date.parse(momentOfTheTake);
  const requiredFieldKeys = graphic === undefined ? [] : listRequiredFieldKeysOfGraphic(graphic);
  // What a binding transform may read besides its value: the library's teams, for
  // withTeamLogos (BAJAOVRLAY-47). The same library the entity fields read.
  const transformContext: BindingTransformContext = { teams: entities.teams };
  const resolvedKeysAndValues: Array<[string, unknown]> = [];
  // Filled after every other field, so a cleared literal on a clock field never takes
  // off what the whole clock wrote there.
  const keysAndValuesOfTheWholeClock: Array<[string, unknown]> = [];

  for (const [fieldKey, fieldValue] of Object.entries(fields)) {
    // Read as plain text on purpose, as a guard kept for the next kind (the entity library
    // had it until BAJAOVRLAY-19): the `default` below cannot be reached through the
    // server today. A command carrying another kind is refused earlier with
    // INVALID_COMMAND by the command schema, and a stored items row holding one fails its
    // schema and stops the boot. The guard stays so that the day the schema accepts a new
    // kind before this function has its `case`, the take is refused in words instead of
    // resolving the field to nothing.
    const fieldKind: string = fieldValue.kind;
    switch (fieldValue.kind) {
      case 'literal':
        resolvedKeysAndValues.push([fieldKey, fieldValue.value]);
        break;
      case 'takeTime':
        resolvedKeysAndValues.push([fieldKey, momentOfTheTakeInMilliseconds]);
        break;
      case 'binding': {
        const isWholeClock = fieldValue.path === wholeClockBindingPath;
        const fieldOutcome = isWholeClock
          ? resolveWholeClock(fieldKey, fieldValue, graphic, sources, transformContext)
          : resolveOneBoundField(fieldKey, fieldValue, graphic, sources, {
              requiredFieldKeys,
              transformContext,
            });
        if (fieldOutcome.status === 'refused') {
          return fieldOutcome;
        }
        const destination = isWholeClock ? keysAndValuesOfTheWholeClock : resolvedKeysAndValues;
        destination.push(...fieldOutcome.keysAndValues);
        break;
      }
      case 'eventField': {
        const fieldOutcome = resolveEventField(
          fieldKey,
          fieldValue,
          request.eventPayload,
          graphic,
          requiredFieldKeys,
        );
        if (fieldOutcome.status === 'refused') {
          return fieldOutcome;
        }
        resolvedKeysAndValues.push(...fieldOutcome.keysAndValues);
        break;
      }
      case 'entity': {
        const fieldOutcome = resolveEntityField(
          fieldKey,
          fieldValue,
          graphic,
          entities,
          requiredFieldKeys,
        );
        if (fieldOutcome.status === 'refused') {
          return fieldOutcome;
        }
        resolvedKeysAndValues.push(...fieldOutcome.keysAndValues);
        break;
      }
      default:
        return { status: 'refused', error: refuseUnsupportedFieldKind(fieldKey, fieldKind) };
    }
  }
  // Built from pairs so that a field key such as `__proto__` becomes an ordinary key of
  // the data instead of changing what kind of object the data is.
  return {
    status: 'resolved',
    data: Object.fromEntries([...resolvedKeysAndValues, ...keysAndValuesOfTheWholeClock]),
  };
}

/** What one bound field gives: the keys and values it fills (none when left out), or why not. */
type BoundFieldOutcome =
  | { status: 'filled'; keysAndValues: Array<[string, unknown]> }
  | { status: 'refused'; error: CommandError };

/**
 * One bound field: its value, nothing when the value is absent and the field optional,
 * or the refusal naming the field.
 */
function resolveOneBoundField(
  fieldKey: string,
  binding: BindingFieldValue,
  graphic: Graphic | undefined,
  sources: SourcesForBindings,
  {
    requiredFieldKeys,
    transformContext,
  }: {
    requiredFieldKeys: string[];
    transformContext: BindingTransformContext;
  },
): BoundFieldOutcome {
  const resolution = resolveBindingAgainstSources(binding, sources, transformContext);
  if (resolution.status === 'resolved') {
    return { status: 'filled', keysAndValues: [[fieldKey, resolution.value]] };
  }
  const isOptionalFieldWithoutValue =
    resolution.status === 'valueAbsent' && !requiredFieldKeys.includes(fieldKey);
  if (isOptionalFieldWithoutValue) {
    return { status: 'filled', keysAndValues: [] };
  }
  return refuseBoundField(graphic, fieldKey, resolution.problem);
}

/**
 * The whole clock: one reading of the session clock spread over the graphic's four clock
 * fields by role (time read, moment, running, mode). The roles are named, never a
 * graphic, so this holds for any graphic that marks the four (the item save refuses the
 * whole clock on any other).
 */
function resolveWholeClock(
  fieldKey: string,
  binding: BindingFieldValue,
  graphic: Graphic | undefined,
  sources: SourcesForBindings,
  transformContext: BindingTransformContext,
): BoundFieldOutcome {
  const clockFieldKeys = graphic === undefined ? undefined : findClockFieldKeysByRole(graphic);
  const resolution = resolveBindingAgainstSources(binding, sources, transformContext);
  if (resolution.status !== 'resolved') {
    return refuseBoundField(graphic, fieldKey, resolution.problem);
  }
  const clockReading = resolution.value;
  const isClockReading =
    typeof clockReading === 'object' && clockReading !== null && !Array.isArray(clockReading);
  if (clockFieldKeys === undefined || !isClockReading) {
    return refuseBoundField(graphic, fieldKey, ptBR.bindingErrors.wholeClockWithoutClockFields);
  }
  return {
    status: 'filled',
    keysAndValues: [
      [clockFieldKeys.clockTime, clockReading.referenceTimeMs],
      [clockFieldKeys.wallClock, clockReading.referenceWallClockMs],
      [clockFieldKeys.clockRunning, clockReading.running],
      [clockFieldKeys.clockMode, clockReading.clockMode],
    ],
  };
}

/** The BINDING_NOT_RESOLVED refusal, the field's title before the sentence. */
function refuseBoundField(
  graphic: Graphic | undefined,
  fieldKey: string,
  problem: string,
): BoundFieldOutcome {
  const fieldTitle = graphic === undefined ? fieldKey : readTitleOfField(graphic, fieldKey);
  return {
    status: 'refused',
    error: {
      code: 'BINDING_NOT_RESOLVED',
      message: ptBR.bindingErrors.aboutField(fieldTitle, problem),
    },
  };
}
