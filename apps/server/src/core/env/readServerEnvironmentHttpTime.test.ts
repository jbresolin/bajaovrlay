/**
 * Reading BAJAOVRLAY_HTTP_TIME_SERVERS at boot (apps/server)
 *
 * What this module is for:
 *   While NTP is quiet the server clock follows the Date headers of HTTPS servers
 *   (BAJAOVRLAY-76). readServerEnvironment reads those servers into their parsed
 *   settings, so main.ts hands startServer a list, not a text.
 *
 * What these tests prove:
 *   - Unset, the fallback is on, with Cloudflare first.
 *   - "off" is the fallback off.
 *   - A wrong entry, or one server alone, stops the boot naming the variable and why.
 *
 * What these tests deliberately do not cover:
 *   - Every form of the list; core/time/httpTimeSettings.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readServerEnvironment } from './readServerEnvironment.js';

describe('readServerEnvironment and BAJAOVRLAY_HTTP_TIME_SERVERS', () => {
  it('reads an unset variable as the fallback on, with Cloudflare first', () => {
    // Arrange: an environment that does not set it.
    const environmentVariables = {};

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: on, www.cloudflare.com first.
    const settings = environment.BAJAOVRLAY_HTTP_TIME_SERVERS;
    expect(settings.isHttpTimeOn, 'the fallback is on unless turned off').toBe(true);
    expect(
      settings.isHttpTimeOn && settings.serverAddresses[0],
      'Cloudflare is asked first',
    ).toBe('https://www.cloudflare.com');
  });

  it('reads "off" as the fallback off', () => {
    // Arrange: the browser tests' setting.
    const environmentVariables = { BAJAOVRLAY_HTTP_TIME_SERVERS: 'off' };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: off.
    expect(environment.BAJAOVRLAY_HTTP_TIME_SERVERS, 'no HTTPS time').toEqual({
      isHttpTimeOn: false,
    });
  });

  it('stops the boot naming the variable and the entry that is wrong', () => {
    // Arrange: a host written without its scheme.
    const environmentVariables = {
      BAJAOVRLAY_HTTP_TIME_SERVERS: 'www.cloudflare.com,https://www.ntp.br',
    };

    // Act: read the environment, keeping what it throws.
    const readTheEnvironment = () => readServerEnvironment(environmentVariables);

    // Assert: the error names both.
    expect(readTheEnvironment, 'the variable must be named').toThrow(
      'BAJAOVRLAY_HTTP_TIME_SERVERS',
    );
    expect(readTheEnvironment, 'the wrong entry must be named').toThrow('www.cloudflare.com');
  });

  it('stops the boot on one server alone, saying two are needed', () => {
    // Arrange: one address only.
    const environmentVariables = { BAJAOVRLAY_HTTP_TIME_SERVERS: 'https://www.ntp.br' };

    // Act: read the environment, keeping what it throws.
    const readTheEnvironment = () => readServerEnvironment(environmentVariables);

    // Assert: the error says why.
    expect(readTheEnvironment, 'two servers must agree').toThrow('at least two');
  });
});
