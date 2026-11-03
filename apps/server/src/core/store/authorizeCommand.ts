import { type Command, isCommandTypeOfTheOperator } from '@bajaovrlay/shared';

import {
  bindingRefresherActor,
  dataSourceRecorderActor,
  eventInboxActor,
  isMonitorActor,
  isRendererActor,
  isSystemActor,
  macroWatchdogActor,
  mediaStoreActor,
  obsConnectionActor,
  readMacroIdOfMacroRunnerActor,
  readSourceIdOfDataSourcePollerActor,
  triggerServiceActor,
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
  'switchObsScene',
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
 *   (takeItem, clearLayer, clearAll, switchObsScene) and the bookkeeping of its own run
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
 * - the refresher of bound fields (`sistema:vinculos`) may only send
 *   refreshBoundInstanceData, the new values of an instance's live bound fields after its
 *   source's data changed, and nobody else may send that (BAJAOVRLAY-20);
 * - the event inbox's detection and runner (`sistema:eventos`) may only record the events
 *   it detected (recordDetectedEvents), which nobody else may send, and show an event
 *   (showEvent): it never dismisses, types, changes a rule or takes anything else
 *   (BAJAOVRLAY-44);
 * - the media store (`sistema:midia`) may only send recordUploadedMedia, which lists a
 *   file the upload route has just written, and nobody else may: a page that could would
 *   list an image with no file behind it (BAJAOVRLAY-19);
 * - the OBS connection (`sistema:obs`) may only report what OBS is doing (recordObsState)
 *   and how OBS answered a switch (recordObsSceneSwitchAnswer), and nobody else may: a
 *   page that could would show a scene OBS is not showing, or let a macro go on over the
 *   wrong scene (BAJAOVRLAY-27);
 * - the trigger service (`sistema:gatilhos`) may only fire a trigger (fireTrigger), and
 *   nobody else may: a firing stands for a scene change, a call, an event or a moment the
 *   service saw, and its rules against loops read its cause (BAJAOVRLAY-48);
 * - a takeItem carrying a trigger's data (`triggerFill`) is the macro runner's alone: an
 *   operator's take uses the item's own values, so no page can put text on air that looks
 *   as if a trigger brought it;
 * - every other server timer (`sistema:`, today the auto-out) may only clear one layer:
 *   a bug in a timer must never be able to put a graphic on air or empty the screen;
 * - every other actor (an operator, `operador:<connection id>`, and a device of the
 *   command API, `api:<token name>`, BAJAOVRLAY-28) may send every command the shared
 *   list classes as the operator's (senderOfEachCommandType in @bajaovrlay/shared), so
 *   none of the commands only the server sends: the runner's bookkeeping, so no page can
 *   fake or end a run the runner is carrying out (an operator stops a run with stopMacro,
 *   "Parar", which the runner then ends), poll results and a recording's progress, so no
 *   page can fake race data or a count, the OBS connection's reports,
 *   refreshBoundInstanceData (a value typed over a live field is a correction, made with
 *   setOverride), recordDetectedEvents (no page may fake a race event),
 *   recordUploadedMedia, and the renderer's report; and not a
 *   stopRecording that carries a failureMessage either: only the recorder says why a
 *   recording failed (gate 2 on PR #16).
 * The role comes from the address the connection chose (`/ws?role=renderer`,
 * `/ws?role=monitor`), so this keeps honest pages in their lane; it is not a defence
 * against a hostile client.
 * A new job for the system that needs another command must be added here, or its
 * commands are refused with NOT_ALLOWED.
 */
export const allowCommandForActorRole: IsCommandAllowed = (command, actor) => {
  const isReportFromTheScreen = command.type === 'reportInstanceStatus';
  const isPollResult = command.type === 'recordDataSourcePoll';
  const isRefreshOfBoundFields = command.type === 'refreshBoundInstanceData';
  const isRecordOfDetectedEvents = command.type === 'recordDetectedEvents';
  const isRecordOfAnUpload = command.type === 'recordUploadedMedia';
  const isTakeFilledByATrigger =
    command.type === 'takeItem' && command.triggerFill !== undefined;
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
  if (actor === bindingRefresherActor) {
    return isRefreshOfBoundFields;
  }
  if (actor === eventInboxActor) {
    return isRecordOfDetectedEvents || command.type === 'showEvent';
  }
  if (actor === mediaStoreActor) {
    return isRecordOfAnUpload;
  }
  if (actor === obsConnectionActor) {
    return command.type === 'recordObsState' || command.type === 'recordObsSceneSwitchAnswer';
  }
  if (actor === triggerServiceActor) {
    return command.type === 'fireTrigger';
  }
  if (actor === dataSourceRecorderActor) {
    return command.type === 'stopRecording' || command.type === 'recordRecordingProgress';
  }
  if (isSystemActor(actor)) {
    return command.type === 'clearLayer';
  }
  return (
    isCommandTypeOfTheOperator(command.type) && !isRecorderBookkeeping && !isTakeFilledByATrigger
  );
};

/** What the runner of one macro may send: a step's command, or its own run's bookkeeping. */
function isAllowedForTheRunnerOfMacro(command: Command, macroIdOfTheRunner: string): boolean {
  if (command.type === 'advanceMacroRun' || command.type === 'endMacroRun') {
    return command.macroId === macroIdOfTheRunner;
  }
  return commandTypesOfMacroSteps.includes(command.type);
}
