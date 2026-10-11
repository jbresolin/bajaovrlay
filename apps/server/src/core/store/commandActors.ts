// The actor of a command is `<role>:<connection id>`. Until operators log in there are
// two roles a connection can have, and the role is all the authorisation step looks at.
// The operator role is spelt in pt-BR because the actor is shown to people in the event
// log. A third role, `sistema:<what>`, is never given to a connection: it signs what the
// server does by itself (today only the auto-out, `sistema:auto-out`).
const rendererRolePrefix = 'renderer:';
const operatorRolePrefix = 'operador:';
const systemRolePrefix = 'sistema:';

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
