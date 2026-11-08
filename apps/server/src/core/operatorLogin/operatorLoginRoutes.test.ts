/**
 * Logging in, reading the session and logging out (apps/server)
 *
 * What this module is for:
 *   On the studio LAN the control page asks who you are (BAJAOVRLAY-29): a role
 *   ("Produtor" or "Dados"), its PIN, and the station's name ("Mesa 1"). The server answers
 *   POST /api/v1/session with a session cookie, HttpOnly, SameSite=Strict, valid for 18
 *   hours (an event day) and signed with a key kept in the database, so a restart logs
 *   nobody out. GET /api/v1/session says whether the server asks for a login at all and
 *   who the caller is; DELETE /api/v1/session is "Sair". Five wrong PINs from one address
 *   make that address wait 60 s.
 *
 * What these tests prove (with a real SQLite file and a clock moved by hand):
 *   - A right PIN answers the session (role, station, end) and sets the cookie with its
 *     flags; the next GET /session with that cookie names the same role and station.
 *   - A wrong PIN, or the other role's PIN, answers 401 in pt-BR and sets no cookie.
 *   - The lockout: the fifth wrong PIN in a row answers 429 with the wait in pt-BR; during
 *     the 60 s even the right PIN is refused, another address is not; after them the
 *     address may try again. A right PIN in between starts the count again.
 *   - Expiry: the session holds at 17 h 59 min and is gone at 18 h.
 *   - A restart (the database closed and opened again, a new app on it) keeps the session.
 *   - "Sair" ends the session on the server: the same cookie, sent again, has no session.
 *   - A station left blank answers 400 in pt-BR; a forged cookie is no session.
 *   - With the login off, GET /session says so, and a login is answered 409.
 *
 * What these tests deliberately do not cover:
 *   - Which routes need the session; operatorRouteAccess.test.ts.
 *   - The WebSocket; webSocketHubOperatorSession.test.ts in core/ws.
 *   - The page; apps/control's LoginPage tests and the e2e.
 */
import { SessionAnswerSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import {
  dataRoleTestPin,
  mistypedTestPin,
  producerTestPin,
} from './fakeOperatorPins.testSupport.js';
import {
  createClockMovedByHand,
  createServerAppWithOperatorLogin,
  logInAndKeepTheCookie,
  readCookieToSendBack,
  readTheSession,
  sendLogin,
} from './operatorLoginOnTheApp.testSupport.js';
import { operatorLoginTurnedOff } from './operatorPins.js';

const oneMinuteInMilliseconds = 60_000;
const oneHourInMilliseconds = 60 * oneMinuteInMilliseconds;

/** Builds the app with the tests' two PINs on a new database, and its clock. */
function createAppWithTheLoginOn() {
  const clock = createClockMovedByHand();
  const databasePath = createTemporaryDatabasePath();
  const { app } = createServerAppWithOperatorLogin({ databasePath, clock });
  return { app, clock, databasePath };
}

describe('POST /api/v1/session, the login', () => {
  it('answers the session and sets the cookie for the producer’s right PIN', async () => {
    // Arrange: a server with the two PINs set, at 08:00 on race day.
    const { app } = createAppWithTheLoginOn();

    // Act: log in as Produtor at "Mesa 1".
    const response = await sendLogin(app, {
      role: 'produtor',
      pin: producerTestPin,
      station: 'Mesa 1',
    });
    const body: unknown = await response.json();

    // Assert: 200, the session ends 18 h later, and the cookie carries the agreed flags.
    expect(response.status, 'a right PIN must be accepted').toBe(200);
    expect(SessionAnswerSchema.safeParse(body).success, 'the shared answer schema').toBe(true);
    expect(body, 'the answer names the role, the station and the session’s end').toEqual({
      isLoginRequired: true,
      session: { role: 'produtor', station: 'Mesa 1', expiresAt: '2026-11-08T05:00:00.000Z' },
    });
    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader, 'the cookie is the session’s').toMatch(/^bajaovrlay_sessao=/);
    expect(setCookieHeader, 'no page script may read it').toContain('HttpOnly');
    expect(setCookieHeader, 'no other site may send it').toContain('SameSite=Strict');
    expect(setCookieHeader, 'it lasts an event day, 18 h').toContain('Max-Age=64800');
    expect(setCookieHeader, 'it is sent to every path of the server').toContain('Path=/');
    expect(setCookieHeader, 'plain http on the LAN: not Secure-flagged').not.toContain('Secure');
  });

  it('remembers the role and station for the next request that carries the cookie', async () => {
    // Arrange: a server with the two PINs set, and Dados logged in at "Mesa 2".
    const { app } = createAppWithTheLoginOn();
    const cookie = await logInAndKeepTheCookie(app, 'dados', 'Mesa 2');

    // Act: read the session with the cookie, as the page does when it opens.
    const { status, body } = await readTheSession(app, cookie);

    // Assert: the same role and station.
    expect(status, 'the session read must answer 200').toBe(200);
    expect(body, 'the cookie must stand for Dados at "Mesa 2"').toEqual({
      isLoginRequired: true,
      session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-11-08T05:00:00.000Z' },
    });
  });

  const wrongPinScenarios = [
    // A digit mistyped.
    { name: 'refuses a mistyped PIN', role: 'produtor' as const, pin: mistypedTestPin },
    // The data PIN typed for the producer: the PIN, not the role picked, decides.
    { name: 'refuses the data PIN for the producer', role: 'produtor' as const, pin: dataRoleTestPin },
    // The producer's PIN typed for Dados.
    { name: 'refuses the producer’s PIN for Dados', role: 'dados' as const, pin: producerTestPin },
  ];

  it.each(wrongPinScenarios)('$name', async ({ role, pin }) => {
    // Arrange: a server with the two PINs set.
    const { app } = createAppWithTheLoginOn();

    // Act: log in with the row's role and PIN (in the table above).
    const response = await sendLogin(app, { role, pin, station: 'Mesa 1' });
    const body: unknown = await response.json();

    // Assert: 401 in pt-BR, and no cookie.
    expect(response.status, 'a wrong PIN must be refused').toBe(401);
    expect(body, 'the refusal says the PIN is wrong, in pt-BR').toEqual({
      error: { code: 'WRONG_PIN', message: 'PIN errado. Confira o papel escolhido e o PIN.' },
    });
    expect(response.headers.get('set-cookie'), 'a refused login sets no cookie').toBe(null);
  });

  it('answers 400 in pt-BR when the station is left blank', async () => {
    // Arrange: a server with the two PINs set.
    const { app } = createAppWithTheLoginOn();

    // Act: log in with the right PIN and spaces for a station.
    const response = await sendLogin(app, { role: 'produtor', pin: producerTestPin, station: '  ' });
    const body: unknown = await response.json();

    // Assert: 400, saying what to type.
    expect(response.status, 'a blank station must be refused').toBe(400);
    expect(body, 'the refusal says what to type, in pt-BR').toEqual({
      error: {
        code: 'INVALID_LOGIN',
        message: 'Digite o nome da estação (por exemplo, Mesa 1).',
      },
    });
  });
});

