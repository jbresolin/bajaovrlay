// The history sentences of the setup: outputs, layers, OBS's connection (BAJAOVRLAY-30)
// and backups (BAJAOVRLAY-33).
// One named formatter per command type, gathered in sentenceOfEachCommandType.ts.
import { formatBackupSize } from '../backup/backupSizeText.js';
import type { CommandOfType } from './commandOfType.js';
import type { EventLogNames } from './eventLogNames.js';
import { nameLayerWithItsOutput, nameOutput } from './namesInSentences.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';

const sentences = ptBREventLogReading.settings;

/** createOutput ("+ Saída"): its name and the address it gets. */
export function describeCreateOutput(command: CommandOfType<'createOutput'>): string {
  return sentences.createdOutput(command.name, command.outputId);
}

/** renameOutput: by its address, since its old name is already gone. */
export function describeRenameOutput(command: CommandOfType<'renameOutput'>): string {
  return sentences.renamedOutput(command.outputId, command.name);
}

/** deleteOutput. */
export function describeDeleteOutput(
  command: CommandOfType<'deleteOutput'>,
  names: EventLogNames,
): string {
  return sentences.deletedOutput(nameOutput(command.outputId, names));
}

/** reorderOutputs. */
export function describeReorderOutputs(): string {
  return sentences.reorderedOutputs;
}

/** createLayer ("+ Camada"), on its output. */
export function describeCreateLayer(
  command: CommandOfType<'createLayer'>,
  names: EventLogNames,
): string {
  return sentences.createdLayer(command.name, nameOutput(command.outputId, names));
}

/** updateLayer (a layer's name, height, swap or "fixa"). */
export function describeUpdateLayer(
  command: CommandOfType<'updateLayer'>,
  names: EventLogNames,
): string {
  return sentences.editedLayer(nameLayerWithItsOutput(command.layerId, names));
}

/** moveLayerToOutput. */
export function describeMoveLayerToOutput(
  command: CommandOfType<'moveLayerToOutput'>,
  names: EventLogNames,
): string {
  return sentences.movedLayerToOutput(
    nameLayerWithItsOutput(command.layerId, names),
    nameOutput(command.outputId, names),
  );
}

/** reorderLayers, within one output. */
export function describeReorderLayers(
  command: CommandOfType<'reorderLayers'>,
  names: EventLogNames,
): string {
  return sentences.reorderedLayers(nameOutput(command.outputId, names));
}

/** deleteLayer: by its id, since it is gone. */
export function describeDeleteLayer(
  command: CommandOfType<'deleteLayer'>,
  names: EventLogNames,
): string {
  return sentences.deletedLayer(nameLayerWithItsOutput(command.layerId, names));
}

/** recordObsState: OBS's connection as the server last heard it. */
export function describeRecordObsState(command: CommandOfType<'recordObsState'>): string {
  const stateLabel = ptBREventLogReading.obsConnectionStateLabels[command.status.connectionState];
  return sentences.obsConnection(stateLabel);
}

/** recordBackup: the zip the operator downloaded, its size, and whether recordings are in it. */
export function describeRecordBackup(command: CommandOfType<'recordBackup'>): string {
  const sizeText = formatBackupSize(command.sizeInBytes);
  if (command.includesRecordings) {
    return sentences.backedUp(command.fileName, sizeText);
  }
  return sentences.backedUpWithoutRecordings(command.fileName, sizeText);
}
