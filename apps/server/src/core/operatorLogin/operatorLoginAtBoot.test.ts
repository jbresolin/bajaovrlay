/**
 * The boot log's line about the operator login (apps/server)
 *
 * What this module is for:
 *   At boot the server writes one line saying whether the control page asks for a login
 *   (BAJAOVRLAY-29). With no PINs set the page is open to anyone on the network, as it was
 *   before the login existed; that is a warning, so a stream PC set up without PINs by
 *   mistake is noticed in `docker logs`. The header of the page says "Sem login" too.
 *
 * What these tests prove:
 *   - With the login off, the line is a warning naming the two variables to set.
 *   - With the login on, the line is information, and carries neither PIN.
 *   - With the login on and the command API open (BAJAOVRLAY_API_OPEN=true), a second line
 *     warns that the API is open to the whole network without login or roles (gate 2 of
 *     PR #51); with the API closed, or the login off, there is no such line.
 *   - In neither case does any login or read of the session write a PIN to the log: a
 *     right and a wrong login, logged, name the role and station only.
 *
 * What these tests deliberately do not cover:
 *   - That main.ts calls it at boot: main.ts is the entry point no test boots; one call.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  dataRoleTestPin,
  mistypedTestPin,
  operatorPinsOfTheTests,
  producerTestPin,
} from './fakeOperatorPins.testSupport.js';
import { createOperatorLogin } from './operatorLogin.js';
import { logOperatorLoginAtBoot } from './operatorLoginAtBoot.js';
import { operatorLoginTurnedOff } from './operatorPins.js';

describe('logOperatorLoginAtBoot', () => {
  it('warns that the control page is open while no PINs are set', () => {
    // Arrange: a logger that keeps its lines.
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: write the boot line with the login off.
    logOperatorLoginAtBoot({
      logger,
      operatorPins: operatorLoginTurnedOff,
      isCommandApiOpenToTheNetwork: false,
    });

    // Assert: one warning naming the two variables.
    const [bootLine] = readRecordedLines();
    expect(bootLine?.level, 'an open control page is a warning').toBe('warn');
    expect(bootLine?.message, 'the line says what to set').toBe(
      'operator login off: anyone on the network may operate the control page (set BAJAOVRLAY_PIN_PRODUCER and BAJAOVRLAY_PIN_DATA)',
    );
  });

  it('says the login is on, without a PIN', () => {
    // Arrange: a logger that keeps its lines.
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: write the boot line with the tests' two PINs.
    logOperatorLoginAtBoot({
      logger,
      operatorPins: operatorPinsOfTheTests,
      isCommandApiOpenToTheNetwork: false,
    });

    // Assert: information alone, and no PIN in it.
    const [bootLine, ...otherLines] = readRecordedLines();
    expect(otherLines, 'with the command API closed, nothing more to say').toEqual([]);
    expect(bootLine?.level, 'the login on is a detail').toBe('info');
    expect(bootLine?.message, 'the line says the login is on').toBe(
      'operator login on: the control page asks for a role and its PIN',
    );
    expect(JSON.stringify(bootLine), 'no producer PIN').not.toContain(producerTestPin);
    expect(JSON.stringify(bootLine), 'no data PIN').not.toContain(dataRoleTestPin);
  });

  it('warns that the command API bypasses the login when it is open', () => {
    // Arrange: a logger that keeps its lines.
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: write the boot lines with the two PINs set and BAJAOVRLAY_API_OPEN=true.
    logOperatorLoginAtBoot({
      logger,
      operatorPins: operatorPinsOfTheTests,
      isCommandApiOpenToTheNetwork: true,
    });

    // Assert: the login line, then one warning that the API needs neither login nor role.
    const lines = readRecordedLines();
    expect(
      lines.map((line) => `${line.level}: ${line.message}`),
      'whoever reads `docker logs` must see that the PINs do not cover the API',
    ).toEqual([
      'info: operator login on: the control page asks for a role and its PIN',
      'warn: the command API is open to the whole network without login or roles (BAJAOVRLAY_API_OPEN=true): any computer on the network may take, clear and run macros, whatever the PINs',
    ]);
  });

  it('adds no such warning with the login off, whose own warning already covers it', () => {
    // Arrange: a logger that keeps its lines.
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: write the boot lines with no PINs and BAJAOVRLAY_API_OPEN=true.
    logOperatorLoginAtBoot({
      logger,
      operatorPins: operatorLoginTurnedOff,
      isCommandApiOpenToTheNetwork: true,
    });

    // Assert: only the login-off warning; the command API's own boot line says it is open.
    expect(readRecordedLines().length, 'one line: the login is off').toBe(1);
  });
});

describe('the login’s own log lines', () => {
  it('name the role and the station, never a PIN', () => {
    // Arrange: a login with the tests' two PINs, writing to a logger that keeps its lines.
    const { logger, readRecordedLines } = createRecordingLogger();
    const operatorLogin = createOperatorLogin({
      database: openTemporaryDatabase().database,
      operatorPins: operatorPinsOfTheTests,
      readCurrentTime: () => new Date('2026-11-07T11:00:00.000Z'),
      logger,
    });

    // Act: a wrong login, then a right one, from the same address.
    operatorLogin.logIn({
      role: 'produtor',
      pin: mistypedTestPin,
      station: 'Mesa 1',
      clientAddress: '192.168.0.21',
    });
    operatorLogin.logIn({
      role: 'produtor',
      pin: producerTestPin,
      station: 'Mesa 1',
      clientAddress: '192.168.0.21',
    });

    // Assert: a warning and a line of information, with the role and station, no PIN.
    const lines = readRecordedLines();
    expect(
      lines.map((line) => line.message),
      'a refused login and a login',
    ).toEqual(['operator login refused: wrong PIN', 'operator logged in']);
    expect(lines[1], 'the login names the role and station').toMatchObject({
      role: 'produtor',
      station: 'Mesa 1',
    });
    const everyLineAsText = JSON.stringify(lines);
    expect(everyLineAsText, 'the typed PIN is never logged').not.toContain(mistypedTestPin);
    expect(everyLineAsText, 'the right PIN is never logged').not.toContain(producerTestPin);
  });
});
