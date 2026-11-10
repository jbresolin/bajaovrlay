import { z } from 'zod';

/**
 * What a field of a car group is: one field of a car in the positions shape, by the
 * shape's own name (`position`, `carNumber`, `teamName`…). The picker reads the field of
 * that name from the car picked, so a meaning is exactly a path's last step.
 * Written out by hand, like the bindable paths themselves (bindablePaths.ts);
 * carGroupPaths.test.ts fails if one of them has no path.
 */
export const carFieldMeanings = [
  'position',
  'carNumber',
  'teamName',
  'schoolName',
  'laps',
  'lastLapMs',
  'bestLapMs',
  'bestLapNumber',
  'gapToLeaderMs',
  'gapToLeaderLaps',
  'intervalMs',
  'pitStops',
  'fuelStops',
  'status',
] as const;

/** One of carFieldMeanings: which field of the car a graphic's field shows. */
export const CarFieldMeaningSchema = z.enum(carFieldMeanings);

/** One of carFieldMeanings, after validation. */
export type CarFieldMeaning = z.infer<typeof CarFieldMeaningSchema>;

/**
 * One car group of a manifest's `v_baja.carGroups` (BAJAOVRLAY-66): the fields of a
 * graphic that describe one car, filled by choosing that car once in the item editor.
 * - `id`: how the manifest names the group (`ahead`);
 * - `label`: what the operator reads ("Carro da frente"), in pt-BR like a field's title;
 * - `fields`: each field's key in the data schema, with what it shows of the car;
 * - `rightBehindGroup`: for the second car of a battle, the group whose car runs right
 *   ahead of this one, so "Disputa pela 2ª posição" can set both at once.
 * Strict, so a misspelt key is refused rather than dropped. Whether the fields exist and
 * fit is checked against the data schema by carGroupsOfManifest.ts.
 */
export const CarGroupSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  fields: z.record(z.string().min(1), z.string()),
  rightBehindGroup: z.string().min(1).optional(),
});

/** One car group as the control page uses it, every meaning known. */
export type CarGroup = {
  id: string;
  label: string;
  fields: Record<string, CarFieldMeaning>;
  rightBehindGroup?: string;
};
