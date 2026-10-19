/**
 * Reading BAJAOVRLAY_SOURCE_ALLOWED_HOSTS at boot (apps/server)
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
 *   - The other variables: resolveDatabasePath.test.ts and resolveDataFolder.test.ts.
 */
import { describe, expect, it } from 'vitest';

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
