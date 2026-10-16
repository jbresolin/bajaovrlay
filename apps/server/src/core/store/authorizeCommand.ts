import type { Command } from '@bajaovrlay/shared';

import {
  isRendererActor,
  isSystemActor,
  macroWatchdogActor,
  readMacroIdOfMacroRunnerActor,
} from './commandActors.js';

/**
 * The authorisation step of applyCommand: answers whether this actor may run this
 * command. A store can be given a different one (tests do, and login will).
 */
export type IsCommandAllowed = (command: Command, actor: string) => boolean;

// The commands a macro step may become (MacroStep in @bajaovrlay/shared).
const commandTypesOfMacroSteps: ReadonlyArray<Command['type']> = [
  'takeItem',
  'clearLayer',
  'clearAll',
];

/**
 * The default hook while there is no operator login. It decides by the actor's role
 * alone:
 * - a renderer may only report what is on screen (reportInstanceStatus), and nobody
 *   else may send that report;
 * - the macro runner (`sistema:macro:<macroId>`) may send what a macro step becomes
 *   (takeItem, clearLayer, clearAll) and the bookkeeping of its own run
 *   (advanceMacroRun, endMacroRun naming that same macro), and nothing else: a macro
 *   cannot start a macro, edit anything, or take a graphic by hand;
 * - the macro watchdog (`sistema:macro-watchdog`) may only end a run (endMacroRun, of
 *   any macro): it ends a run gone on past its time limit and undoes nothing;
 * - every other server timer (`sistema:`, today the auto-out) may only clear one layer:
 *   a bug in a timer must never be able to put a graphic on air or empty the screen;
 * - every other actor (an operator) may send everything else, except the runner's
 *   bookkeeping, so no page can fake or end a run the runner is carrying out; an
 *   operator stops a run with stopMacro ("Parar"), which the runner then ends.
 * The role comes from the address the connection chose (`/ws?role=renderer`), so this
 * keeps honest pages in their lane; it is not a defence against a hostile client.
 * A new job for the system that needs another command must be added here, or its
 * commands are refused with NOT_ALLOWED.
 */
export const allowCommandForActorRole: IsCommandAllowed = (command, actor) => {
  const isReportFromTheScreen = command.type === 'reportInstanceStatus';
  const isMacroRunBookkeeping =
    command.type === 'advanceMacroRun' || command.type === 'endMacroRun';
  if (isRendererActor(actor)) {
    return isReportFromTheScreen;
  }
  if (actor === macroWatchdogActor) {
    return command.type === 'endMacroRun';
  }
  const macroIdOfTheRunner = readMacroIdOfMacroRunnerActor(actor);
  if (macroIdOfTheRunner !== undefined) {
    return isAllowedForTheRunnerOfMacro(command, macroIdOfTheRunner);
  }
  if (isSystemActor(actor)) {
    return command.type === 'clearLayer';
  }
  return !isReportFromTheScreen && !isMacroRunBookkeeping;
};

/** What the runner of one macro may send: a step's command, or its own run's bookkeeping. */
function isAllowedForTheRunnerOfMacro(command: Command, macroIdOfTheRunner: string): boolean {
  if (command.type === 'advanceMacroRun' || command.type === 'endMacroRun') {
    return command.macroId === macroIdOfTheRunner;
  }
  return commandTypesOfMacroSteps.includes(command.type);
}
