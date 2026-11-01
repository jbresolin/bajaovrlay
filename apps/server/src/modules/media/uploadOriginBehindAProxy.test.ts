/**
 * An upload through the TrueNAS reverse proxy (apps/server)
 *
 * What this module is for:
 *   Between events the server runs on TrueNAS behind Nginx Proxy Manager. The operator
 *   opens Cadastros at the proxy's address (https://bajaovrlay.casa.lan); the proxy passes
 *   the request on over plain HTTP and keeps the Host header, so the server sees it reach
 *   http://bajaovrlay.casa.lan while the page's Origin says https. Without
 *   BAJAOVRLAY_PUBLIC_ORIGINS every upload was refused 403 there (gate 2 of PR #23).
 *
 * What these tests prove (with the real app, a real store and a temporary media folder):
 *   - With no public origin set, the upload through the proxy is refused 403, as before.
 *   - With the proxy's address set, the same upload is accepted.
 *   - With it set, a page of another site is still refused, and the server's own address
 *     (the stream PC on the LAN) is still accepted.
 *
 * What these tests deliberately do not cover:
 *   - How the variable's text is read: publicOrigins.test.ts.
 *   - The upload's other refusals (size, bytes, limits): mediaRoutes.test.ts and
 *     mediaStoreLimits.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { buildPngLogo } from './imageFiles.testSupport.js';
import { createAppWithAMediaFolder, uploadFile } from './mediaOnTheApp.testSupport.js';

/** The address the proxy passes the request on to: the public host name, over plain HTTP. */
const addressTheProxyPassesOn = 'http://bajaovrlay.casa.lan';
/** The address the operator's browser shows, and so the Origin of the Cadastros page. */
const publicAddressOfTheProxy = 'https://bajaovrlay.casa.lan';

describe('POST /api/v1/media behind a reverse proxy', () => {
  const scenarios = [
    // The bug of gate 2: nothing set, the proxy's https page is refused.
    {
      name: 'refuses the upload through the proxy when no public origin is set',
      publicOrigins: [],
      serverAddress: addressTheProxyPassesOn,
      origin: publicAddressOfTheProxy,
      expectedStatus: 403,
    },
    // The fix: the proxy's address is listed, so its page may upload.
    {
      name: "accepts the upload through the proxy once the proxy's address is set",
      publicOrigins: [publicAddressOfTheProxy],
      serverAddress: addressTheProxyPassesOn,
      origin: publicAddressOfTheProxy,
      expectedStatus: 200,
    },
    // The list adds addresses; it does not open the door to any other site.
    {
      name: 'still refuses a page of another site with the public origin set',
      publicOrigins: [publicAddressOfTheProxy],
      serverAddress: addressTheProxyPassesOn,
      origin: 'https://exemplo-malicioso.com.br',
      expectedStatus: 403,
    },
    // The stream PC opens the server directly; the list must not take that away.
    {
      name: "still accepts the server's own address with the public origin set",
      publicOrigins: [publicAddressOfTheProxy],
      serverAddress: 'http://192.168.2.5:8080',
      origin: 'http://192.168.2.5:8080',
      expectedStatus: 200,
    },
  ];

  it.each(scenarios)('$name', async ({ publicOrigins, serverAddress, origin, expectedStatus }) => {
    // Arrange: the app with the public origins of this row.
    const { app } = createAppWithAMediaFolder(undefined, publicOrigins);

    // Act: upload team 42's logo, reaching the server at this row's address and Origin.
    const response = await uploadFile(app, buildPngLogo(32, 32), 'logo-ufpr.png', 'image/png', {
      serverAddress,
      origin,
    });

    // Assert: the status of this row.
    expect(response.status, 'the status for this address and Origin').toBe(expectedStatus);
  });
});
