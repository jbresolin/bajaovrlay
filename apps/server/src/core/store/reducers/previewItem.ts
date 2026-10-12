import type { PreviewItemCommand } from '@bajaovrlay/shared';

import { putItemOnOutput } from './putItemOnOutput.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * previewItem: puts a prepared item on the preview output of its layer, in place of
 * whatever was previewed there. It goes through putItemOnOutput, the function takeItem
 * uses for the program output, so the Prévia monitor shows exactly the data a take
 * would put on air and a preview is refused for every reason a take is. That is all it
 * does: the program output is untouched (a take replaces only the same layer AND
 * output) and the rundown's cursor never moves, because previewing is looking, not
 * carrying the plan out. A `takeTime` field is stamped with the moment of the preview,
 * so the operator sees the clock run; takePreview stamps it again at the take.
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
  return { status: 'applied', slices: previewOutcome.slices };
}
