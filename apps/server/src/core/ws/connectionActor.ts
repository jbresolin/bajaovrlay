import type { OpenOperatorSession } from '../operatorLogin/operatorSessions.js';
import {
  buildLoggedInOperatorActor,
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
 * connected to `/ws?role=renderer`, `monitor:<connection id>` for `/ws?role=monitor`; for
 * anything else, the logged-in operator's `produtor:<station>` or `dados:<station>` when
 * the connection brought a session (BAJAOVRLAY-29), `operador:<connection id>` when it
 * did not (the login off). A screen's address wins over a session: a monitor frame of a
 * logged-in page is still a monitor, which may send nothing.
 */
export function buildActorForConnection(
  requestTarget: string | undefined,
  connectionId: string,
  session: OpenOperatorSession | undefined,
): string {
  const roleInTheAddress = readRoleFromRequestTarget(requestTarget);
  if (roleInTheAddress === rendererRoleInTheAddress) {
    return buildRendererActor(connectionId);
  }
  if (roleInTheAddress === monitorRoleInTheAddress) {
    return buildMonitorActor(connectionId);
  }
  if (session !== undefined) {
    return buildLoggedInOperatorActor(session.role, session.station);
  }
  return buildOperatorActor(connectionId);
}

/**
 * Whether an upgrade's address names a screen (`role=renderer` or `role=monitor`), which
 * connects without a login on the LAN (BAJAOVRLAY-29).
 */
export function isScreenAddress(requestTarget: string | undefined): boolean {
  const roleInTheAddress = readRoleFromRequestTarget(requestTarget);
  return (
    roleInTheAddress === rendererRoleInTheAddress || roleInTheAddress === monitorRoleInTheAddress
  );
}

/**
 * Whether a connection's actor is a screen (a renderer or a monitor), which the hub
 * sends only the slices listed in slicesSentToScreens.ts.
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
