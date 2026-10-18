import {
  buildMonitorActor,
  buildOperatorActor,
  buildRendererActor,
  isMonitorActor,
  isRendererActor,
} from '../store/commandActors.js';

// The values of the `role` query field that make a connection a screen: the renderer
// page OBS loads, and the copies of it the control page frames as monitors.
const rendererRoleInTheAddress = 'renderer';
const monitorRoleInTheAddress = 'monitor';

/**
 * The actor name for a new WebSocket connection: `renderer:<connection id>` when it
 * connected to `/ws?role=renderer`, `monitor:<connection id>` for `/ws?role=monitor`,
 * `operador:<connection id>` for anything else. There is no login yet, so the address is
 * the only thing a connection says about itself.
 */
export function buildActorForConnection(
  requestTarget: string | undefined,
  connectionId: string,
): string {
  const roleInTheAddress = readRoleFromRequestTarget(requestTarget);
  if (roleInTheAddress === rendererRoleInTheAddress) {
    return buildRendererActor(connectionId);
  }
  if (roleInTheAddress === monitorRoleInTheAddress) {
    return buildMonitorActor(connectionId);
  }
  return buildOperatorActor(connectionId);
}

/**
 * Whether a connection's actor is a screen (a renderer or a monitor), which the hub
 * never sends the slices listed in slicesHiddenFromScreens.ts.
 */
export function isScreenConnectionActor(actor: string): boolean {
  return isRendererActor(actor) || isMonitorActor(actor);
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