describe('the lockout after five wrong PINs', () => {
  /** Sends four wrong PINs from the address, which the lockout still lets through. */
  async function sendFourWrongPins(
    app: ReturnType<typeof createAppWithTheLoginOn>['app'],
    clientAddress: string,
  ) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await sendLogin(app, { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' }, clientAddress);
    }
  }

  it('makes the address wait 60 s at the fifth wrong PIN, saying so', async () => {
    // Arrange: a server with the two PINs set, and four wrong PINs from 192.168.0.21.
    const { app } = createAppWithTheLoginOn();
    await sendFourWrongPins(app, '192.168.0.21');

    // Act: a fifth wrong PIN from the same address.
    const response = await sendLogin(
      app,
      { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' },
      '192.168.0.21',
    );
    const body: unknown = await response.json();

    // Assert: 429, the reason and the wait in pt-BR, and Retry-After for a script.
    expect(response.status, 'the fifth wrong PIN must start the wait').toBe(429);
    expect(body, 'the reason and the wait, in pt-BR').toEqual({
      error: {
        code: 'LOGIN_LOCKED',
        message: 'Muitos PINs errados deste computador. Espere 60 s e tente de novo.',
      },
    });
    expect(response.headers.get('retry-after'), 'the wait in seconds').toBe('60');
  });

  it('refuses even the right PIN during the wait, with the seconds left', async () => {
    // Arrange: five wrong PINs from 192.168.0.21, then 45 s gone by.
    const { app, clock } = createAppWithTheLoginOn();
    await sendFourWrongPins(app, '192.168.0.21');
    await sendLogin(app, { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' }, '192.168.0.21');
    clock.moveForwardBy(45_000);

    // Act: the right PIN from the same address.
    const response = await sendLogin(
      app,
      { role: 'produtor', pin: producerTestPin, station: 'Mesa 1' },
      '192.168.0.21',
    );
    const body: unknown = await response.json();

    // Assert: still refused, with the 15 s left, and no cookie.
    expect(response.status, 'the wait holds for the right PIN too').toBe(429);
    expect(body, 'the seconds left, in pt-BR').toEqual({
      error: {
        code: 'LOGIN_LOCKED',
        message: 'Muitos PINs errados deste computador. Espere 15 s e tente de novo.',
      },
    });
    expect(response.headers.get('set-cookie'), 'no cookie during the wait').toBe(null);
  });

  it('lets another address log in during one address’s wait', async () => {
    // Arrange: five wrong PINs from 192.168.0.21.
    const { app } = createAppWithTheLoginOn();
    await sendFourWrongPins(app, '192.168.0.21');
    await sendLogin(app, { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' }, '192.168.0.21');

    // Act: the right PIN from the producer's own machine, 192.168.0.30.
    const response = await sendLogin(
      app,
      { role: 'produtor', pin: producerTestPin, station: 'Mesa 3' },
      '192.168.0.30',
    );

    // Assert: accepted.
    expect(response.status, 'the wait is per address').toBe(200);
  });

  it('lets the address log in once the 60 s are over', async () => {
    // Arrange: five wrong PINs from 192.168.0.21, then the whole minute gone by.
    const { app, clock } = createAppWithTheLoginOn();
    await sendFourWrongPins(app, '192.168.0.21');
    await sendLogin(app, { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' }, '192.168.0.21');
    clock.moveForwardBy(oneMinuteInMilliseconds);

    // Act: the right PIN from the same address.
    const response = await sendLogin(
      app,
      { role: 'produtor', pin: producerTestPin, station: 'Mesa 1' },
      '192.168.0.21',
    );

    // Assert: accepted.
    expect(response.status, 'after the wait the address may log in').toBe(200);
  });

  it('starts the count again after a right PIN', async () => {
    // Arrange: four wrong PINs, then the right one, from 192.168.0.21.
    const { app } = createAppWithTheLoginOn();
    await sendFourWrongPins(app, '192.168.0.21');
    await sendLogin(app, { role: 'dados', pin: dataRoleTestPin, station: 'Mesa 2' }, '192.168.0.21');

    // Act: one more wrong PIN.
    const response = await sendLogin(
      app,
      { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' },
      '192.168.0.21',
    );

    // Assert: a plain wrong PIN, not the wait.
    expect(response.status, 'a right PIN clears the count of wrong ones').toBe(401);
  });
});

describe('how long a session lasts', () => {
  it('holds at 17 h 59 min', async () => {
    // Arrange: Produtor logged in at 08:00, and the clock at 01:59 the next morning.
    const { app, clock } = createAppWithTheLoginOn();
    const cookie = await logInAndKeepTheCookie(app, 'produtor', 'Mesa 1');
    clock.moveForwardBy(18 * oneHourInMilliseconds - oneMinuteInMilliseconds);

    // Act: read the session.
    const { body } = await readTheSession(app, cookie);

    // Assert: still there.
    expect(body, 'the session must last the whole event day').toMatchObject({
      session: { role: 'produtor', station: 'Mesa 1' },
    });
  });

  it('is gone at 18 h', async () => {
    // Arrange: Produtor logged in at 08:00, and the clock at 02:00 the next morning.
    const { app, clock } = createAppWithTheLoginOn();
    const cookie = await logInAndKeepTheCookie(app, 'produtor', 'Mesa 1');
    clock.moveForwardBy(18 * oneHourInMilliseconds);

    // Act: read the session with the old cookie.
    const { body } = await readTheSession(app, cookie);

    // Assert: no session; the page goes back to #/entrar.
    expect(body, 'an expired session must be no session').toEqual({
      isLoginRequired: true,
      session: null,
    });
  });
});

describe('a session across a restart', () => {
  it('is still there after the server restarts on the same database', async () => {
    // Arrange: Dados logged in at "Mesa 2", then the database closed, as at a restart.
    const clock = createClockMovedByHand();
    const databasePath = createTemporaryDatabasePath();
    const before = createServerAppWithOperatorLogin({ databasePath, clock });
    const cookie = await logInAndKeepTheCookie(before.app, 'dados', 'Mesa 2');
    before.database.$client.close();

    // Act: a new server on the same file reads the session with the same cookie.
    const after = createServerAppWithOperatorLogin({ databasePath, clock });
    const { body } = await readTheSession(after.app, cookie);

    // Assert: the same session, so nobody has to log in again.
    expect(body, 'a restart must log nobody out').toMatchObject({
      session: { role: 'dados', station: 'Mesa 2' },
    });
  });
});

describe('DELETE /api/v1/session, "Sair"', () => {
  it('ends the session on the server, so the same cookie no longer counts', async () => {
    // Arrange: Produtor logged in at "Mesa 1".
    const { app } = createAppWithTheLoginOn();
    const cookie = await logInAndKeepTheCookie(app, 'produtor', 'Mesa 1');

    // Act: "Sair", then the same cookie sent again (as a copy of it would be).
    const logoutResponse = await app.request('/api/v1/session', {
      method: 'DELETE',
      headers: { cookie },
    });
    const { body } = await readTheSession(app, cookie);

    // Assert: the browser is told to drop the cookie, and the server has no session for it.
    expect(logoutResponse.status, '"Sair" must answer 200').toBe(200);
    expect(readCookieToSendBack(logoutResponse), 'the cookie is emptied').toBe('bajaovrlay_sessao=');
    expect(body, 'the ended session must be gone').toEqual({ isLoginRequired: true, session: null });
  });
});

describe('a cookie the server did not sign', () => {
  it('is no session', async () => {
    // Arrange: a server with the two PINs set, and a cookie made up by hand.
    const { app } = createAppWithTheLoginOn();
    const forgedCookie = 'bajaovrlay_sessao=sessao-inventada.assinatura-inventada';

    // Act: read the session with it.
    const { body } = await readTheSession(app, forgedCookie);

    // Assert: no session.
    expect(body, 'only a cookie the server signed counts').toEqual({
      isLoginRequired: true,
      session: null,
    });
  });
});

describe('the session routes with the login off', () => {
  it('say no login is asked for, and refuse a login with 409', async () => {
    // Arrange: a server with no PINs set.
    const clock = createClockMovedByHand();
    const { app } = createServerAppWithOperatorLogin({
      databasePath: createTemporaryDatabasePath(),
      clock,
      operatorPins: operatorLoginTurnedOff,
    });

    // Act: read the session, and try a login.
    const { body } = await readTheSession(app, '');
    const loginResponse = await sendLogin(app, {
      role: 'produtor',
      pin: producerTestPin,
      station: 'Mesa 1',
    });

    // Assert: the page stays open as before; a login has nothing to check.
    expect(body, 'with no PINs the server asks for no login').toEqual({
      isLoginRequired: false,
      session: null,
    });
    expect(loginResponse.status, 'a login with the login off is a conflict').toBe(409);
  });
});
