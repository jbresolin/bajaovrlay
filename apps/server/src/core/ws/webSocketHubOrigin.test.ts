/**
 * Which pages may open the WebSocket, by their Origin (apps/server)
 *
 * What this module is for:
 *   SameSite=Strict keeps the session cookie (BAJAOVRLAY-29) from other sites, but a site
 *   is a host, not a port: a page of another app on the same machine (Companion's web UI,
 *   anything else on the TrueNAS box) is same-site, so the browser sends it the cookie, and
 *   it could open /ws as the logged-in operator (gate 2 of PR #51). So the upgrade is
 *   refused with 403 when its Origin header is neither this server's own address nor one
 *   listed in BAJAOVRLAY_PUBLIC_ORIGINS (a reverse proxy's), as uploads already are
 *   (modules/media/uploadOrigin.ts). No Origin at all is not a web page (OBS, Companion,
 *   curl, the server's tests), and is let through to the session check as before.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - With the Produtor's cookie, the server's own Origin and no Origin open; a page of
 *     another port of the same host, of another host, and `null` (a local file) get 403;
 *     an Origin listed in BAJAOVRLAY_PUBLIC_ORIGINS opens.
 *   - A renderer's and a monitor's connection open with no Origin and with the server's
 *     own, as OBS and the control page's frames send them; one from another site gets 403.
 *   - With the login off, another site's page still gets 403: it needs no cookie at all.
 *
 * What these tests deliberately do not cover:
 *   - The session check after the Origin; webSocketHubOperatorSession.test.ts.
 *   - The rule shared with uploads, value by value; core/http/originOfAnotherSite.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  operatorPinsOfTheTests,
  producerTestPin,
} from '../operatorLogin/fakeOperatorPins.testSupport.js';
import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import { tryWebSocketAndReadTheAnswer } from './webSocketTestClient.testSupport.js';

/** The address a reverse proxy in front of the server would give its pages. */
const publicOriginOfTheProxy = 'https://graficos.bajasae.example';

/** Logs in as the Produtor at "Mesa 1" over HTTP and gives back the cookie for /ws. */
async function logInAsTheProducer(port: number): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'produtor', pin: producerTestPin, station: 'Mesa 1' }),
  });
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

/** A server with the two PINs and a proxy's public address listed. */
async function startServerWithTheLoginOnBehindAProxy() {
  return startServerOnARandomPort({
    operatorPins: operatorPinsOfTheTests,
    publicOrigins: [publicOriginOfTheProxy],
  });
}

describe('/ws with the Produtor’s cookie, by Origin', () => {
  const scenarios = [
    // The control page served by this server, as the browser sends it.
    {
      name: 'opens from the server’s own page',
      originOf: (port: number) => `http://127.0.0.1:${String(port)}`,
      answer: 'opened',
    },
    // A tool, not a page: no browser leaves the Origin out of a socket.
    { name: 'opens with no Origin at all', originOf: () => undefined, answer: 'opened' },
    // The review's case: Companion's web UI on the same machine, another port, same site.
    {
      name: 'refuses a page of another port on the same host',
      originOf: () => 'http://127.0.0.1:8000',
      answer: 403,
    },
    // Any other site the operator's browser has open.
    {
      name: 'refuses a page of another host',
      originOf: () => 'http://pagina-qualquer.example',
      answer: 403,
    },
    // A page opened from a file, which browsers send as "null".
    { name: 'refuses a page opened from a file', originOf: () => 'null', answer: 403 },
    // The pages a reverse proxy serves, listed in BAJAOVRLAY_PUBLIC_ORIGINS.
    {
      name: 'opens from an origin listed as the proxy’s',
      originOf: () => publicOriginOfTheProxy,
      answer: 'opened',
    },
  ];

  it.each(scenarios)('$name', async ({ originOf, answer }) => {
    // Arrange: a running server with the PINs and a proxy listed, and the Produtor's cookie.
    const runningServer = await startServerWithTheLoginOnBehindAProxy();
    const cookie = await logInAsTheProducer(runningServer.port);

    // Act: open /ws with that cookie and the row's Origin.
    const outcome = await tryWebSocketAndReadTheAnswer(runningServer.port, {
      cookie,
      origin: originOf(runningServer.port),
    });

    // Assert: the row's answer.
    expect(outcome, 'opened, or the status the upgrade was refused with').toBe(answer);
  });
});

describe('/ws for screens, by Origin', () => {
  const scenarios = [
    // OBS's browser source, as a tool with no Origin.
    {
      name: 'opens a renderer with no Origin',
      role: 'renderer' as const,
      originOf: () => undefined,
      answer: 'opened',
    },
    // OBS loading /render/ from this server: the page's own Origin.
    {
      name: 'opens a renderer from the server’s own page',
      role: 'renderer' as const,
      originOf: (port: number) => `http://127.0.0.1:${String(port)}`,
      answer: 'opened',
    },
    // The control page's "Programa" frame, served by this server.
    {
      name: 'opens a monitor from the server’s own page',
      role: 'monitor' as const,
      originOf: (port: number) => `http://127.0.0.1:${String(port)}`,
      answer: 'opened',
    },
    // A screen's address is no pass: another site's page is refused all the same.
    {
      name: 'refuses a renderer from another site',
      role: 'renderer' as const,
      originOf: () => 'http://127.0.0.1:8000',
      answer: 403,
    },
  ];

  it.each(scenarios)('$name', async ({ role, originOf, answer }) => {
    // Arrange: a running server with the PINs set.
    const runningServer = await startServerWithTheLoginOnBehindAProxy();

    // Act: open /ws as the row's screen, with no cookie and the row's Origin.
    const outcome = await tryWebSocketAndReadTheAnswer(runningServer.port, {
      role,
      origin: originOf(runningServer.port),
    });

    // Assert: the row's answer.
    expect(outcome, 'opened, or the status the upgrade was refused with').toBe(answer);
  });
});

describe('/ws with the login off', () => {
  it('still refuses a page of another site, which needs no cookie to act', async () => {
    // Arrange: a running server with no PINs.
    const runningServer = await startServerOnARandomPort();

    // Act: open /ws from a page of another port of the same host.
    const outcome = await tryWebSocketAndReadTheAnswer(runningServer.port, {
      origin: 'http://127.0.0.1:8000',
    });

    // Assert: refused, though the login is off.
    expect(outcome, 'another site’s page may not drive the console').toBe(403);
  });
});
