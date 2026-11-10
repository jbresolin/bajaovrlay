import type { Command, EventLogDetails } from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from '../store/reducers/reducerTypes.js';

/**
 * The details an accepted command's event-log row carries (gate 2 of PR #44): for a take
 * or a preview of an item, the layer it put the item on and that layer's output, read
 * from the instance it made (`newInstanceId`), so the history names where it happened even
 * after the item or the layer moves; for a restoreEvent, the status the event came back
 * from (BAJAOVRLAY-67), so "Mostrar de novo" reads apart from an undone "Descartar".
 * Undefined for every other command, and when nothing is found (the row has no details).
 */
export function findEventLogDetailsOfCommand(
  command: Command,
  slicesAfter: SlicesChangedByCommands,
  newInstanceId: string,
): EventLogDetails | undefined {
  if (command.type === 'restoreEvent') {
    return findStatusTheEventCameBackFrom(command.eventId, slicesAfter);
  }
  const isATakeOrAPreviewOfAnItem = command.type === 'takeItem' || command.type === 'previewItem';
  if (!isATakeOrAPreviewOfAnItem) {
    return undefined;
  }
  const instanceMade = slicesAfter.instances.find((instance) => instance.id === newInstanceId);
  if (instanceMade === undefined) {
    return undefined;
  }
  const layer = slicesAfter.layers.find((candidate) => candidate.id === instanceMade.layerId);
  if (layer === undefined) {
    return undefined;
  }
  return { placedOn: { layerId: layer.id, outputId: layer.outputId } };
}

/**
 * The status a restored event came back from: the change before its newest one, which is
 * the restore itself (restoreEvent.ts adds exactly one change).
 */
function findStatusTheEventCameBackFrom(
  eventId: string,
  slicesAfter: SlicesChangedByCommands,
): EventLogDetails | undefined {
  const restoredEvent = slicesAfter.events.find((event) => event.eventId === eventId);
  const statusBefore = restoredEvent?.statusChanges.at(-2)?.status;
  return statusBefore === undefined ? undefined : { restoredFrom: statusBefore };
}
