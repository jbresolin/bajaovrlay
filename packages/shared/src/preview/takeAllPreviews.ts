import { z } from 'zod';

import { CommandErrorSchema } from '../commands/commandError.js';
import { InstanceIdsSeenOnAirByLayerSchema } from '../consoles/whatTheConsoleSawOnAir.js';

/**
 * "Tomar tudo": sends everything Prévia shows to the program output at once. Every
 * preview instance is taken as takePreview takes it, and every layer marked "will be
 * cleared" has its program output cleared, in one state change, so OBS never shows a
 * half-taken set. Refused, with nothing changed, when there is nothing to take or when
 * any one layer cannot be taken. The one exception (BAJAOVRLAY-69): a layer another console
 * changed moments ago, unseen by this one, is left as it is and the others are taken; the
 * answer lists the layers left (`layersNotTaken` on the commandResult).
 */
export const TakeAllPreviewsCommandSchema = z.object({
  type: z.literal('takeAllPreviews'),
  /**
   * From a console only (BAJAOVRLAY-69): for each layer Prévia shows, what the console showed
   * on that layer's program output at the press (../consoles/).
   */
  instanceIdsSeenOnAir: InstanceIdsSeenOnAirByLayerSchema.optional(),
});

/** A takeAllPreviews command after validation. */
export type TakeAllPreviewsCommand = z.infer<typeof TakeAllPreviewsCommandSchema>;

/**
 * One layer "Tomar tudo" left as it was because another console had just changed it
 * (BAJAOVRLAY-69): the layer and the refusal a takePreview of it alone would have had.
 */
export const LayerNotTakenSchema = z.object({
  layerId: z.string().min(1),
  error: CommandErrorSchema,
});

/** A LayerNotTakenSchema value. */
export type LayerNotTaken = z.infer<typeof LayerNotTakenSchema>;
