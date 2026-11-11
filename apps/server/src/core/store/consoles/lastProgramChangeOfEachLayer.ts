import type { Instance, OperatorRole } from '@bajaovrlay/shared';

import { readRoleOfLoggedInOperatorActor } from '../commandActors.js';

/**
 * The last change of one layer's program output (BAJAOVRLAY-69): when it happened, on the
 * server clock, and which console made it. `consoleId` is left out when no console did (a
 * macro's step, a trigger, the command API, the auto-out); `consoleRole` is left out when
 * that console had no login (the PINs unset).
 */
export type ProgramChangeOfALayer = {
  changedAt: string;
  consoleId?: string;
  consoleRole?: OperatorRole;
};

/**
 * Each layer's last program change, by layer id. A layer never changed has no entry, and a
 * store starts with an empty one (a new Map of its own: a module-level one would be state
 * shared between the store of every test file).
 */
export type LastProgramChangeOfEachLayer = ReadonlyMap<string, ProgramChangeOfALayer>;

/**
 * The record after one accepted command: every layer whose program output now shows
 * another instance than before (a take, a clear, "Tomar tudo", a macro step, an undo, the
 * auto-out) gets `change`, whoever sent the command; every other layer keeps its entry.
 * "Próximo" and an edit on air keep the instance, so they change nothing here. Hands back
 * the very same record when no layer changed.
 * Deliberate (BAJAOVRLAY-69): the store keeps this record in memory, beside the slices, and
 * hands it to the reducers through their context, as it hands them the time. It is not a
 * slice because no page shows it and it would send every console's id to every other
 * page; it is not saved because it only matters for 2 s, so a restart loses nothing.
 */
export function rememberLastProgramChangeOfEachLayer(
  lastChanges: LastProgramChangeOfEachLayer,
  instancesBefore: Instance[],
  instancesAfter: Instance[],
  change: ProgramChangeOfALayer,
): LastProgramChangeOfEachLayer {
  if (instancesBefore === instancesAfter) {
    return lastChanges;
  }
  const programInstanceIdBefore = listProgramInstanceIdOfEachLayer(instancesBefore);
  const programInstanceIdAfter = listProgramInstanceIdOfEachLayer(instancesAfter);
  const layerIdsOnProgram = new Set([
    ...programInstanceIdBefore.keys(),
    ...programInstanceIdAfter.keys(),
  ]);

  const changedLayerIds = [...layerIdsOnProgram].filter(
    (layerId) => programInstanceIdBefore.get(layerId) !== programInstanceIdAfter.get(layerId),
  );
  if (changedLayerIds.length === 0) {
    return lastChanges;
  }
  const changesAfter = new Map(lastChanges);
  for (const layerId of changedLayerIds) {
    changesAfter.set(layerId, change);
  }
  return changesAfter;
}

/**
 * The change one command makes, signed: its moment on the server clock, and, when a console
 * sent it, that console's id and the role of its login (none with the PINs unset).
 */
export function signProgramChangeOfACommand(command: {
  now: string;
  actor: string;
  consoleId: string | undefined;
}): ProgramChangeOfALayer {
  const change: ProgramChangeOfALayer = { changedAt: command.now };
  if (command.consoleId === undefined) {
    return change;
  }
  change.consoleId = command.consoleId;
  const consoleRole = readRoleOfLoggedInOperatorActor(command.actor);
  if (consoleRole !== undefined) {
    change.consoleRole = consoleRole;
  }
  return change;
}

/** The id of the instance on the program output of each layer, by layer id. */
function listProgramInstanceIdOfEachLayer(instances: Instance[]): Map<string, string> {
  const instanceIdOfEachLayer = new Map<string, string>();
  for (const instance of instances) {
    if (instance.target === 'program') {
      instanceIdOfEachLayer.set(instance.layerId, instance.id);
    }
  }
  return instanceIdOfEachLayer;
}
