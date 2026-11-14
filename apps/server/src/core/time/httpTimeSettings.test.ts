/**
 * Reading BAJAOVRLAY_HTTP_TIME_SERVERS (apps/server)
 *
 * What this module is for:
 *   When NTP is quiet (a venue whose router blocks UDP 123), the server clock follows the
 *   Date headers of HTTPS servers instead (BAJAOVRLAY-76). The variable names those
 *   servers, comma-separated: each an https:// (or, for a server on the LAN, http://)
 *   address. Unset or empty is the default list; "off" turns the fallback off.
 *
 * What these tests prove:
 *   - Unset or empty: Cloudflare, NTP.br's web server and Google, in that order.
 *   - "off" turns it off.
 *   - A list is read in its order, spaces around the commas ignored.
 *   - An entry that is not an http(s) address is named, so the boot can stop on it.
 *   - One server alone is refused: an answer is only kept when two servers agree.
 *
 * What these tests deliberately do not cover:
 *   - The boot error built from it; readServerEnvironmentHttpTime.test.ts.
 *   - The requests to those servers; httpDateClient.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { parseHttpTimeSettings } from './httpTimeSettings.js';

describe('parseHttpTimeSettings', () => {
  // Unset and empty mean the same: `BAJAOVRLAY_HTTP_TIME_SERVERS=` in .env is "not set".
  it.each([
    { name: 'unset', text: undefined },
    { name: 'empty', text: '' },
  ])('reads $name as the default list', ({ text }) => {
    // Arrange: the variable as the row has it.

    // Act: read it.
    const parsing = parseHttpTimeSettings(text);

    // Assert: on, with the three default servers in order.
    expect(parsing, 'the default list').toEqual({
      isValid: true,
      httpTimeSettings: {
        isHttpTimeOn: true,
        serverAddresses: [
          'https://www.cloudflare.com',
          'https://www.ntp.br',
          'https://www.google.com',
        ],
      },
    });
  });

  it('turns the fallback off with "off", as the browser tests do', () => {
    // Arrange: the browser tests' setting.
    const text = 'off';

    // Act: read it.
    const parsing = parseHttpTimeSettings(text);

    // Assert: off.
    expect(parsing, 'no HTTPS time at all').toEqual({
      isValid: true,
      httpTimeSettings: { isHttpTimeOn: false },
    });
  });

  it('reads a list in its order, a LAN server on http included', () => {
    // Arrange: the timing tent's web server first, then two public ones.
    const text = 'http://192.168.10.5:8080, https://www.ntp.br ,https://www.google.com';

    // Act: read it.
    const parsing = parseHttpTimeSettings(text);

    // Assert: the three, trimmed, in order.
    expect(parsing, 'the list as written').toEqual({
      isValid: true,
      httpTimeSettings: {
        isHttpTimeOn: true,
        serverAddresses: [
          'http://192.168.10.5:8080',
          'https://www.ntp.br',
          'https://www.google.com',
        ],
      },
    });
  });

  // Each row is a mistake someone could write in .env; the boot must name it.
  it.each([
    // A host without its scheme: written as for BAJAOVRLAY_NTP_SERVERS.
    {
      name: 'a bare host',
      text: 'www.cloudflare.com,https://www.ntp.br',
      badEntry: 'www.cloudflare.com',
    },
    // NTP's own scheme is not a web address.
    {
      name: 'an ntp:// address',
      text: 'https://www.ntp.br,ntp://a.st1.ntp.br',
      badEntry: 'ntp://a.st1.ntp.br',
    },
    // A doubled comma leaves an empty entry.
    { name: 'an empty entry', text: 'https://www.ntp.br,,https://www.google.com', badEntry: '' },
  ])('names $name as the bad entry', ({ text, badEntry }) => {
    // Arrange: the variable with the mistake (the row).

    // Act: read it.
    const parsing = parseHttpTimeSettings(text);

    // Assert: refused, naming the entry.
    expect(parsing, 'the boot must say which entry is wrong').toEqual({
      isValid: false,
      problem: { kind: 'badEntry', badEntry },
    });
  });

  it('refuses one server alone: no second server to agree with it', () => {
    // Arrange: one address only.
    const text = 'https://www.cloudflare.com';

    // Act: read it.
    const parsing = parseHttpTimeSettings(text);

    // Assert: refused for being alone, not for its address.
    expect(parsing, 'one server can never be confirmed').toEqual({
      isValid: false,
      problem: { kind: 'fewerThanTwoServers' },
    });
  });
});
