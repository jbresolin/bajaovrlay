import type { PreviewItemCommand } from '@bajaovrlay/shared';

import { putItemOnOutput } from './putItemOnOutput.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * previewItem: puts a prepared item on the preview output of its layer, in place of
 * whatever was previewed there. It goes through putItemOnOutput, the function takeItem
 * uses for the program output, so the Prévia monitor shows exactly the data a take
 * would put on air and a preview is refused for every reason a take is. The program
 * output is untouched (a take replaces only the same layer AND output) and the rundown's
 * cursor never moves, because previewing is looking, not carrying the plan out. A
 * `takeTime` field is stamped with the moment of the preview, so the operator sees the
 * clock run; takePreview stamps it again at the take.
 *
 * The command says who asked (`origin`). A preview asked for by hand does nothing more.
 * One made by "Prévia automática" (`auto`) also removes every OTHER preview that was
 * itself automatic, on any layer, and is marked `auto` in its turn: the preview output
 * then shows the item at the cursor and not every item the cursor passed. Previews asked
 * for by hand stay (João's ruling, gate 2 of BAJAOVRLAY-15). It is done here, in the one
 * command, so no page ever sees the old and the new automatic preview together.
 * A refused preview removes nothing: the refusal comes back before anything is removed.
 */
export function reducePreviewItem(
  slices: SlicesChangedByCommands,
  command: PreviewItemCommand,
  context: ReducerContext,
): ReducerOutcome {
  const previewOutcome = putItemOnOutput(slices, command.itemId, 'preview', context);
  if (previewOutcome.status === 'refused') {
    return previewOutcome;
  }
  // The new preview is already marked `manual` (reduceTakeGraphic marks every preview).
  // Written as "not auto" so that only the exact word `auto` can ever discard a preview.
  if (command.origin !== 'auto') {
    return { status: 'applied', slices: previewOutcome.slices };
  }

  // The instance putItemOnOutput just made is the one carrying the id the store handed in.
  const instancesWithoutOlderAutoPreviews = previewOutcome.slices.instances.filter((instance) => {
    const isTheNewPreview = instance.id === context.newInstanceId;
    const isAnAutoPreview = instance.target === 'preview' && instance.previewOrigin === 'auto';
    return isTheNewPreview || !isAnAutoPreview;
  });
  const instancesWithTheNewPreviewMarkedAuto = instancesWithoutOlderAutoPreviews.map((instance) =>
    instance.id === context.newInstanceId
      ? { ...instance, previewOrigin: 'auto' as const }
      : instance,
  );
  return {
    status: 'applied',
    slices: { ...previewOutcome.slices, instances: instancesWithTheNewPreviewMarkedAuto },
  };
}
