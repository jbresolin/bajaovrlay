/**
 * Reading BAJAOVRLAY_PUBLIC_ORIGINS (apps/server)
 *
 * What this module is for:
 *   Behind the TrueNAS reverse proxy (Nginx Proxy Manager) the Cadastros page is opened at
 *   the proxy's public address, for example https://bajaovrlay.casa.lan, while the server
 *   itself is reached over plain HTTP inside the Docker network. The upload's Origin then
 *   never equals the address the request reached, and every image was refused 403 (gate 2
 *   of PR #23). BAJAOVRLAY_PUBLIC_ORIGINS lists the public addresses whose pages may
 *   upload as well. This file turns the variable's text into that list.
 *
 * What these tests prove:
 *   - Unset or empty, the list is empty: only the server's own address may upload.
 *   - Entries are split on commas, trimmed, and kept as origins (scheme, host, port),
 *     written the way a browser writes an Origin header.
 *   - Anything that is not an http or https origin is refused, naming the entry, so a
 *     typo stops the boot instead of refusing every upload at the event.
 *
 * What these tests deliberately do not cover:
 *   - The upload route using the list: uploadOriginBehindAProxy.test.ts.
 *   - main.ts reading the variable: core/env/readServerEnvironmentPublicOrigins.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { parsePublicOrigins } from './publicOrigins.js';

describe('parsePublicOrigins', () => {
  const acceptedTexts = [
    // Most installs: the variable is not set at all.
    { name: 'reads an unset variable as no public origin', text: undefined, expected: [] },
    // Set to nothing in the env file, as .env.example leaves it.
    { name: 'reads an empty variable as no public origin', text: '', expected: [] },
    // The TrueNAS install: one address on the proxy, over HTTPS.
    {
      name: 'reads one https address',
      text: 'https://bajaovrlay.casa.lan',
      expected: ['https://bajaovrlay.casa.lan'],
    },
    // Two addresses, with spaces after the comma as a person types them.
    {
      name: 'reads two addresses separated by a comma and a space',
      text: 'https://bajaovrlay.casa.lan, http://192.168.2.5:8080',
      expected: ['https://bajaovrlay.casa.lan', 'http://192.168.2.5:8080'],
    },
    // Copied from the address bar: the trailing slash is not part of an Origin.
    {
      name: 'drops the trailing slash copied from the address bar',
      text: 'https://bajaovrlay.casa.lan/',
      expected: ['https://bajaovrlay.casa.lan'],
    },
    // A browser never writes the default port or capitals in an Origin; neither does the list.
    {
      name: 'writes the host in lower case and leaves out the default port',
      text: 'https://BajaOvrLay.Casa.Lan:443',
      expected: ['https://bajaovrlay.casa.lan'],
    },
  ];

  it.each(acceptedTexts)('$name', ({ text, expected }) => {
    // Arrange: the text of this row, as the env file holds it.

    // Act: read it.
    const parsing = parsePublicOrigins(text);

    // Assert: the origins of this row.
    expect(parsing, 'the list must hold the origins as a browser writes them').toEqual({
      isValid: true,
      publicOrigins: expected,
    });
  });

  const refusedEntries = [
    // The host alone, as BAJAOVRLAY_SOURCE_ALLOWED_HOSTS is written: the scheme matters here.
    { name: 'refuses a host with no scheme', entry: 'bajaovrlay.casa.lan' },
    // A page address: an Origin never has a path, so this entry would never match.
    { name: 'refuses an address with a path', entry: 'https://bajaovrlay.casa.lan/render/' },
    // Not a web page at all.
    { name: 'refuses a WebSocket address', entry: 'ws://bajaovrlay.casa.lan' },
  ];

  it.each(refusedEntries)('$name', ({ entry }) => {
    // Arrange: a good origin, then the bad entry of this row.
    const text = `https://bajaovrlay.casa.lan,${entry}`;

    // Act: read it.
    const parsing = parsePublicOrigins(text);

    // Assert: refused, naming the entry as written.
    expect(parsing, 'the bad entry must be named as written').toEqual({
      isValid: false,
      badEntry: entry,
    });
  });
});
