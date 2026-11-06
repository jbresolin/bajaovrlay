import { type Command, CommandSchema } from '../commands/command.js';
import { senderOfEachCommandType } from '../commands/commandSenders.js';
import type { EventLogDetails, EventLogEntry } from '../slices/eventLogEntry.js';
import { type EventLogActorKind, readWhoSentEventLogRow } from './eventLogActors.js';
import {
  commandGroupOfEachCommandType,
  type EventLogCommandGroup,
} from './eventLogCommandGroups.js';
import type { EventLogNames } from './eventLogNames.js';
import { findLayerIdWhereItemWent } from './namesInSentences.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';
import { describeCommand } from './sentenceOfEachCommandType.js';
import {
  describeImportAsTheLogKeepsIt,
  describePollAsTheLogKeepsIt,
} from './sentencesOfSourcesAndData.js';
import { ImportAsTheLogKeepsItSchema, PollAsTheLogKeepsItSchema } from './trimmedPayloads.js';

/**
 * One event-log row as the history page shows it (BAJAOVRLAY-30): when, who, one pt-BR
 * sentence, whether it was refused, and, for the filters, its command group (null for a
 * command this server does not know) and the layers it touched.
 */
export type DescribedEventLogEntry = {
  id: number;
  ts: string;
  who: { kind: EventLogActorKind; label: string };
  sentence: string;
  isRefusal: boolean;
  group: EventLogCommandGroup | null;
  layerIds: string[];
};

/**
 * Describes one event-log row with the names as they are now. The server runs it for the
 * older pages of GET /api/v1/event-log (so the text filter matches the same sentence the
 * page shows) and the control page for the live rows. A refused row reads
 * "Recusado: <sentence> — <reason>".
 */
export function describeEventLogEntry(
  entry: EventLogEntry,
  names: EventLogNames,
): DescribedEventLogEntry {
  const reading = readCommandOfEntry(entry, names);
  const isRefusal = entry.result.status === 'failed';
  const sentence =
    entry.result.status === 'failed'
      ? ptBREventLogReading.refused(reading.sentence, entry.result.error.message)
      : reading.sentence;
  return {
    id: entry.id,
    ts: entry.ts,
    who: readWhoSentEventLogRow(entry.actor),
    sentence,
    isRefusal,
    group: readGroupOfCommandName(entry.command),
    layerIds: reading.layerIds,
  };
}

/** What a row's payload says: its sentence, and the layers it touched. */
function readCommandOfEntry(
  entry: EventLogEntry,
  names: EventLogNames,
): { sentence: string; layerIds: string[] } {
  const parsedCommand = CommandSchema.safeParse(entry.payload);
  if (parsedCommand.success) {
    return {
      sentence: describeCommand(parsedCommand.data, names, entry.details),
      layerIds: listLayersCommandTouches(parsedCommand.data, names, entry.details),
    };
  }
  // A poll and an import are logged trimmed, so they never pass CommandSchema.
  const trimmedPoll = PollAsTheLogKeepsItSchema.safeParse(entry.payload);
  if (trimmedPoll.success) {
    return { sentence: describePollAsTheLogKeepsIt(trimmedPoll.data, names), layerIds: [] };
  }
  const trimmedImport = ImportAsTheLogKeepsItSchema.safeParse(entry.payload);
  if (trimmedImport.success) {
    return { sentence: describeImportAsTheLogKeepsIt(trimmedImport.data), layerIds: [] };
  }
  const withoutSentence = ptBREventLogReading.withoutSentence;
  const isKnownCommandType = readGroupOfCommandName(entry.command) !== null;
  const sentence = isKnownCommandType
    ? withoutSentence.unreadablePayload(entry.command)
    : withoutSentence.unknownCommand(entry.command);
  return { sentence, layerIds: [] };
}

/**
 * The group of a command named in a row, or null when this server has no such command
 * (one removed since, such as takeGraphic, or `unknown` for a message with no type).
 */
function readGroupOfCommandName(commandName: string): EventLogCommandGroup | null {
  const isKnownCommandType = Object.hasOwn(senderOfEachCommandType, commandName);
  if (!isKnownCommandType) {
    return null;
  }
  return commandGroupOfEachCommandType[commandName as Command['type']];
}

// The commands that touch every layer at once, for the layer filter.
const commandTypesTouchingEveryLayer: ReadonlyArray<Command['type']> = [
  'clearAll',
  'takeAllPreviews',
  'undoLastChangeOnProgram',
];

/**
 * The layers a command touched, for the layer filter: every layer for "Limpar tudo",
 * "Tomar tudo", "Desfazer última" and "Descartar" of every preview; else the layer it
 * names, the layer the item it names went to (recorded in the row's details, or the
 * item's layer now for a row written before; namesInSentences.ts), or the layer of the
 * instance it names while that instance is still on a layer. A command about none of these
 * touches no layer.
 */
export function listLayersCommandTouches(
  command: Command,
  names: EventLogNames,
  details?: EventLogDetails,
): string[] {
  const everyLayerId = names.layers.map((layer) => layer.id);
  if (commandTypesTouchingEveryLayer.includes(command.type)) {
    return everyLayerId;
  }
  // stopPreview names null for every layer; updateItemFields names a layer only when it
  // moves the item, and is then read by that layer.
  const namedLayerId = 'layerId' in command ? command.layerId : undefined;
  if (namedLayerId === null) {
    return everyLayerId;
  }
  if (namedLayerId !== undefined) {
    return [namedLayerId];
  }
  // moveCursor names null for "the end", and an event rule may name no item.
  const namedItemId = 'itemId' in command ? command.itemId : undefined;
  if (namedItemId !== undefined && namedItemId !== null) {
    const layerIdOfItem = findLayerIdWhereItemWent(namedItemId, details, names);
    return layerIdOfItem === undefined ? [] : [layerIdOfItem];
  }
  if ('instanceId' in command) {
    const instance = names.instances.find((candidate) => candidate.id === command.instanceId);
    return instance === undefined ? [] : [instance.layerId];
  }
  return [];
}
