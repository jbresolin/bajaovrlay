/**
 * The wait after five wrong PINs (apps/server)
 *
 * What this module is for:
 *   The login (BAJAOVRLAY-29) takes a PIN of 4 to 8 digits. So that nobody on the LAN can try
 *   them all, five wrong PINs in a row from one address make that address wait 60 s, and the
 *   page says how long is left. The count is kept in memory, per socket address.
 *
 * What these tests prove (with a real SQLite file and a clock moved by hand):
 *   - The fifth wrong PIN in a row answers 429 with the wait in pt-BR and Retry-After.
 *   - During the 60 s even the right PIN is refused, with the seconds left; another address
 *     is not; after them the address may try again.
 *   - A right PIN in between starts the count again.
 *
 * What these tests deliberately do not cover:
 *   - A single wrong or right PIN; operatorLoginRoutes.test.ts.
 *   - A restart, which forgets the counts on purpose (loginLockout.ts says why).
 */
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
  sendLogin,
} from './operatorLoginOnTheApp.testSupport.js';

const oneMinuteInMilliseconds = 60_000;

/** Builds the app with the tests' two PINs on a new database, and its clock. */
function createAppWithTheLoginOn() {
  const clock = createClockMovedByHand();
  const { app } = createServerAppWithOperatorLogin({
    databasePath: createTemporaryDatabasePath(),
    clock,
  });
  return { app, clock };
}

describe('the lockout after five wrong PINs', () => {
  /** Sends four wrong PINs from the address, which the lockout still lets through. */
  async function sendFourWrongPins(
    app: ReturnType<typeof createAppWithTheLoginOn>['app'],
    clientAddress: string,
  ) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await sendLogin(
        app,
        { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' },
        clientAddress,
      );
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
    await sendLogin(
      app,
      { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' },
      '192.168.0.21',
    );
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
    await sendLogin(
      app,
      { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' },
      '192.168.0.21',
    );

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
    await sendLogin(
      app,
      { role: 'produtor', pin: mistypedTestPin, station: 'Mesa 1' },
      '192.168.0.21',
    );
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
    await sendLogin(
      app,
      { role: 'dados', pin: dataRoleTestPin, station: 'Mesa 2' },
      '192.168.0.21',
    );

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
