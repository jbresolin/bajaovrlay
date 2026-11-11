import type {
  CommandError,
  EventLogDetails,
  Instance,
  InstanceIdSeenOnAir,
  TakeRefusedForAnotherConsole,
} from '@bajaovrlay/shared';

import { ptBR } from '../../messages/ptBR.js';
import { readRoleOfLoggedInOperatorActor } from '../commandActors.js';
import type { ReducerContext, SlicesChangedByCommands } from '../reducers/reducerTypes.js';
import type { ProgramChangeOfALayer } from './lastProgramChangeOfEachLayer.js';

/**
 * How long another console's change of a layer counts as possibly unseen: 2 s (João's
 * ruling, option C, 2026-11-10; docs/decisions.md). Why 2 s: a slice reaches a console on
 * the studio LAN in well under 100 ms, and an operator reacts to what changed on a monitor
 * in about half a second, so a take sent 2 s after the other console's had every chance to
 * be a decision about it. Longer would refuse a deliberate replacement made right after
 * looking; shorter would let a take that crossed the other one on the wire through.
 * Measured on the server clock (core/time), between the two moments the store stamped.
 */
export const anotherConsolesChangeCountsAsUnseenForMs = 2_000;

/** Another console's change of a layer that the console taking now had not seen. */
export type UnseenChangeByAnotherConsole = {
  change: ProgramChangeOfALayer;
  /** How long before this take it happened, on the server clock, in milliseconds. */
  elapsedMs: number;
  /** What that change left on the layer's program output: an instance, or nothing. */
  instanceOnAirNow: Instance | undefined;
};

/**
 * The change of this layer another console made unseen by the one taking now, or undefined
 * when the take may go through. It goes through (as before BAJAOVRLAY-69) unless all of these
 * hold: the command came from a console and says what it saw on air; the layer's program
 * output now shows something else; the layer's last change came from another console; and
 * that change is less than 2 s old. So one operator's quick presses, a macro, a trigger,
 * the command API and the D200 buttons are never refused, and neither is a take made after
 * the page had shown the other console's.
 */
export function findUnseenChangeByAnotherConsole(parts: {
  layerId: string;
  instanceIdSeenOnAir: InstanceIdSeenOnAir | undefined;
  instances: Instance[];
  context: ReducerContext;
}): UnseenChangeByAnotherConsole | undefined {
  const { layerId, instanceIdSeenOnAir, context } = parts;
  const takingConsoleId = context.consoleId;
  if (takingConsoleId === undefined || instanceIdSeenOnAir === undefined) {
    return undefined;
  }

  const instanceOnAirNow = parts.instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
  const instanceIdOnAirNow = instanceOnAirNow?.id ?? null;
  if (instanceIdOnAirNow === instanceIdSeenOnAir) {
    return undefined;
  }

  const lastChange = context.lastProgramChangeOfEachLayer?.get(layerId);
  if (lastChange === undefined) {
    return undefined;
  }
  const wasChangedByAConsole = lastChange.consoleId !== undefined;
  const wasChangedByAnotherConsole =
    wasChangedByAConsole && lastChange.consoleId !== takingConsoleId;
  if (!wasChangedByAnotherConsole) {
    return undefined;
  }

  // A server clock stepped back since the change gives a negative time: it counts as
  // within the 2 s, so a take is refused rather than replacing the other console's unseen.
  const elapsedMs = Date.parse(context.now) - Date.parse(lastChange.changedAt);
  if (elapsedMs >= anotherConsolesChangeCountsAsUnseenForMs) {
    return undefined;
  }
  return { change: lastChange, elapsedMs, instanceOnAirNow };
}

/** What a refused take answers, and what its event-log row keeps of it. */
export type RefusalForAnUnseenChange = {
  error: CommandError;
  takeRefused: TakeRefusedForAnotherConsole;
};

