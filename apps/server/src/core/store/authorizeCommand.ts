import type { Command } from '@bajaovrlay/shared';

import {
  dataSourceRecorderActor,
  isMonitorActor,
  isRendererActor,
  isSystemActor,
  macroWatchdogActor,
  readMacroIdOfMacroRunnerActor,
  readSourceIdOfDataSourcePollerActor,
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
 * - a monitor (`monitor:<connection id>`, the control page's "Programa" and "Prévia"
 *   frames) may send nothing at all: it only draws, and the renderer page gives a
 *   monitor no reporter and sends no command, so anything from it is a mistake;
 * - the macro runner (`sistema:macro:<macroId>`) may send what a macro step becomes
 *   (takeItem, clearLayer, clearAll) and the bookkeeping of its own run
 *   (advanceMacroRun, endMacroRun naming that same macro), and nothing else: a macro
 *   cannot start a macro, edit anything, or take a graphic by hand;
 * - the macro watchdog (`sistema:macro-watchdog`) may only end a run (endMacroRun, of
 *   any macro): it ends a run gone on past its time limit and undoes nothing;
 * - the poller of a data source (`sistema:fonte:<sourceId>`) may only report polls of
 *   that same source (recordDataSourcePoll): a bug in one loop must not overwrite
 *   another source's data, and a poller reports, it never decides;
 * - the recorder (`sistema:gravador`) may only stop a recording (stopRecording), which it
 *   does when a write to the file failed or the recording reached its cap, and report how
 *   many lines are in a recording's file (recordRecordingProgress);
 * - every other server timer (`sistema:`, today the auto-out) may only clear one layer:
 *   a bug in a timer must never be able to put a graphic on air or empty the screen;
 * - every other actor (an operator) may send everything else, except the runner's
 *   bookkeeping, so no page can fake or end a run the runner is carrying out (an
 *   operator stops a run with stopMacro, "Parar", which the runner then ends), except
 *   poll results and a recording's progress, so no page can fake race data or a count,
 *   and except a stopRecording that carries a failureMessage: only the recorder says why
 *   a recording failed (gate 2 on PR #16).
 * The role comes from the address the connection chose (`/ws?role=renderer`,
 * `/ws?role=monitor`), so this keeps honest pages in their lane; it is not a defence
 * against a hostile client.
 * A new job for the system that needs another command must be added here, or its
 * commands are refused with NOT_ALLOWED.
 */
export const allowCommandForActorRole: IsCommandAllowed = (command, actor) => {
  const isReportFromTheScreen = command.type === 'reportInstanceStatus';
  const isMacroRunBookkeeping =
    command.type === 'advanceMacroRun' || command.type === 'endMacroRun';
  const isPollResult = command.type === 'recordDataSourcePoll';
  const isRecorderBookkeeping =
    command.type === 'recordRecordingProgress' ||
    (command.type === 'stopRecording' && command.failureMessage !== undefined);
  if (isRendererActor(actor)) {
    return isReportFromTheScreen;
  }
  if (isMonitorActor(actor)) {
    return false;
  }
  if (actor === macroWatchdogActor) {
    return command.type === 'endMacroRun';
  }
  const macroIdOfTheRunner = readMacroIdOfMacroRunnerActor(actor);
  if (macroIdOfTheRunner !== undefined) {
    return isAllowedForTheRunnerOfMacro(command, macroIdOfTheRunner);
  }
  const sourceIdOfThePoller = readSourceIdOfDataSourcePollerActor(actor);
  if (sourceIdOfThePoller !== undefined) {
    return isPollResult && command.sourceId === sourceIdOfThePoller;
  }
  if (actor === dataSourceRecorderActor) {
    return command.type === 'stopRecording' || command.type === 'recordRecordingProgress';
  }
  if (isSystemActor(actor)) {
    return command.type === 'clearLayer';
  }
  return (
    !isReportFromTheScreen && !isMacroRunBookkeeping && !isPollResult && !isRecorderBookkeeping
  );
};

/** What the runner of one macro may send: a step's command, or its own run's bookkeeping. */
function isAllowedForTheRunnerOfMacro(command: Command, macroIdOfTheRunner: string): boolean {
  if (command.type === 'advanceMacroRun' || command.type === 'endMacroRun') {
    return command.macroId === macroIdOfTheRunner;
  }
  return commandTypesOfMacroSteps.includes(command.type);
}
