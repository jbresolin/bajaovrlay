/**
 * Reading BAJAOVRLAY_PIN_PRODUCER and BAJAOVRLAY_PIN_DATA at boot (apps/server)
 *
 * What this module is for:
 *   readServerEnvironment checks every variable the server reads at boot and stops the
 *   boot naming a bad one. The two PINs (BAJAOVRLAY-29) turn the operator login on: with
 *   both set, the control page asks for a role and its PIN; with neither, the page stays
 *   open as it always was. Anything in between would leave one role locked out or the two
 *   roles indistinguishable, so it stops the boot with a reason in pt-BR.
 *
 * What these tests prove (one table of the PIN settings):
 *   - Neither set, or both empty: the login is off.
 *   - Both set, 4 to 8 digits each and different: the login is on, with both PINs.
 *   - Only one set, two equal PINs, or a PIN that is not 4 to 8 digits stops the boot,
 *     naming the variable and saying what to write, in pt-BR.
 *   - The boot's error never repeats a PIN.
 *
 * What these tests deliberately do not cover:
 *   - What the login does with the PINs; operatorLoginRoutes.test.ts.
 *   - The boot log's warning while the login is off; operatorLoginAtBoot.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { dataRoleTestPin, producerTestPin } from '../operatorLogin/fakeOperatorPins.testSupport.js';
import { readServerEnvironment } from './readServerEnvironment.js';

/** Reads the environment and gives back what the boot error said, or '' when there was none. */
function readTheBootErrorOf(environmentVariables: Record<string, string | undefined>): string {
  try {
    readServerEnvironment(environmentVariables);
    return '';
  } catch (thrown) {
    return String(thrown);
  }
}

describe('readServerEnvironment and the operator PINs', () => {
  const loginOffScenarios = [
    // The default: dev, and a stream PC set up before BAJAOVRLAY-29.
    { name: 'reads two unset PINs as the login off', environmentVariables: {} },
    // A compose file that keeps the two lines but leaves them empty.
    {
      name: 'reads two empty PINs as the login off',
      environmentVariables: { BAJAOVRLAY_PIN_PRODUCER: '', BAJAOVRLAY_PIN_DATA: '' },
    },
  ];

  it.each(loginOffScenarios)('$name', ({ environmentVariables }) => {
    // Arrange: the row's environment (in the table above).

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: no login is asked for.
    expect(environment.operatorPins, 'with no PINs the page stays open as today').toEqual({
      isLoginRequired: false,
    });
  });

  it('turns the login on with two different PINs of 4 to 8 digits', () => {
    // Arrange: a four-digit producer PIN and a four-digit data PIN.
    const environmentVariables = {
      BAJAOVRLAY_PIN_PRODUCER: producerTestPin,
      BAJAOVRLAY_PIN_DATA: dataRoleTestPin,
    };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: the login is on with both PINs, each for its role.
    expect(environment.operatorPins, 'both PINs must be kept, each for its role').toEqual({
      isLoginRequired: true,
      producerPin: producerTestPin,
      dataRolePin: dataRoleTestPin,
    });
  });

  it('takes a PIN of eight digits, the longest allowed', () => {
    // Arrange: an eight-digit producer PIN.
    const environmentVariables = {
      BAJAOVRLAY_PIN_PRODUCER: '24682468',
      BAJAOVRLAY_PIN_DATA: dataRoleTestPin,
    };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: the login is on.
    expect(environment.operatorPins.isLoginRequired, 'eight digits is a valid PIN').toBe(true);
  });

  const stoppedBootScenarios = [
    // Only the producer's PIN: Dados could never log in.
    {
      name: 'stops the boot when only the producer’s PIN is set',
      environmentVariables: { BAJAOVRLAY_PIN_PRODUCER: producerTestPin },
      expectedReason: 'Defina BAJAOVRLAY_PIN_PRODUCER e BAJAOVRLAY_PIN_DATA, ou nenhum dos dois',
    },
    // Only the data PIN: nobody could run the show.
    {
      name: 'stops the boot when only the data PIN is set',
      environmentVariables: { BAJAOVRLAY_PIN_PRODUCER: '', BAJAOVRLAY_PIN_DATA: dataRoleTestPin },
      expectedReason: 'Defina BAJAOVRLAY_PIN_PRODUCER e BAJAOVRLAY_PIN_DATA, ou nenhum dos dois',
    },
    // The same PIN for both: the PIN could not tell the roles apart.
    {
      name: 'stops the boot when both PINs are the same',
      environmentVariables: {
        BAJAOVRLAY_PIN_PRODUCER: producerTestPin,
        BAJAOVRLAY_PIN_DATA: producerTestPin,
      },
      expectedReason: 'BAJAOVRLAY_PIN_PRODUCER e BAJAOVRLAY_PIN_DATA precisam ser diferentes',
    },
    // Three digits: too short to keep a curious visitor out.
    {
      name: 'stops the boot for a PIN of three digits',
      environmentVariables: {
        BAJAOVRLAY_PIN_PRODUCER: '246',
        BAJAOVRLAY_PIN_DATA: dataRoleTestPin,
      },
      expectedReason: 'BAJAOVRLAY_PIN_PRODUCER precisa ter de 4 a 8 algarismos',
    },
    // Nine digits: longer than the login's keypad takes.
    {
      name: 'stops the boot for a PIN of nine digits',
      environmentVariables: {
        BAJAOVRLAY_PIN_PRODUCER: producerTestPin,
        BAJAOVRLAY_PIN_DATA: '135713571',
      },
      expectedReason: 'BAJAOVRLAY_PIN_DATA precisa ter de 4 a 8 algarismos',
    },
    // Letters: a PIN is digits only.
    {
      name: 'stops the boot for a PIN with letters',
      environmentVariables: {
        BAJAOVRLAY_PIN_PRODUCER: 'baja2468',
        BAJAOVRLAY_PIN_DATA: dataRoleTestPin,
      },
      expectedReason: 'BAJAOVRLAY_PIN_PRODUCER precisa ter de 4 a 8 algarismos',
    },
  ];

  it.each(stoppedBootScenarios)('$name', ({ environmentVariables, expectedReason }) => {
    // Arrange: the row's environment (in the table above).

    // Act: read the environment, keeping what it throws.
    const bootError = readTheBootErrorOf(environmentVariables);

    // Assert: the boot stops with the reason in pt-BR, and no PIN is repeated in it.
    expect(bootError, 'the boot must stop with the reason in pt-BR').toContain(expectedReason);
    for (const pin of Object.values(environmentVariables)) {
      if (pin !== undefined && pin !== '') {
        expect(bootError, 'the boot’s error must never print a PIN').not.toContain(pin);
      }
    }
  });
});