/**
 * The refusal of a take over another console's unseen change: LAYER_CHANGED_BY_ANOTHER_CONSOLE,
 * with a sentence naming the other console's role, what it did to the layer and how long
 * ago, and what of this take was not done; and the event-log entry with both roles.
 * `whatWasNotDone` is the item this take would have put on air, or `clear` for a layer
 * "Tomar tudo" was to clear.
 */
export function refuseTakeOverAnUnseenChange(parts: {
  unseenChange: UnseenChangeByAnotherConsole;
  layerId: string;
  slices: SlicesChangedByCommands;
  context: ReducerContext;
  whatWasNotDone: { kind: 'take'; itemLabel: string } | { kind: 'clear' };
}): RefusalForAnUnseenChange {
  const { unseenChange, layerId, slices, context } = parts;
  const texts = ptBR.consoleErrors;
  const layerName = slices.layers.find((layer) => layer.id === layerId)?.name ?? layerId;

  const otherConsoleRole = unseenChange.change.consoleRole;
  const otherConsole = texts.otherConsole(
    otherConsoleRole === undefined ? undefined : texts.roleNames[otherConsoleRole],
  );
  const instanceOnAirNow = unseenChange.instanceOnAirNow;
  const whatTheOtherConsoleDid =
    instanceOnAirNow === undefined
      ? texts.otherConsoleCleared(layerName)
      : texts.otherConsoleTook(nameWhatIsOnAir(instanceOnAirNow, slices), layerName);
  const whatWasNotDone =
    parts.whatWasNotDone.kind === 'take'
      ? texts.yourTakeOf(parts.whatWasNotDone.itemLabel)
      : texts.yourClear;
  const message = texts.layerChangedByAnotherConsole({
    otherConsole,
    whatTheOtherConsoleDid,
    howLongAgo: texts.howLongAgo(writeSecondsWithOneDecimal(unseenChange.elapsedMs)),
    whatWasNotDone,
  });

  const takeRefused: TakeRefusedForAnotherConsole = {
    layerId,
    otherConsoleChangedAt: unseenChange.change.changedAt,
  };
  const refusedConsoleRole = readRoleOfLoggedInOperatorActor(context.actor);
  if (refusedConsoleRole !== undefined) {
    takeRefused.refusedConsoleRole = refusedConsoleRole;
  }
  if (otherConsoleRole !== undefined) {
    takeRefused.otherConsoleRole = otherConsoleRole;
  }
  return { error: { code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE', message }, takeRefused };
}

/**
 * An event-log row's details with the takes refused because another console had just
 * changed their layer added (a refused take, or a "Tomar tudo" that left layers); the
 * details as they were when there were none, undefined when there is nothing at all.
 */
export function addTakesRefusedToTheDetails(
  detailsSoFar: EventLogDetails | undefined,
  takesRefused: TakeRefusedForAnotherConsole[] | undefined,
): EventLogDetails | undefined {
  if (takesRefused === undefined || takesRefused.length === 0) {
    return detailsSoFar;
  }
  return { ...detailsSoFar, takesRefusedForAnotherConsole: takesRefused };
}

/**
 * How the operator knows what is on air: the label of the item it came from, else the
 * graphic's name (an item deleted since, or one taken by hand before BAJAOVRLAY-37).
 */
function nameWhatIsOnAir(instance: Instance, slices: SlicesChangedByCommands): string {
  const item = slices.items.find((candidate) => candidate.id === instance.itemId);
  if (item !== undefined) {
    return item.label;
  }
  const graphic = slices.graphics.find((candidate) => candidate.id === instance.graphicId);
  return graphic?.manifest.name ?? instance.graphicId;
}

/**
 * "0,8": the seconds rounded down to a tenth, with the comma pt-BR writes. Rounded down so
 * 1999 ms reads "1,9" and never "2,0", which would contradict "less than 2 s".
 */
function writeSecondsWithOneDecimal(elapsedMs: number): string {
  const tenthsOfASecond = Math.floor(Math.max(0, elapsedMs) / 100);
  const secondsWithADot = (tenthsOfASecond / 10).toFixed(1);
  return secondsWithADot.replace('.', ',');
}
