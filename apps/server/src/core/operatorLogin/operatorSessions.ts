import { randomUUID } from 'node:crypto';

import { type OperatorRole, OperatorRoleSchema } from '@bajaovrlay/shared';

import type { ServerDatabase } from '../db/openDatabase.js';
import {
  deleteOperatorSessionRow,
  deleteOperatorSessionRowsEndedBy,
  readOperatorSessionRows,
  writeOperatorSessionRow,
} from '../db/operatorSessionRowStorage.js';
import { sessionLengthInMilliseconds } from './sessionCookie.js';

/** One open session: who logged in, where, and when it ends (ISO 8601). */
export type OpenOperatorSession = {
  sessionId: string;
  role: OperatorRole;
  station: string;
  expiresAt: string;
};

/** The open sessions, in memory and in the database's operator_sessions table. */
export type OperatorSessions = {
  /** Opens a session for 18 hours from now and writes it down. */
  openSession: (role: OperatorRole, station: string) => OpenOperatorSession;
  /** The session of this id while it is open; undefined once it ended or expired. */
  findOpenSession: (sessionId: string) => OpenOperatorSession | undefined;
  /** Ends a session ("Sair"); answers it, or undefined when it was not open. */
  endSession: (sessionId: string) => OpenOperatorSession | undefined;
};

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
  const openSessionsById = new Map<string, OpenOperatorSession>();
  for (const row of readOperatorSessionRows(database)) {
    // A row of a role this build does not know (written by a later one) is left unread.
    const role = OperatorRoleSchema.safeParse(row.role);
    if (role.success) {
      openSessionsById.set(row.sessionId, {
        sessionId: row.sessionId,
        role: role.data,
        station: row.station,
        expiresAt: row.expiresAt,
      });
    }
  }

  function isExpired(session: OpenOperatorSession): boolean {
    return Date.parse(session.expiresAt) <= readCurrentTime().getTime();
  }

  function openSession(role: OperatorRole, station: string): OpenOperatorSession {
    const now = readCurrentTime();
    // Every login sweeps away the sessions that have expired since the last one.
    deleteOperatorSessionRowsEndedBy(database, now.toISOString());
    for (const session of openSessionsById.values()) {
      if (isExpired(session)) {
        openSessionsById.delete(session.sessionId);
      }
    }
    const session: OpenOperatorSession = {
      sessionId: randomUUID(),
      role,
      station,
      expiresAt: new Date(now.getTime() + sessionLengthInMilliseconds).toISOString(),
    };
    writeOperatorSessionRow(database, { ...session, createdAt: now.toISOString() });
    openSessionsById.set(session.sessionId, session);
    return session;
  }

  function findOpenSession(sessionId: string): OpenOperatorSession | undefined {
    const session = openSessionsById.get(sessionId);
    if (session === undefined || isExpired(session)) {
      return undefined;
    }
    return session;
  }

  function endSession(sessionId: string): OpenOperatorSession | undefined {
    const session = findOpenSession(sessionId);
    openSessionsById.delete(sessionId);
    deleteOperatorSessionRow(database, sessionId);
    return session;
  }

  return { openSession, findOpenSession, endSession };
}
