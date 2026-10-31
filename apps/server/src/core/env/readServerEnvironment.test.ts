/**
 * Reading BAJAOVRLAY_SOURCE_ALLOWED_HOSTS and BAJAOVRLAY_API_TOKENS at boot (apps/server)
 *
 * What this module is for:
 *   readServerEnvironment checks every variable the server reads at boot (see
 *   .env.example) and stops the boot with a message naming the bad one. The list of hosts
 *   a flex source may fetch is read here into its parsed form, so a typo in it stops the
 *   boot instead of refusing the timing system at every poll.
 *
 * What these tests prove:
 *   - Unset, BAJAOVRLAY_SOURCE_ALLOWED_HOSTS reads as no list.
 *   - Set, it reads as the list of its entries.
 *   - An entry that is not a host or host:port stops the boot, naming the variable and
 *     the entry.
 *
 * What these tests deliberately do not cover:
 *   - Every way an entry is read and matched: sourceHostAllowlist.test.ts in the
 *     data-source module.
 *   - Every way the tokens are read: apiTokens.test.ts in core/apiAccess.
 *   - The other variables: resolveDatabasePath.test.ts and resolveDataFolder.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { companionToken } from '../apiAccess/fakeApiTokens.testSupport.js';
import { readServerEnvironment } from './readServerEnvironment.js';

describe('readServerEnvironment and BAJAOVRLAY_SOURCE_ALLOWED_HOSTS', () => {
  it('reads an unset variable as no list', () => {
    // Arrange: an environment without the variable, as most installs have.
    const environmentVariables = {};

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: no list.
    expect(environment.BAJAOVRLAY_SOURCE_ALLOWED_HOSTS, 'unset must mean no list').toEqual({
      isSet: false,
    });
  });

  it('reads the hosts of a list that is set', () => {
    // Arrange: the timing system on the LAN and the federation's API.
    const environmentVariables = {
      BAJAOVRLAY_SOURCE_ALLOWED_HOSTS: 'cronometragem.local:8080,api.bajasaebrasil.org.br',
    };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: both entries, the second on any port.
    expect(environment.BAJAOVRLAY_SOURCE_ALLOWED_HOSTS, 'the list must hold both hosts').toEqual({
      isSet: true,
      allowedHosts: [
        { hostName: 'cronometragem.local', port: '8080' },
        { hostName: 'api.bajasaebrasil.org.br', port: undefined },
      ],
    });
  });

  it('stops the boot naming the variable and an entry that is not a host', () => {
    // Arrange: a whole address pasted in by mistake.
    const environmentVariables = {
      BAJAOVRLAY_SOURCE_ALLOWED_HOSTS: 'http://cronometragem.local:8080/api',
    };

    // Act: read the environment, keeping what it throws.
    const readingTheEnvironment = () => readServerEnvironment(environmentVariables);

    // Assert: it throws, naming the variable and the entry as written.
    expect(readingTheEnvironment, 'the boot must stop naming the variable').toThrow(
      'BAJAOVRLAY_SOURCE_ALLOWED_HOSTS',
    );
    expect(readingTheEnvironment, 'the boot must stop naming the bad entry').toThrow(
      '"http://cronometragem.local:8080/api" is not a host or host:port',
    );
  });
});

describe('readServerEnvironment and BAJAOVRLAY_API_TOKENS', () => {
  it('reads an unset variable as the command API off', () => {
    // Arrange: an environment without the variable, as most installs have.
    const environmentVariables = {};

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: off.
    expect(environment.BAJAOVRLAY_API_TOKENS, 'unset must mean the API is off').toEqual({
      isSet: false,
    });
  });

  it('reads the devices of a variable that is set', () => {
    // Arrange: Companion on the operator's desk.
    const environmentVariables = {
      BAJAOVRLAY_API_TOKENS: `companion=${companionToken}`,
    };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: one device.
    expect(environment.BAJAOVRLAY_API_TOKENS, 'the variable must list Companion').toEqual({
      isSet: true,
      tokens: [{ name: 'companion', token: companionToken }],
    });
  });

  it('stops the boot naming the variable, without repeating the token', () => {
    // Arrange: a token too short to be safe on the LAN.
    const environmentVariables = { BAJAOVRLAY_API_TOKENS: 'companion=baja2026' };

    // Act: read the environment, keeping the message it throws.
    let thrownMessage = '';
    try {
      readServerEnvironment(environmentVariables);
    } catch (bootError) {
      thrownMessage = (bootError as Error).message;
    }

    // Assert: the variable and the device are named, the token is not.
    expect(thrownMessage, 'the boot must stop naming the variable').toContain(
      'BAJAOVRLAY_API_TOKENS',
    );
    expect(thrownMessage, 'the boot must say which device').toContain(
      'the token of "companion" is shorter than 16 characters',
    );
    expect(thrownMessage, 'the boot message never repeats a token').not.toContain('baja2026');
  });
});
