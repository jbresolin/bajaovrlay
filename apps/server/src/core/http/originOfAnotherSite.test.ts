/**
 * Whether a request came from a page of another site, by its Origin (apps/server)
 *
 * What this module is for:
 *   Two doors of the server let in only its own pages: an image upload
 *   (modules/media/uploadOrigin.ts) and the WebSocket (gate 2 of PR #51). A browser names
 *   the page that made a request in its Origin header; a page is the server's own when that
 *   is the address the request reached, or one listed in BAJAOVRLAY_PUBLIC_ORIGINS (a reverse
 *   proxy that ends HTTPS in front of the server). No Origin is a tool, not a page.
 *
 * What these tests prove (each row of the table):
 *   - The server's own origin and a listed one are not another site; another port, another
 *     host, another scheme and "null" are; no Origin is not.
 *   - A request whose own address is unknown (no Host header) is another site's whenever it
 *     names an Origin that is not listed.
 *
 * What these tests deliberately do not cover:
 *   - How each door answers; uploadOriginBehindAProxy.test.ts and core/ws's
 *     webSocketHubOrigin.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { isOriginOfAnotherSite } from './originOfAnotherSite.js';

const originOfTheServer = 'http://192.168.0.10:3000';
const publicOriginsOfTheProxy = ['https://graficos.bajasae.example'];

describe('isOriginOfAnotherSite', () => {
  const scenarios = [
    // The control page as the stream PC serves it.
    {
      name: 'the server’s own origin',
      origin: 'http://192.168.0.10:3000',
      serverOrigin: originOfTheServer,
      isAnotherSite: false,
    },
    // curl or Companion: a tool, not a page, so no Origin.
    {
      name: 'no Origin at all',
      origin: undefined,
      serverOrigin: originOfTheServer,
      isAnotherSite: false,
    },
    // The proxy's page: https outside, http when it reaches the server.
    {
      name: 'an origin listed as the proxy’s',
      origin: 'https://graficos.bajasae.example',
      serverOrigin: originOfTheServer,
      isAnotherSite: false,
    },
    // Companion's web UI on the same machine: same site for the cookie, another origin.
    {
      name: 'another port of the same host',
      origin: 'http://192.168.0.10:8000',
      serverOrigin: originOfTheServer,
      isAnotherSite: true,
    },
    // Any other site.
    {
      name: 'another host',
      origin: 'http://pagina-qualquer.example',
      serverOrigin: originOfTheServer,
      isAnotherSite: true,
    },
    // The same host and port under https, which this server does not serve.
    {
      name: 'another scheme',
      origin: 'https://192.168.0.10:3000',
      serverOrigin: originOfTheServer,
      isAnotherSite: true,
    },
    // A page opened from a file.
    { name: '"null"', origin: 'null', serverOrigin: originOfTheServer, isAnotherSite: true },
    // A request with no Host header: nothing to match but the list.
    {
      name: 'any unlisted origin when the server’s own is unknown',
      origin: 'http://192.168.0.10:3000',
      serverOrigin: undefined,
      isAnotherSite: true,
    },
  ];

  it.each(scenarios)('answers for $name', ({ origin, serverOrigin, isAnotherSite }) => {
    // Arrange: the row's Origin, the server's address and the proxy listed (in the table).

    // Act: ask the rule.
    const answer = isOriginOfAnotherSite(origin, serverOrigin, publicOriginsOfTheProxy);

    // Assert: the row's answer.
    expect(answer, 'whether this is another site’s page').toBe(isAnotherSite);
  });
});
