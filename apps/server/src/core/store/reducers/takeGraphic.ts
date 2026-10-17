import type { Instance, TakeGraphicCommand } from '@bajaovrlay/shared';

import {
  refuseFieldGraphicCannotStamp,
  refuseInvalidGraphicData,
  refuseUnknownGraphic,
  refuseUnknownLayer,
} from '../commandRefusals.js';
import {
  separateClearedFieldsFromData,
  stampFieldsWithMomentOfTheCommand,
} from '../graphicDataPreparation.js';
import { findProblemInGraphicData } from '../graphicDataValidation.js';
import { findTakeTimeFieldKeyGraphicCannotStamp } from '../graphicSchemaProperties.js';
import { removePreviewClearedMarkerOfLayer } from './previewMarkersAndDiscards.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * takeGraphic: puts a new instance of the graphic on the layer and output, replacing
 * the instance already there (one per layer per output). Other layers and the other
 * output are left alone. The data the instance holds is the command's data prepared in
 * two steps: a field sent as `null` is left out (it was cleared in the form), then each
 * field named in `takeTimeFieldKeys` gets the moment of this command in milliseconds.
 * Refused, before anything changes, if the layer or the graphic does not exist, if a
 * field named for stamping is not one the graphic's schema marks as a wall-clock
 * moment, or if the prepared data breaks the graphic's manifest schema. A take never
 * runs the manifest's update rule: there is no data on air for it to carry forward.
 * previewGraphic, previewItem and takePreview all end in this reducer, so the preview
 * output follows the same rules; an instance on the preview output also keeps the keys
 * that were stamped and says who asked for it. A new instance on either output takes its
 * layer's "will be cleared" marker off (see below).
 */
export function reduceTakeGraphic(
  slices: SlicesChangedByCommands,
  command: TakeGraphicCommand,
  context: ReducerContext,
): ReducerOutcome {
  const layerExists = slices.layers.some((layer) => layer.id === command.layerId);
  if (!layerExists) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const graphic = slices.graphics.find(
    (registeredGraphic) => registeredGraphic.id === command.graphicId,
  );
  if (graphic === undefined) {
    return { status: 'refused', error: refuseUnknownGraphic(command.graphicId) };
  }

  // Before anything is stamped: the server writes its own moment only into a field the
  // graphic's schema marks as a wall-clock moment. A graphic without a data schema
  // marks none, so it accepts no stamp at all.
  const keyThatCannotBeStamped = findTakeTimeFieldKeyGraphicCannotStamp(
    graphic,
    command.takeTimeFieldKeys,
  );
  if (keyThatCannotBeStamped !== undefined) {
    return {
      status: 'refused',
      error: refuseFieldGraphicCannotStamp(graphic.id, keyThatCannotBeStamped),
    };
  }

  // Null first, stamp second: a field that is both sent as null and named for stamping
  // ends up stamped, because the stamp is the more specific request of the two.
  const { fieldsWithAValue } = separateClearedFieldsFromData(command.data);
  const dataForTheGraphic = stampFieldsWithMomentOfTheCommand(
    fieldsWithAValue,
    command.takeTimeFieldKeys,
    context.now,
  );

  // Checked here rather than left to the graphic: by the time a graphic refuses its
  // data in the renderer, the instance it replaced has already left the screen. The
  // prepared data is what is checked, so leaving out a cleared REQUIRED field is
  // refused as a missing field.
  const problemInData = findProblemInGraphicData(graphic, dataForTheGraphic);
  if (problemInData !== undefined) {
    return { status: 'refused', error: refuseInvalidGraphicData(graphic.id, problemInData) };
  }

  // A new instance is `loading` until a renderer reports what happened to it on
  // screen; reportInstanceStatus then moves it to `on-air` or `failed`.
  const newInstance: Instance = {
    id: context.newInstanceId,
    layerId: command.layerId,
    graphicId: command.graphicId,
    target: command.target,
    resolvedData: dataForTheGraphic,
    currentStep: 0,
    status: 'loading',
    takenAt: context.now,
  };
  // A preview remembers which of its fields were stamped: takePreview writes the moment
  // of the take over exactly those, so a previewed clock starts when it goes on air.
  // Once stamped, a field holds a plain number and nothing else would say it was one.
  // A program instance never carries the list, and neither does a preview with no stamp.
  const isPreview = command.target === 'preview';
  if (isPreview && command.takeTimeFieldKeys.length > 0) {
    newInstance.takeTimeFieldKeys = command.takeTimeFieldKeys;
  }
  // Every preview says who asked for it. Made here it was asked for by hand: this is
  // where previewGraphic ("Edição rápida"), a takeGraphic aimed at the preview output and
  // a previewItem end. Only previewItem can say `auto`, and it changes the mark itself
  // (previewItem.ts). A program instance never carries the mark.
  if (isPreview) {
    newInstance.previewOrigin = 'manual';
  }
  const instancesKept = slices.instances.filter((instance) => {
    const isOnTheSameLayerAndOutput =
      instance.layerId === command.layerId && instance.target === command.target;
    return !isOnTheSameLayerAndOutput;
  });
  // Any new instance on a layer takes that layer's "will be cleared" marker off. On
  // preview: Prévia now shows this graphic there, not an empty layer. On program: the
  // operator just put something new on air there, so the plan to empty the layer is
  // stale, as after a clear, and "Tomar tudo" must not clear what was just taken.
  // Done here, where every take and every preview ends (takeItem, takeNext, previewItem,
  // previewGraphic, takePreview, a macro step or a macro's preview), so no path can forget
  // it. An updateInstanceData or a status report is not a new instance and keeps it.
  const markersAfter = removePreviewClearedMarkerOfLayer(
    slices.previewClearedLayerIds,
    command.layerId,
  );

  return {
    status: 'applied',
    slices: {
      ...slices,
      instances: [...instancesKept, newInstance],
      previewClearedLayerIds: markersAfter,
    },
  };
}
