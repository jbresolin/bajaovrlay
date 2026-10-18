/**
 * What Camadas needs to know about the fields of an instance on air, read from its
 * graphic's manifest: their titles, and which of them is a clock's wall-clock moment.
 * Pure functions, no drawing.
 */
import type { Graphic } from '@bajaovrlay/shared';

import {
  describeSchemaFormFromDataSchema,
  type SchemaFormFieldDescription,
} from '@/features/schemaForm';

/** The fields the manifest of this graphic describes; none for a graphic not listed. */
function describeFieldsOfGraphic(graphic: Graphic | undefined): SchemaFormFieldDescription[] {
  if (graphic === undefined) {
    return [];
  }
  return describeSchemaFormFromDataSchema(graphic.manifest.schema).fields;
}

/**
 * The titles of these fields as the manifest gives them ("Nome", "Cargo"), in the order
 * given; a key the manifest does not describe is named by the key itself.
 */
export function nameFieldsByTheirTitles(
  graphic: Graphic | undefined,
  fieldKeys: string[],
): string[] {
  const fieldsOfTheGraphic = describeFieldsOfGraphic(graphic);
  return fieldKeys.map(
    (fieldKey) => fieldsOfTheGraphic.find((field) => field.key === fieldKey)?.label ?? fieldKey,
  );
}

/**
 * The keys of the graphic's wall-clock moments (an integer whose `v_baja.role` is
 * `wallClock`, such as the moment a race clock counts from): the fields whose saving
 * into an item needs the operator's choice between keeping the moment and the moment of
 * each take. None for a graphic not listed.
 */
export function listWallClockFieldKeysOfGraphic(graphic: Graphic | undefined): string[] {
  const wallClockFields = describeFieldsOfGraphic(graphic).filter((field) => field.offersTakeTime);
  return wallClockFields.map((field) => field.key);
}

// The four parts of a clock, as a manifest marks them with `v_baja.role` (the words the
// server's carryClockForward reads).
const clockRoles: ReadonlyArray<string | undefined> = [
  'clockTime',
  'wallClock',
  'clockRunning',
  'clockMode',
];

/**
 * The keys of the graphic's clock fields: every field whose `v_baja.role` is clockTime,
 * wallClock, clockRunning or clockMode. "Salvar no item" saves a clock whole when any of
 * them changed on air, its moment included, so the clock question is asked then.
 */
export function listClockFieldKeysOfGraphic(graphic: Graphic | undefined): string[] {
  const clockFields = describeFieldsOfGraphic(graphic).filter((field) =>
    clockRoles.includes(field.role),
  );
  return clockFields.map((field) => field.key);
}
