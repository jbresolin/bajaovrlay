import { createHash, randomUUID } from 'node:crypto';

import { type OperatorRole, OperatorRoleSchema } from '@bajaovrlay/shared';

import type { ServerDatabase } from '../db/openDatabase.js';
import {
  deleteOperatorSessionRow,
  deleteOperatorSessionRowsEndedBy,
  readOperatorSessionRows,
  writeOperatorSessionRow,
} from '../db/operatorSessionRowStorage.js';
import { sessionLengthInMilliseconds } from './sessionCookie.js';

/**
 * One open session: who logged in, where, and when it ends (ISO 8601). It is known by the
 * hash of its id: the id itself is only ever in the operator's cookie.
 */
export type OpenOperatorSession = {
  sessionIdHash: string;
  role: OperatorRole;
  station: string;
  expiresAt: string;
};

/** The open sessions, in memory and in the database's operator_sessions table. */
export type OperatorSessions = {
  /**
   * Opens a session for 18 hours from now and writes it down; answers it with its new id,
   * for the cookie, which is the one place that id is kept.
   */
  openSession: (
    role: OperatorRole,
    station: string,
  ) => { session: OpenOperatorSession; sessionId: string };
  /** The session of this id (from a cookie) while it is open; undefined once it ended. */
  findOpenSession: (sessionId: string) => OpenOperatorSession | undefined;
  /** Ends an open session ("Sair"); nothing happens when it is already gone. */
  endSession: (session: OpenOperatorSession) => void;
};

/**
 * The hash a session is stored and found by (gate 2 of PR #51): a copy of the database
 * also holds the cookie's signing key, so with the ids it could build working cookies. A
 * plain SHA-256 is enough: the id is a random UUID, not a guessable password.
 */
function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

/**
 * Loads the sessions written before this boot (so a restart logs nobody out) and keeps
 * them in memory, where every request and WebSocket message looks them up without a
 * query. A login and "Sair" write through to the database at once. An expired session
 * counts as ended at once; its row is deleted at the next login.
 */
export function createOperatorSessions(options: {
  database: ServerDatabase;
  readCurrentTime: () => Date;
}): OperatorSessions {
  const { database, readCurrentTime } = options;
  const openSessionsByIdHash = new Map<string, OpenOperatorSession>();
  for (const row of readOperatorSessionRows(database)) {
    // A row of a role this build does not know (written by a later one) is left unread.
    const role = OperatorRoleSchema.safeParse(row.role);
    if (role.success) {
      openSessionsByIdHash.set(row.sessionIdHash, {
        sessionIdHash: row.sessionIdHash,
        role: role.data,
        station: row.station,
        expiresAt: row.expiresAt,
      });
    }
  }

  function isExpired(session: OpenOperatorSession): boolean {
    return Date.parse(session.expiresAt) <= readCurrentTime().getTime();
  }

  function openSession(role: OperatorRole, station: string) {
    const now = readCurrentTime();
    // Every login sweeps away the sessions that have expired since the last one.
    deleteOperatorSessionRowsEndedBy(database, now.toISOString());
    for (const session of openSessionsByIdHash.values()) {
      if (isExpired(session)) {
        openSessionsByIdHash.delete(session.sessionIdHash);
      }
    }
    const sessionId = randomUUID();
    const session: OpenOperatorSession = {
      sessionIdHash: hashSessionId(sessionId),
      role,
      station,
      expiresAt: new Date(now.getTime() + sessionLengthInMilliseconds).toISOString(),
    };
    writeOperatorSessionRow(database, { ...session, createdAt: now.toISOString() });
    openSessionsByIdHash.set(session.sessionIdHash, session);
    return { session, sessionId };
  }

  function findOpenSession(sessionId: string): OpenOperatorSession | undefined {
    const session = openSessionsByIdHash.get(hashSessionId(sessionId));
    if (session === undefined || isExpired(session)) {
      return undefined;
    }
    return session;
  }

  function endSession(session: OpenOperatorSession): void {
    openSessionsByIdHash.delete(session.sessionIdHash);
    deleteOperatorSessionRow(database, session.sessionIdHash);
  }

  return { openSession, findOpenSession, endSession };
}
