/**
 * Reading BAJAOVRLAY_OBS_URL and BAJAOVRLAY_OBS_PASSWORD at boot (apps/server)
 *
 * What this module is for:
 *   readServerEnvironment checks every variable the server reads at boot and stops the
 *   boot naming a bad one. The two OBS variables (BAJAOVRLAY-27) say where OBS's WebSocket
 *   server is and its password; with no address the OBS module stays off.
 *
 * What these tests prove:
 *   - Unset, or set to nothing, both read as not set: OBS control is off.
 *   - The address OBS 32 shows in its WebSocket Server Settings is read as given.
 *   - An address that is not ws:// or wss:// stops the boot, naming the variable.
 *   - The boot’s error never repeats the password, not even one written into the address
 *     (user and password masked as `***`).
 *
 * What these tests deliberately do not cover:
 *   - What the connection does with them; modules/obs/obsConnection.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readServerEnvironment } from './readServerEnvironment.js';

describe('readServerEnvironment and the OBS variables', () => {
  const notSetScenarios = [
    // The default: no OBS on this machine (dev, TrueNAS).
    { name: 'reads unset variables as OBS off', environmentVariables: {} },
    // A compose file that keeps the lines but leaves them empty.
    {
      name: 'reads empty variables as OBS off',
      environmentVariables: { BAJAOVRLAY_OBS_URL: '', BAJAOVRLAY_OBS_PASSWORD: '' },
    },
  ];

  it.each(notSetScenarios)('$name', ({ environmentVariables }) => {
    // Arrange: the row's environment (in the table above).

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: neither is set.
    expect(environment.BAJAOVRLAY_OBS_URL, 'no address means OBS control is off').toBe(undefined);
    expect(environment.BAJAOVRLAY_OBS_PASSWORD, 'no password is sent').toBe(undefined);
  });

  it('reads the address and password OBS 32 shows in its WebSocket Server Settings', () => {
    // Arrange: the stream PC, OBS on the same machine as the Docker container.
    const environmentVariables = {
      BAJAOVRLAY_OBS_URL: 'ws://host.docker.internal:4455',
      BAJAOVRLAY_OBS_PASSWORD: 'senha-do-obs-pista-2026',
    };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: both as given.
    expect(environment.BAJAOVRLAY_OBS_URL, 'the address as written').toBe(
      'ws://host.docker.internal:4455',
    );
    expect(environment.BAJAOVRLAY_OBS_PASSWORD, 'the password as written').toBe(
      'senha-do-obs-pista-2026',
    );
  });

  it('stops the boot for an address that is not ws:// or wss://, without the password', () => {
    // Arrange: the address of OBS's browser source pasted by mistake, and a password.
    const environmentVariables = {
      BAJAOVRLAY_OBS_URL: 'http://127.0.0.1:4455',
      BAJAOVRLAY_OBS_PASSWORD: 'senha-do-obs-pista-2026',
    };

    // Act: read the environment, keeping what it throws.
    let bootError = '';
    try {
      readServerEnvironment(environmentVariables);
    } catch (thrown) {
      bootError = String(thrown);
    }

    // Assert: it names the variable and what to write, and never the password.
    expect(bootError, 'the boot must stop naming the variable').toContain('BAJAOVRLAY_OBS_URL');
    expect(bootError, 'the boot must say how to write it').toContain(
      '"http://127.0.0.1:4455" is not an obs-websocket address (write it as ws://127.0.0.1:4455)',
    );
    expect(bootError, 'the boot’s error must never print the password').not.toContain(
      'senha-do-obs-pista-2026',
    );
  });

  const addressesWithAUserAndPasswordScenarios = [
    // A password written into the address, the way some tools take it, with the wrong
    // scheme: the boot error must show where, never the user and password.
    {
      name: 'masks a user and password written into an address with the wrong scheme',
      writtenAddress: 'http://operador:senha-do-obs-pista-2026@127.0.0.1:4455',
      addressInTheError: '"http://***@127.0.0.1:4455"',
    },
    // So malformed that it is not an address at all: everything before the "@" is
    // masked, since the boot cannot tell which part is the password.
    {
      name: 'masks everything before the "@" of a text that is not an address',
      writtenAddress: 'ws//operador:senha-do-obs-pista-2026@127.0.0.1:4455',
      addressInTheError: '"***@127.0.0.1:4455"',
    },
  ];

  it.each(addressesWithAUserAndPasswordScenarios)(
    '$name',
    ({ writtenAddress, addressInTheError }) => {
      // Arrange: the row's address (in the table above).
      const environmentVariables = { BAJAOVRLAY_OBS_URL: writtenAddress };

      // Act: read the environment, keeping what it throws.
      let bootError = '';
      try {
        readServerEnvironment(environmentVariables);
      } catch (thrown) {
        bootError = String(thrown);
      }

      // Assert: the error quotes the address masked, and the password appears nowhere.
      expect(bootError, 'the boot must quote the address with its user masked').toContain(
        `${addressInTheError} is not an obs-websocket address`,
      );
      expect(bootError, 'the password inside the address must never be printed').not.toContain(
        'senha-do-obs-pista-2026',
      );
      expect(bootError, 'the user inside the address is masked too').not.toContain('operador');
    },
  );
});
