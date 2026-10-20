import { z } from 'zod';

import { DataShapeKeySchema } from '../dataShapes/dataShapeKey.js';

/**
 * A field value read from a data source instead of typed (concept §2, "binding"): which
 * source, which of its canonical shapes, which path in it (one that
 * listBindablePathsOfShape lists), whether it keeps updating while on air, and at most
 * one transform from the registry. `carNumber` goes with the paths that read a car by its
 * number (`entryOfCar.…`) and with no other.
 *
 * This schema checks the shape of the value only. Whether its parts make sense together
 * (the path is listed, the transform exists and its parameters are right) is
 * findProblemInBinding's job, and whether the source exists the server's, so that each
 * refusal is a pt-BR sentence naming the field rather than a schema path.
 * Strict on purpose: a misspelt `live` next to `isLive` is refused, not dropped, because
 * a field the operator believes follows the race would otherwise freeze at the take.
 */
export const BindingFieldValueSchema = z.strictObject({
  kind: z.literal('binding'),
  /** The data source's id, from the dataSources slice (`simulador-enduro`). */
  sourceId: z.string().min(1),
  shapeKey: DataShapeKeySchema,
  /** Dot-separated, from the shape's root: "state", "entries.0.teamName", "clock". */
  path: z.string().min(1),
  /** The car a path under `entryOfCar.` follows, wherever it is in the list. */
  carNumber: z.number().int().positive().optional(),
  /**
   * True: the field keeps updating while on air ("ao vivo"). False: it is read once at
   * the take and then frozen ("congelado na entrada").
   */
  isLive: z.boolean(),
  /** A binding transform of the registry (topN, formatLapTimeAsText…). */
  transformId: z.string().min(1).optional(),
  /** The transform's parameters, checked against its own schema by findProblemInBinding. */
  transformParameters: z.unknown().optional(),
});

/** A binding field value that has passed BindingFieldValueSchema. */
export type BindingFieldValue = z.infer<typeof BindingFieldValueSchema>;
