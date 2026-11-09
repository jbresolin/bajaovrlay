/**
 * Reading BAJAOVRLAY_NTP_SERVERS at boot (apps/server)
 *
 * What this module is for:
 *   The server clock follows NTP (BAJAOVRLAY-62). readServerEnvironment reads the
 *   servers into their parsed settings, so main.ts hands startServer a list, not a text.
 *
 * What these tests prove:
 *   - Unset, the setting is NTP on, with NTP.br first.
 *   - "off" is NTP off.
 *   - A wrong entry stops the boot, naming the variable and the entry.
 *
 * What these tests deliberately do not cover:
 *   - Every form of the list; core/time/ntpSettings.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readServerEnvironment } from './readServerEnvironment.js';

describe('readServerEnvironment and BAJAOVRLAY_NTP_SERVERS', () => {
  it('reads an unset variable as NTP on, with NTP.br first', () => {
    // Arrange: an environment that does not set it.
    const environmentVariables = {};

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: on, a.st1.ntp.br first.
    expect(environment.BAJAOVRLAY_NTP_SERVERS.isNtpOn, 'NTP is on unless turned off').toBe(true);
    expect(
      environment.BAJAOVRLAY_NTP_SERVERS.isNtpOn && environment.BAJAOVRLAY_NTP_SERVERS.servers[0],
      'NTP.br is asked first',
    ).toEqual({ host: 'a.st1.ntp.br', port: 123 });
  });

  it('reads "off" as NTP off', () => {
    // Arrange: the browser tests' setting.
    const environmentVariables = { BAJAOVRLAY_NTP_SERVERS: 'off' };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: off.
    expect(environment.BAJAOVRLAY_NTP_SERVERS, 'the clock stays on the wall clock').toEqual({
      isNtpOn: false,
    });
  });

  it('stops the boot naming the variable and the entry that is wrong', () => {
    // Arrange: a port written as a word.
    const environmentVariables = { BAJAOVRLAY_NTP_SERVERS: 'a.st1.ntp.br:ntp' };

    // Act: read the environment, keeping what it throws.
    const readTheEnvironment = () => readServerEnvironment(environmentVariables);

    // Assert: the error names both.
    expect(readTheEnvironment, 'the variable must be named').toThrow('BAJAOVRLAY_NTP_SERVERS');
    expect(readTheEnvironment, 'the wrong entry must be named').toThrow('a.st1.ntp.br:ntp');
  });
});
