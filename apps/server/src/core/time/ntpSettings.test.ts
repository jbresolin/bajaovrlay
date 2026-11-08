/**
 * The NTP servers the server clock follows (apps/server)
 *
 * What this module is for:
 *   BAJAOVRLAY_NTP_SERVERS names the NTP servers, comma-separated, asked in that order:
 *   a track-local server may come first. Left unset, the server asks NTP.br (close to the
 *   track and to the Baja app's VPS), then the pool. "off" turns NTP off: the clock runs
 *   on the machine's wall clock from boot, as the browser tests run it, never leaving the
 *   machine. A wrong entry stops the boot naming it.
 *
 * What these tests prove (one table of settings):
 *   - Unset or empty gives a.st1.ntp.br, b.st1.ntp.br and pool.ntp.org, on port 123.
 *   - A list keeps its order and spaces around commas do not matter; a port may be given.
 *   - "off" turns NTP off.
 *   - An entry with a bad port, or with a scheme, is refused, naming it.
 *
 * What these tests deliberately do not cover:
 *   - Reading the variable at boot; core/env/readServerEnvironment.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { parseNtpSettings } from './ntpSettings.js';

const settingScenarios = [
  // A fresh install: NTP.br first, then the pool.
  {
    name: 'gives NTP.br and the pool when unset',
    text: undefined,
    expected: {
      isValid: true,
      ntpSettings: {
        isNtpOn: true,
        servers: [
          { host: 'a.st1.ntp.br', port: 123 },
          { host: 'b.st1.ntp.br', port: 123 },
          { host: 'pool.ntp.org', port: 123 },
        ],
      },
    },
  },
  // `BAJAOVRLAY_NTP_SERVERS=` in .env means the same as leaving it out.
  {
    name: 'gives the same when empty',
    text: '',
    expected: {
      isValid: true,
      ntpSettings: {
        isNtpOn: true,
        servers: [
          { host: 'a.st1.ntp.br', port: 123 },
          { host: 'b.st1.ntp.br', port: 123 },
          { host: 'pool.ntp.org', port: 123 },
        ],
      },
    },
  },
  // The timing tent's own server first, on a port of its own, then NTP.br.
  {
    name: 'keeps the order of a list, with a port where one is given',
    text: '192.168.10.5:1123 , a.st1.ntp.br',
    expected: {
      isValid: true,
      ntpSettings: {
        isNtpOn: true,
        servers: [
          { host: '192.168.10.5', port: 1123 },
          { host: 'a.st1.ntp.br', port: 123 },
        ],
      },
    },
  },
  // The browser tests: the server clock must never wait on the internet.
  {
    name: 'turns NTP off with "off"',
    text: 'off',
    expected: { isValid: true, ntpSettings: { isNtpOn: false } },
  },
  // A typo in the port would leave the server on the wall clock without a word.
  {
    name: 'refuses a port that is not a number',
    text: 'a.st1.ntp.br:ntp',
    expected: { isValid: false, badEntry: 'a.st1.ntp.br:ntp' },
  },
  // An address copied from a browser is not an NTP server's name.
  {
    name: 'refuses an address with a scheme',
    text: 'https://ntp.br',
    expected: { isValid: false, badEntry: 'https://ntp.br' },
  },
];

describe('the NTP servers setting', () => {
  it.each(settingScenarios)('$name', ({ text, expected }) => {
    // Arrange: the variable's text, as this row writes it.

    // Act: read it.
    const parsing = parseNtpSettings(text);

    // Assert: the servers in order, off, or the entry named.
    expect(parsing, 'the setting must read as the row says').toEqual(expected);
  });
});
