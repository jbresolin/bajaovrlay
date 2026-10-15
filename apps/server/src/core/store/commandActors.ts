// The actor of a command is `<role>:<connection id>`. Until operators log in there are
// two roles a connection can have, and the role is all the authorisation step looks at.
// The operator role is spelt in pt-BR because the actor is shown to people in the event
// log. A third role, `sistema:<what>`, is never given to a connection: it signs what the
// server does by itself (the auto-out, `sistema:auto-out`, and the macro runner,
// `sistema:macro:<macroId>`).
const rendererRolePrefix = 'renderer:';
const operatorRolePrefix = 'operador:';
const systemRolePrefix = 'sistema:';
const macroRunnerRolePrefix = 'sistema:macro:';

/** The actor name of a renderer page's connection. */
export function buildRendererActor(connectionId: string): string {
  return `${rendererRolePrefix}${connectionId}`;
}

/** The actor name of an operator's connection (every connection that is not a renderer). */
export function buildOperatorActor(connectionId: string): string {
  return `${operatorRolePrefix}${connectionId}`;
}

/** Whether an actor name belongs to a renderer page. */
export function isRendererActor(actor: string): boolean {
  return actor.startsWith(rendererRolePrefix);
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
