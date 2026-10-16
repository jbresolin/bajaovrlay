import { z } from 'zod';

/** The longest a `wait` step may hold the next step back: ten seconds, in milliseconds. */
export const longestMacroWaitMs = 10_000;

/**
 * One step of a macro, told apart by `kind`. Three steps are the commands of the same
 * name (takeItem, clearLayer, clearAll) sent by the server's macro runner; `wait`
 * sends nothing and holds the next step back by `ms` milliseconds. OBS scene steps
 * arrive in M4.
 * Whether the item or layer a step names exists is not checked here, nor when the
 * macro is saved: a step naming something missing is refused when it runs, and stops
 * the macro there.
 */
export const MacroStepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('takeItem'),
    itemId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('clearLayer'),
    layerId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('clearAll'),
  }),
  z.object({
    kind: z.literal('wait'),
    /** Whole milliseconds, from 1 to 10 000. */
    ms: z.number().int().min(1).max(longestMacroWaitMs),
  }),
]);

/** A macro step that has passed MacroStepSchema. */
export type MacroStep = z.infer<typeof MacroStepSchema>;
