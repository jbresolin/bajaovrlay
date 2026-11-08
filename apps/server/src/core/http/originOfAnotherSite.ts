// The one rule for the doors that let in only the server's own pages: an image upload
// (modules/media/uploadOrigin.ts) and the WebSocket (core/ws, gate 2 of PR #51).

/**
 * Whether the page that made a request is another site's: its Origin header names a
 * scheme, host or port other than the address the request reached and other than every
 * public origin listed (BAJAOVRLAY_PUBLIC_ORIGINS). No Origin is a tool (curl, Companion,
 * OBS's connection), not a page, and is let through. `originOfTheServer` undefined (a
 * request with no Host) matches nothing, so only a listed origin passes.
 */
export function isOriginOfAnotherSite(
  originHeader: string | undefined,
  originOfTheServer: string | undefined,
  publicOrigins: readonly string[],
): boolean {
  if (originHeader === undefined) {
    return false;
  }
  if (originHeader === originOfTheServer) {
    return false;
  }
  // Behind a proxy that ends HTTPS, the request reaches http://<host> while the page is
  // https://<host>; the listed addresses are the proxy's, so they count as the server's own.
  const isAPublicOriginOfTheServer = publicOrigins.includes(originHeader);
  return !isAPublicOriginOfTheServer;
}
