/**
 * What the database keeps of a session (apps/server)
 *
 * What this module is for:
 *   A session (BAJAOVRLAY-29) is a row of operator_sessions, so a restart logs nobody out,
 *   and its cookie carries a random session id signed with a key kept in server_secrets.
 *   A copy of the database (a backup, BAJAOVRLAY-33, or the file itself) therefore holds
 *   the key; if it also held the ids, anyone with the copy could build a working cookie.
 *   So the row keeps a SHA-256 hash of the id, never the id (gate 2 of PR #51); the server
 *   hashes the id a cookie carries to find its row.
 *
 * What these tests prove (with a real SQLite file):
 *   - No column of the stored session holds the id the cookie carries.
 *   - A cookie built from a copy of the database, every stored value of the session
 *     signed with every stored secret, is no session.
 *   - The real cookie still finds its session (and, in operatorLoginRoutes.test.ts, after
 *     a restart too).
 *
 * What these tests deliberately do not cover:
 *   - The login, expiry and "Sair"; operatorLoginRoutes.test.ts.
 *   - The backup download itself; apps/server's backup tests.
 */
import { describe, expect, it } from 'vitest';

import { operatorSessionRows, serverSecretRows } from '../db/tables.js';
import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import {
  createClockMovedByHand,
  createServerAppWithOperatorLogin,
  logInAndKeepTheCookie,
  readTheSession,
} from './operatorLoginOnTheApp.testSupport.js';
import { buildSignedSessionCookieValue, sessionCookieName } from './sessionCookie.js';

/** Logs Dados in at "Mesa 2" and gives back the app, its database and the cookie. */
async function logInAsDataRoleAndKeepTheDatabase() {
  const clock = createClockMovedByHand();
  const { app, database } = createServerAppWithOperatorLogin({
    databasePath: createTemporaryDatabasePath(),
    clock,
  });
  const cookie = await logInAndKeepTheCookie(app, 'dados', 'Mesa 2');
  return { app, database, cookie };
}

/** The session id a `bajaovrlay_sessao=<id>.<signature>` cookie carries. */
function readSessionIdOfTheCookie(cookie: string): string {
  const cookieValue = cookie.slice(`${sessionCookieName}=`.length);
  return cookieValue.slice(0, cookieValue.lastIndexOf('.'));
}

describe('the operator_sessions row of a login', () => {
  it('holds no column with the session id the cookie carries', async () => {
    // Arrange: Dados logged in at "Mesa 2", and the id its cookie carries.
    const { database, cookie } = await logInAsDataRoleAndKeepTheDatabase();
    const sessionIdOfTheCookie = readSessionIdOfTheCookie(cookie);

    // Act: read every stored session, as a copy of the database would show it.
    const storedSessions = database.select().from(operatorSessionRows).all();

    // Assert: one session, and the id is nowhere in it.
    expect(storedSessions.length, 'the login wrote its session').toBe(1);
    expect(
      JSON.stringify(storedSessions),
      'a copy of the database must not hold a working session id',
    ).not.toContain(sessionIdOfTheCookie);
  });

  it('cannot be turned into a working cookie with the key the database also holds', async () => {
    // Arrange: Dados logged in, and every stored value of its session signed with every
    // stored secret, as someone with a backup would try.
    const { app, database } = await logInAsDataRoleAndKeepTheDatabase();
    const storedValues = database
      .select()
      .from(operatorSessionRows)
      .all()
      .flatMap((row) => Object.values(row));
    const storedSecrets = database.select().from(serverSecretRows).all();
    const forgedCookies = storedValues.flatMap((storedValue) =>
      storedSecrets.map(
        (secret) =>
          `${sessionCookieName}=${buildSignedSessionCookieValue(storedValue, secret.value)}`,
      ),
    );

    // Act: read the session with each forged cookie.
    const answers = await Promise.all(
      forgedCookies.map(async (forgedCookie) => (await readTheSession(app, forgedCookie)).body),
    );

    // Assert: none of them is a session.
    for (const answer of answers) {
      expect(answer, 'a cookie built from a backup must be no session').toEqual({
        isLoginRequired: true,
        session: null,
      });
    }
  });

  it('still lets the real cookie find its session', async () => {
    // Arrange: Dados logged in at "Mesa 2", and the cookie its browser keeps.
    const { app, cookie } = await logInAsDataRoleAndKeepTheDatabase();

    // Act: read the session with that cookie.
    const { body } = await readTheSession(app, cookie);

    // Assert: Dados at "Mesa 2".
    expect(body, 'the hash finds the row the id stands for').toMatchObject({
      session: { role: 'dados', station: 'Mesa 2' },
    });
  });
});
