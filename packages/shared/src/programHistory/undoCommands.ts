import { z } from 'zod';

/**
 * "Desfazer" on a Camadas row (BAJAOVRLAY-30): puts back what the layer's program output
 * showed before its last change, and forgets that change. An item comes back through the
 * same path as a take (bound fields read their source now, typed values come back as they
 * were); "vazio" clears the layer. Refused with NOTHING_TO_UNDO when the layer has no
 * history, ITEM_NOT_FOUND when the item was deleted since, GRAPHIC_NOT_FOUND when its
 * graphic is no longer listed. An undo is not remembered itself: there is no redo.
 */
export const UndoOnLayerCommandSchema = z.object({
  type: z.literal('undoOnLayer'),
  layerId: z.string().min(1),
});

/** An undoOnLayer command after validation. */
export type UndoOnLayerCommand = z.infer<typeof UndoOnLayerCommandSchema>;

/**
 * "Desfazer última" and Ctrl+Z: undoes the most recent change of program across every
 * layer. A change that touched several layers (a "Limpar tudo", "Tomar tudo") comes back
 * on all of them at once, in one broadcast; if one of them cannot come back, nothing does.
 */
export const UndoLastChangeOnProgramCommandSchema = z.object({
  type: z.literal('undoLastChangeOnProgram'),
});

/** An undoLastChangeOnProgram command after validation. */
export type UndoLastChangeOnProgramCommand = z.infer<typeof UndoLastChangeOnProgramCommandSchema>;
