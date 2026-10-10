import { buildOperatorActor, buildRendererActor } from '../store/commandActors.js';

// The one value of the `role` query field that makes a connection a renderer.
const rendererRoleInTheAddress = 'renderer';

/**
 * The actor name for a new WebSocket connection: `renderer:<connection id>` when it
 * connected to `/ws?role=renderer`, `operador:<connection id>` for anything else. There
 * is no login yet, so the address is the only thing a connection says about itself.
 */
export function buildActorForConnection(
  requestTarget: string | undefined,
  connectionId: string,
): string {
  const roleInTheAddress = readRoleFromRequestTarget(requestTarget);
  if (roleInTheAddress === rendererRoleInTheAddress) {
    return buildRendererActor(connectionId);
  }
  return buildOperatorActor(connectionId);
}

/**
 * The `role` query field of an upgrade request, or null when there is none or the
 * target is not a URL (`new URL` throws on targets such as `http://[`; a throw inside
 * the hub's connection listener would crash the server that owns the state).
 */
function readRoleFromRequestTarget(requestTarget: string | undefined): string | null {
  try {
    return new URL(requestTarget ?? '/', 'http://localhost').searchParams.get('role');
  } catch {
    return null;
  }
}
