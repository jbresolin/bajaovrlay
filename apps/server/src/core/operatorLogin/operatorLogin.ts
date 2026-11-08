import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { OperatorRole } from '@bajaovrlay/shared';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readOrWriteServerSecret } from '../db/serverSecretRowStorage.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { createLoginLockout } from './loginLockout.js';
import type { OperatorPins } from './operatorPins.js';
import { createOperatorSessions, type OpenOperatorSession } from './operatorSessions.js';
import {
  buildSignedSessionCookieValue,
  readSessionCookieValueFromCookieHeader,
  readSessionIdOfSignedCookieValue,
} from './sessionCookie.js';

// The name of the key that signs session cookies, in the server_secrets table.
const sessionSigningKeyName = 'sessionCookieSigningKey';

/** What a login attempt came to. */
export type LoginOutcome =
  | { kind: 'loggedIn'; session: OpenOperatorSession; cookieValue: string }
  | { kind: 'wrongPin' }
  | { kind: 'lockedOut'; secondsToWait: number }
  | { kind: 'loginTurnedOff' };

/** A session ended by "Sair", for whoever must drop its connections (the WebSocket hub). */
export type EndedSessionListener = (endedSession: OpenOperatorSession) => void;

/** The operator login of one server (BAJAOVRLAY-29). */
export type OperatorLogin = {
  /** false while no PINs are set: every page and route is open, as before. */
  isLoginRequired: boolean;
  /** Checks a PIN for a role and, when right, opens a session for the station. */
  logIn: (attempt: {
    role: OperatorRole;
    pin: string;
    station: string;
    clientAddress: string;
  }) => LoginOutcome;
  /** The open session a request's Cookie header carries, or undefined. */
  findSessionOfCookieHeader: (cookieHeader: string | undefined) => OpenOperatorSession | undefined;
  /** "Sair": ends the session the Cookie header carries, if any, and tells the listeners. */
  logOut: (cookieHeader: string | undefined) => void;
  /** Registers a listener for sessions ended by "Sair"; returns a function that removes it. */
  subscribeToEndedSessions: (listener: EndedSessionListener) => () => void;
};

/**
 * Creates the login from the PINs the boot read. The key that signs cookies is read from
 * the database, or made and written there by the first boot that needs it, so cookies
 * survive a restart. A PIN is never logged; the log names the role and the station.
 */
export function createOperatorLogin(options: {
  database: ServerDatabase;
  operatorPins: OperatorPins;
  readCurrentTime: () => Date;
  logger: ServerLogger;
}): OperatorLogin {
  const { database, operatorPins, readCurrentTime, logger } = options;
  const signingKey = readOrWriteServerSecret(database, sessionSigningKeyName, () =>
    randomBytes(32).toString('base64url'),
  );
  const sessions = createOperatorSessions({ database, readCurrentTime });
  const lockout = createLoginLockout(readCurrentTime);
  const endedSessionListeners = new Set<EndedSessionListener>();

  function logIn(attempt: Parameters<OperatorLogin['logIn']>[0]): LoginOutcome {
    if (!operatorPins.isLoginRequired) {
      return { kind: 'loginTurnedOff' };
    }
    const secondsAlreadyToWait = lockout.readSecondsToWait(attempt.clientAddress);
    if (secondsAlreadyToWait > 0) {
      return { kind: 'lockedOut', secondsToWait: secondsAlreadyToWait };
    }
    const pinOfTheRole =
      attempt.role === 'produtor' ? operatorPins.producerPin : operatorPins.dataRolePin;
    if (!isSamePin(attempt.pin, pinOfTheRole)) {
      const secondsToWait = lockout.recordWrongPin(attempt.clientAddress);
      logger.warn(
        { role: attempt.role, client_ip: attempt.clientAddress, is_locked_out: secondsToWait > 0 },
        'operator login refused: wrong PIN',
      );
      if (secondsToWait > 0) {
        return { kind: 'lockedOut', secondsToWait };
      }
      return { kind: 'wrongPin' };
    }
    lockout.recordRightPin(attempt.clientAddress);
    const { session, sessionId } = sessions.openSession(attempt.role, attempt.station);
    logger.info(
      { role: session.role, station: session.station, client_ip: attempt.clientAddress },
      'operator logged in',
    );
    return {
      kind: 'loggedIn',
      session,
      cookieValue: buildSignedSessionCookieValue(sessionId, signingKey),
    };
  }

  function findSessionOfCookieHeader(
    cookieHeader: string | undefined,
  ): OpenOperatorSession | undefined {
    const cookieValue = readSessionCookieValueFromCookieHeader(cookieHeader);
    if (cookieValue === undefined) {
      return undefined;
    }
    const sessionId = readSessionIdOfSignedCookieValue(cookieValue, signingKey);
    if (sessionId === undefined) {
      return undefined;
    }
    return sessions.findOpenSession(sessionId);
  }

  function logOut(cookieHeader: string | undefined): void {
    const session = findSessionOfCookieHeader(cookieHeader);
    if (session === undefined) {
      return;
    }
    sessions.endSession(session);
    logger.info({ role: session.role, station: session.station }, 'operator logged out');
    for (const listener of endedSessionListeners) {
      listener(session);
    }
  }

  return {
    isLoginRequired: operatorPins.isLoginRequired,
    logIn,
    findSessionOfCookieHeader,
    logOut,
    subscribeToEndedSessions: (listener) => {
      endedSessionListeners.add(listener);
      return () => endedSessionListeners.delete(listener);
    },
  };
}

/**
 * Whether two PINs are the same, compared as SHA-256 digests in constant time (as the API
 * tokens are): equal-length digests, so neither the length nor the first wrong digit
 * shows in how long the answer takes.
 */
function isSamePin(presentedPin: string, expectedPin: string): boolean {
  const presentedDigest = createHash('sha256').update(presentedPin).digest();
  const expectedDigest = createHash('sha256').update(expectedPin).digest();
  return timingSafeEqual(presentedDigest, expectedDigest);
}
