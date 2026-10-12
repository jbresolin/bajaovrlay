import type { PreviewGraphicCommand, TakeGraphicCommand } from '@bajaovrlay/shared';

import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceTakeGraphic } from './takeGraphic.js';

/**
 * previewGraphic: puts a graphic with hand-typed data ("Edição rápida") on the preview
 * output of a layer, in place of whatever was previewed there. It is nothing but a
 * takeGraphic aimed at the preview output, run by the takeGraphic reducer itself, so the
 * cleared fields, the stamps, the data check and every refusal are the ones of a take.
 * Deliberate: takeGraphic still accepts `target: 'preview'` and gives the same result;
 * this command exists so that a page asking for a preview cannot put anything on air by
 * getting one word wrong.
 */
export function reducePreviewGraphic(
  slices: SlicesChangedByCommands,
  command: PreviewGraphicCommand,
  context: ReducerContext,
): ReducerOutcome {
  const takeOnThePreviewOutput: TakeGraphicCommand = {
    type: 'takeGraphic',
    graphicId: command.graphicId,
    layerId: command.layerId,
    data: command.data,
    target: 'preview',
    takeTimeFieldKeys: command.takeTimeFieldKeys,
  };
  return reduceTakeGraphic(slices, takeOnThePreviewOutput, context);
}
