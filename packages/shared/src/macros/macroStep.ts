import { z } from 'zod';

import { ObsSceneTargetSchema } from '../obs/obsSlice.js';
import { TriggerFieldsOfTakeSchema } from '../triggers/triggerDataField.js';

/** The longest a `wait` step may hold the next step back: ten seconds, in milliseconds. */
export const longestMacroWaitMs = 10_000;

/**
 * One step of a macro, told apart by `kind`. Three steps are the commands of the same
 * name (takeItem, clearLayer, clearAll) sent by the server's macro runner; `wait`
 * sends nothing and holds the next step back by `ms` milliseconds; `obsScene`
 * (BAJAOVRLAY-27) becomes switchObsScene, and the runner waits for OBS's answer before
 * the next step, so the graphics after it never go on air over the wrong scene.
 * Whether the item, layer or OBS scene a step names exists is not checked here, nor when
 * the macro is saved: a step naming something missing is refused when it runs, and stops
 * the macro there.
 */
export const MacroStepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('takeItem'),
    itemId: z.string().min(1),
    /**
     * The fields this take fills from the trigger that started the run, by the graphic's
     * field key (BAJAOVRLAY-48): read once, at this step, and frozen. Left out: the item
     * goes on air with its own values, as before.
     */
    triggerFields: TriggerFieldsOfTakeSchema.optional(),
  }),
  z.object({
    kind: z.literal('clearLayer'),
    layerId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('clearAll'),
  }),
  z.object({
    kind: z.literal('obsScene'),
    /** The scene as OBS names it. */
    sceneName: z.string().min(1),
    /** Program when left out; Preview only switches with Studio Mode on. */
    target: ObsSceneTargetSchema.default('program'),
  }),
  z.object({
    kind: z.literal('wait'),
    /** Whole milliseconds, from 1 to 10 000. */
    ms: z.number().int().min(1).max(longestMacroWaitMs),
  }),
]);

/** A macro step that has passed MacroStepSchema. */
export type MacroStep = z.infer<typeof MacroStepSchema>;
