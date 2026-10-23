// Who may upload until M4 brings logins: the server's own pages, and tools that are not
// browsers. A page of another site open in the operator's browser may not.

/**
 * Whether an upload came from a page of another site: its Origin header names a scheme,
 * host or port other than the address the request reached (the Vite dev proxy keeps the
 * page's Host, so the dev page passes too). No Origin at all is curl or Companion, which
 * no web page can make a browser send for a cross-site POST, so it is let through.
 */
export function isUploadFromAnotherSite(
  originHeader: string | undefined,
  requestUrl: string,
): boolean {
  if (originHeader === undefined) {
    return false;
  }
  const originOfTheServer = new URL(requestUrl).origin;
  return originHeader !== originOfTheServer;
}
