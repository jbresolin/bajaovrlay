// Who may upload until M4 brings logins: the server's own pages, the pages of a reverse
// proxy listed in BAJAOVRLAY_PUBLIC_ORIGINS, and tools that are not browsers. A page of
// another site open in the operator's browser may not.

/**
 * Whether an upload came from a page of another site: its Origin header names a scheme,
 * host or port other than the address the request reached (the Vite dev proxy keeps the
 * page's Host, so the dev page passes too) and other than every public origin listed. No
 * Origin at all is curl or Companion, which no web page can make a browser send for a
 * cross-site POST, so it is let through.
 */
export function isUploadFromAnotherSite(
  originHeader: string | undefined,
  requestUrl: string,
  publicOrigins: readonly string[],
): boolean {
  if (originHeader === undefined) {
    return false;
  }
  const originOfTheServer = new URL(requestUrl).origin;
  if (originHeader === originOfTheServer) {
    return false;
  }
  // Behind a proxy that ends HTTPS, the request reaches http://<host> while the page is
  // https://<host>; the listed addresses are the proxy's, so they count as the server's own.
  const isAPublicOriginOfTheServer = publicOrigins.includes(originHeader);
  return !isAPublicOriginOfTheServer;
}
