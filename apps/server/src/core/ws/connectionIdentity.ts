// Reading a WebSocket upgrade: who the new connection is, and which path it asked for.
// Split from webSocketHub.ts, whose job is the wiring of the hub.
import { randomUUID } from 'node:crypto';

import type { OpenOperatorSession } from '../operatorLogin/operatorSessions.js';
import { buildActorForConnection, isScreenConnectionActor } from './connectionActor.js';
import { chooseConsoleIdOfConnection } from './consoleOfConnection.js';

/** Who a new connection is, read from its upgrade. */
export type IdentityOfAConnection = {
  /** What its commands are signed with in the event log (connectionActor.ts). */
  actor: string;
  /** A renderer or a monitor: sent only the slices it draws, never a take. */
  isScreen: boolean;
  /** The console a control page's tab is (BAJAOVRLAY-69); none for a screen. */
  consoleId: string | undefined;
};

/**
 * Who a new connection is: its actor, whether it is a screen, and its console. The three are
 * read together so the hub has one line for them; each rule lives in its own file
 * (connectionActor.ts, consoleOfConnection.ts). `createConsoleId` makes a new console id
 * (a random UUID unless a test hands in its own).
 */
export function identifyTheConnection(upgrade: {
  requestTarget: string | undefined;
  connectionId: string;
  session: OpenOperatorSession | undefined;
  createConsoleId?: () => string;
}): IdentityOfAConnection {
  const actor = buildActorForConnection(
    upgrade.requestTarget,
    upgrade.connectionId,
    upgrade.session,
  );
  const isScreen = isScreenConnectionActor(actor);
  const consoleId = chooseConsoleIdOfConnection(
    upgrade.requestTarget,
    isScreen,
    upgrade.createConsoleId ?? randomUUID,
  );
  return { actor, isScreen, consoleId };
}

/**
 * The path an upgrade request asked for, or undefined when its target is not a URL.
 * Node accepts absolute-form targets such as `http://[`, and `new URL` throws on those;
 * inside the 'upgrade' listener that throw would crash the server that owns the state.
 * (Moved here from webSocketHub.ts, which keeps the wiring: this reads the upgrade.)
 */
export function readUpgradeRequestPath(requestTarget: string | undefined): string | undefined {
  try {
    return new URL(requestTarget ?? '/', 'http://localhost').pathname;
  } catch {
    return undefined;
  }
}
