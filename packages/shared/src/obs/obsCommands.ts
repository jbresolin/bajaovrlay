// The three commands of OBS control (BAJAOVRLAY-27). switchObsScene is the operator's
// (the control page, a macro step, the command API); the other two are sent only by the
// server's OBS connection, signed `sistema:obs`, so the `obs` slice changes through the
// one command path like every other slice.
import { z } from 'zod';

import { ObsSceneTargetSchema, ObsStatusSchema } from './obsSlice.js';

/**
 * Puts one of OBS's scenes on Program, or on Preview while Studio Mode is on. The scene
 * is named as OBS names it, capitals and spaces included. Refused when OBS is not
 * connected, when OBS has no scene of that name, and for Preview with Studio Mode off.
 */
export const SwitchObsSceneCommandSchema = z.object({
  type: z.literal('switchObsScene'),
  sceneName: z.string().min(1),
  /** Program when left out, as a button means. */
  target: ObsSceneTargetSchema.default('program'),
});

/** A switchObsScene command after validation. */
export type SwitchObsSceneCommand = z.infer<typeof SwitchObsSceneCommandSchema>;

/**
 * The server's OBS connection reporting what OBS is doing now: the whole status at once,
 * after each OBS event and each change of the connection, so the slice never holds half
 * of one reading and half of another.
 */
export const RecordObsStateCommandSchema = z.object({
  type: z.literal('recordObsState'),
  status: ObsStatusSchema,
});

/** A recordObsState command after validation. */
export type RecordObsStateCommand = z.infer<typeof RecordObsStateCommandSchema>;

/**
 * The server's OBS connection reporting OBS's answer to a scene switch, by its number:
 * done, or refused with the reason in pt-BR (OBS said no, did not answer in time, or the
 * connection dropped first).
 */
export const RecordObsSceneSwitchAnswerCommandSchema = z.object({
  type: z.literal('recordObsSceneSwitchAnswer'),
  number: z.number().int().min(1),
  isDone: z.boolean(),
  /** Null when done; the pt-BR reason when refused. */
  refusalReason: z.string().nullable(),
});

/** A recordObsSceneSwitchAnswer command after validation. */
export type RecordObsSceneSwitchAnswerCommand = z.infer<
  typeof RecordObsSceneSwitchAnswerCommandSchema
>;
