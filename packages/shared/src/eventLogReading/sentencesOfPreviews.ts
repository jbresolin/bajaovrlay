// The history sentences of the commands of the preview output (BAJAOVRLAY-30): one named
// formatter per command type, gathered in sentenceOfEachCommandType.ts.
import type { CommandOfType } from './commandOfType.js';
import type { EventLogNames } from './eventLogNames.js';
import {
  findLayerIdOfItem,
  nameInboxEvent,
  nameItem,
  nameLayerWithItsOutput,
  nameMacro,
} from './namesInSentences.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';

const sentences = ptBREventLogReading.previews;

/**
 * previewItem: "Pôs em prévia "Tarja – Ana Souza" na camada Tarja (Programa)", marked
 * when "Prévia automática" asked for it, and naming the event a preview of one shows.
 */
export function describePreviewItem(
  command: CommandOfType<'previewItem'>,
  names: EventLogNames,
): string {
  const itemName = nameItem(command.itemId, names);
  const layerId = findLayerIdOfItem(command.itemId, names);
  const mainSentence =
    layerId === undefined
      ? sentences.previewedItemWithoutLayer(itemName)
      : sentences.previewedItem(itemName, nameLayerWithItsOutput(layerId, names));
  const eventText =
    command.eventId === undefined ? '' : sentences.forEvent(nameInboxEvent(command.eventId, names));
  const automaticText = command.origin === 'auto' ? sentences.automaticMark : '';
  return `${mainSentence}${eventText}${automaticText}`;
}

/** stopPreview ("Descartar"): one layer's preview, or every one. */
export function describeStopPreview(
  command: CommandOfType<'stopPreview'>,
  names: EventLogNames,
): string {
  if (command.layerId === null) {
    return sentences.discardedEveryPreview;
  }
  return sentences.discardedPreviewOfLayer(nameLayerWithItsOutput(command.layerId, names));
}

/** previewClearLayer: the "vai limpar" marker. */
export function describePreviewClearLayer(
  command: CommandOfType<'previewClearLayer'>,
  names: EventLogNames,
): string {
  return sentences.markedLayerToClear(nameLayerWithItsOutput(command.layerId, names));
}

/** previewMacro: a macro's "Prévia". */
export function describePreviewMacro(
  command: CommandOfType<'previewMacro'>,
  names: EventLogNames,
): string {
  return sentences.previewedMacro(nameMacro(command.macroId, names));
}
