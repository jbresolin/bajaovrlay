import { type OperatorRole, OperatorRoleSchema } from '@bajaovrlay/shared';

// The actor of a command is `<role>:<connection id>`. Until operators log in there are
// three roles a connection can have (renderer, monitor, operator), and the role is all
// the authorisation step looks at. The operator role is spelt in pt-BR because the actor
// is shown to people in the event log; `monitor` is the same word in both languages. A
// fourth role, `sistema:<what>`, is never given to a connection: it signs what the
// server does by itself (the auto-out, `sistema:auto-out`, the macro runner,
// `sistema:macro:<macroId>`, the macro watchdog, `sistema:macro-watchdog`, the poller of
// each data source, `sistema:fonte:<sourceId>`, the recorder, `sistema:gravador`, the
// refresher of bound fields, `sistema:vinculos`, the event inbox's detection and runner,
// `sistema:eventos`, the media store, `sistema:midia`, the OBS connection,
// `sistema:obs`, the trigger service, `sistema:gatilhos`, and the backup download,
// `sistema:backup`). A fifth role, `api:<token
// name>`, signs a command sent over HTTP by a device of the command API (Companion, a
// Stream Deck, a script; BAJAOVRLAY-28): it stands where an operator stands. With the PINs
// set (BAJAOVRLAY-29) a control page is no longer `operador:<connection id>` but its login,
// `produtor:<station>` or `dados:<station>`, so the event log names who sent what.
const rendererRolePrefix = 'renderer:';
const monitorRolePrefix = 'monitor:';
const operatorRolePrefix = 'operador:';
const systemRolePrefix = 'sistema:';
const apiRolePrefix = 'api:';
const macroRunnerRolePrefix = 'sistema:macro:';
const dataSourcePollerRolePrefix = 'sistema:fonte:';

/**
 * The actor name the recorder signs its commands with: stopRecording when a write to a
 * recording failed (decision D9) or a recording reached its cap, and
 * recordRecordingProgress once lines are in a recording's file. It may send nothing else.
 */
export const dataSourceRecorderActor = 'sistema:gravador';

/**
 * The actor name the refresher of bound fields signs its refreshBoundInstanceData with
 * (BAJAOVRLAY-20): "vínculos" are the bindings. It may send nothing else.
 */
export const bindingRefresherActor = 'sistema:vinculos';

/**
 * The actor name the media store signs its recordUploadedMedia with (BAJAOVRLAY-19), once
 * the upload route has written the file: "mídia" is the store of images. It may send
 * nothing else.
 */
export const mediaStoreActor = 'sistema:midia';

/**
 * The actor name the macro watchdog signs its endMacroRun with. The hyphen keeps it out
 * of the runner's `sistema:macro:` prefix, so it is never mistaken for a macro's runner.
 */
export const macroWatchdogActor = 'sistema:macro-watchdog';

/**
 * The actor name the event inbox's detection and runner sign with (BAJAOVRLAY-44): it
 * records what the detectors found (recordDetectedEvents) and shows an event whose rule
 * says auto (showEvent). It may send nothing else.
 */
export const eventInboxActor = 'sistema:eventos';

/**
 * The actor name the server's OBS connection signs its reports with (BAJAOVRLAY-27):
 * recordObsState, what OBS is doing now, and recordObsSceneSwitchAnswer, OBS's answer to
 * a switch. It may send nothing else: it reports, it never decides what OBS shows.
 */
export const obsConnectionActor = 'sistema:obs';

/**
 * The actor name the trigger service signs its fireTrigger with (BAJAOVRLAY-48): it saw a
 * scene change, an HTTP call, an inbox event or a schedule moment, and says so. It may send
 * nothing else; a macro a firing starts is run by the macro runner, as any other run.
 */
export const triggerServiceActor = 'sistema:gatilhos';

/**
 * The actor name the backup download signs its recordBackup with (BAJAOVRLAY-33), once a
 * zip went out whole. It may send nothing else: it reads the data, it never changes it.
 */
export const backupActor = 'sistema:backup';

/** The actor name of a renderer page's connection. */
export function buildRendererActor(connectionId: string): string {
  return `${rendererRolePrefix}${connectionId}`;
}

/**
 * The actor name of a monitor's connection: a copy of the renderer page that the control
 * page frames ("Programa", "Prévia"). It only draws, so it may send nothing.
 */
export function buildMonitorActor(connectionId: string): string {
  return `${monitorRolePrefix}${connectionId}`;
}

/** The actor name of an operator's connection (every connection that is not a screen). */
export function buildOperatorActor(connectionId: string): string {
  return `${operatorRolePrefix}${connectionId}`;
}

/**
 * The actor name of a logged-in operator (BAJAOVRLAY-29): the role, a colon, and the
 * station typed at login, `produtor:Mesa 1`. Only the first colon counts when the role is
 * read back, so a station's own colon cannot change its role.
 */
export function buildLoggedInOperatorActor(role: OperatorRole, station: string): string {
  return `${role}:${station}`;
}

/** The role of a logged-in operator's actor name, or undefined for any other actor. */
export function readRoleOfLoggedInOperatorActor(actor: string): OperatorRole | undefined {
  const roleBeforeTheFirstColon = actor.slice(0, actor.indexOf(':'));
  const parsedRole = OperatorRoleSchema.safeParse(roleBeforeTheFirstColon);
  return parsedRole.success ? parsedRole.data : undefined;
}

/**
 * The actor name of a device of the command API, from the name its token has in
 * BAJAOVRLAY_API_TOKENS (`api:companion`). It names the device, never the token.
 */
export function buildApiActor(tokenName: string): string {
  return `${apiRolePrefix}${tokenName}`;
}

/** Whether an actor name belongs to a renderer page. */
export function isRendererActor(actor: string): boolean {
  return actor.startsWith(rendererRolePrefix);
}

/** Whether an actor name belongs to a monitor frame on the control page. */
export function isMonitorActor(actor: string): boolean {
  return actor.startsWith(monitorRolePrefix);
}

/** Whether an actor name belongs to the server itself, such as the auto-out scheduler. */
export function isSystemActor(actor: string): boolean {
  return actor.startsWith(systemRolePrefix);
}

/** The actor name the macro runner signs every command of one macro's run with. */
export function buildMacroRunnerActor(macroId: string): string {
  return `${macroRunnerRolePrefix}${macroId}`;
}

/**
 * The macro whose runner sent a command, read from the actor name, or undefined when
 * the actor is not a macro runner.
 */
export function readMacroIdOfMacroRunnerActor(actor: string): string | undefined {
  if (!actor.startsWith(macroRunnerRolePrefix)) {
    return undefined;
  }
  return actor.slice(macroRunnerRolePrefix.length);
}

/** The actor name the poller of one data source signs its poll results with. */
export function buildDataSourcePollerActor(sourceId: string): string {
  return `${dataSourcePollerRolePrefix}${sourceId}`;
}

/**
 * The data source whose poller sent a command, read from the actor name, or undefined
 * when the actor is not a data-source poller.
 */
export function readSourceIdOfDataSourcePollerActor(actor: string): string | undefined {
  if (!actor.startsWith(dataSourcePollerRolePrefix)) {
    return undefined;
  }
  return actor.slice(dataSourcePollerRolePrefix.length);
}
