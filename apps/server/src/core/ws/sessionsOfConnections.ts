import type { IncomingMessage } from 'node:http';

import type { WebSocket } from 'ws';

import type { OperatorLogin } from '../operatorLogin/operatorLogin.js';
import type { OpenOperatorSession } from '../operatorLogin/operatorSessions.js';
import { isScreenAddress } from './connectionActor.js';

/**
 * The close code of a connection whose session ended ("Sair", or its 18 hours over), in
 * the range WebSocket leaves to applications; 4401 echoes HTTP's 401. The page then reads
 * GET /api/v1/session and goes to "#/entrar".
 */
export const sessionEndedCloseCode = 4401;

// The reason sent with that close, for whoever reads it in the browser's tools.
const sessionEndedCloseReason = 'sessao-encerrada';

/** What the hub asks about the operator sessions of its connections (BAJAOVRLAY-29). */
export type SessionsOfConnections = {
  /**
   * Whether an upgrade to /ws is refused for want of a session: with the PINs set, a
   * control page needs one; a screen (`role=renderer` or `role=monitor`) never does.
   */
  isUpgradeRefused: (request: IncomingMessage) => boolean;
  /** The session the upgrade's cookie carried, or undefined (a screen, the login off). */
  findSessionOfTheUpgrade: (request: IncomingMessage) => OpenOperatorSession | undefined;
  /**
   * Closes the connection when its session ends: at "Sair" (the login tells), at its 18
   * hours (a timer). A screen's connection is never watched: it has no session to end.
   */
  watchTheSessionOfConnection: (client: WebSocket, request: IncomingMessage) => void;
  /**
   * Whether a message may be run: always for a connection with no session; otherwise only
   * while its session is open. When not, the connection is closed and the message dropped
   * (the clock jumped past the session's end, which the timer did not see).
   */
  isConnectionStillAllowedToSend: (client: WebSocket, request: IncomingMessage) => boolean;
  /** Stops listening for ended sessions; the hub's close() calls it. */
  stop: () => void;
};

/**
 * Keeps track of which connection belongs to which session, so "Sair" closes that
 * session's pages and no other. Each upgrade's session is read once, from its Cookie
 * header, and kept against the request until the connection closes.
 */
export function trackSessionsOfConnections(options: {
  operatorLogin: OperatorLogin;
  readCurrentTime: () => Date;
}): SessionsOfConnections {
  const { operatorLogin, readCurrentTime } = options;
  const sessionOfEachUpgrade = new WeakMap<IncomingMessage, OpenOperatorSession>();
  const sessionIdHashOfEachConnection = new Map<WebSocket, string>();

  const stopListeningForEndedSessions = operatorLogin.subscribeToEndedSessions((endedSession) => {
    for (const [client, sessionIdHash] of sessionIdHashOfEachConnection) {
      if (sessionIdHash === endedSession.sessionIdHash) {
        client.close(sessionEndedCloseCode, sessionEndedCloseReason);
      }
    }
  });

  function isUpgradeRefused(request: IncomingMessage): boolean {
    if (isScreenAddress(request.url)) {
      return false;
    }
    const session = operatorLogin.findSessionOfCookieHeader(request.headers.cookie);
    if (session !== undefined) {
      sessionOfEachUpgrade.set(request, session);
    }
    return operatorLogin.isLoginRequired && session === undefined;
  }

  function watchTheSessionOfConnection(client: WebSocket, request: IncomingMessage): void {
    const session = sessionOfEachUpgrade.get(request);
    if (session === undefined) {
      return;
    }
    sessionIdHashOfEachConnection.set(client, session.sessionIdHash);
    const millisecondsLeft = Date.parse(session.expiresAt) - readCurrentTime().getTime();
    const sessionExpiryTimer = setTimeout(() => {
      client.close(sessionEndedCloseCode, sessionEndedCloseReason);
    }, millisecondsLeft);
    // The timer alone must never keep the process alive.
    sessionExpiryTimer.unref();
    client.on('close', () => {
      clearTimeout(sessionExpiryTimer);
      sessionIdHashOfEachConnection.delete(client);
    });
  }

  function isConnectionStillAllowedToSend(client: WebSocket, request: IncomingMessage): boolean {
    if (!sessionOfEachUpgrade.has(request)) {
      return true;
    }
    const isSessionStillOpen =
      operatorLogin.findSessionOfCookieHeader(request.headers.cookie) !== undefined;
    if (!isSessionStillOpen) {
      client.close(sessionEndedCloseCode, sessionEndedCloseReason);
    }
    return isSessionStillOpen;
  }

  return {
    isUpgradeRefused,
    findSessionOfTheUpgrade: (request) => sessionOfEachUpgrade.get(request),
    watchTheSessionOfConnection,
    isConnectionStillAllowedToSend,
    stop: stopListeningForEndedSessions,
  };
}
