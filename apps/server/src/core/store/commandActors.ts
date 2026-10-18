// The actor of a command is `<role>:<connection id>`. Until operators log in there are
// three roles a connection can have (renderer, monitor, operator), and the role is all
// the authorisation step looks at. The operator role is spelt in pt-BR because the actor
// is shown to people in the event log; `monitor` is the same word in both languages. A
// fourth role, `sistema:<what>`, is never given to a connection: it signs what the
// server does by itself (the auto-out, `sistema:auto-out`, the macro runner,
// `sistema:macro:<macroId>`, the macro watchdog, `sistema:macro-watchdog`, the poller of
// each data source, `sistema:fonte:<sourceId>`, and the recorder, `sistema:gravador`).
const rendererRolePrefix = 'renderer:';
const monitorRolePrefix = 'monitor:';
const operatorRolePrefix = 'operador:';
const systemRolePrefix = 'sistema:';
const macroRunnerRolePrefix = 'sistema:macro:';
const dataSourcePollerRolePrefix = 'sistema:fonte:';

/**
 * The actor name the recorder signs its commands with: stopRecording when a write to a
 * recording failed (decision D9) or a recording reached its cap, and
 * recordRecordingProgress once lines are in a recording's file. It may send nothing else.
 */
export const dataSourceRecorderActor = 'sistema:gravador';

/**
 * The actor name the macro watchdog signs its endMacroRun with. The hyphen keeps it out
 * of the runner's `sistema:macro:` prefix, so it is never mistaken for a macro's runner.
 */
export const macroWatchdogActor = 'sistema:macro-watchdog';

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
