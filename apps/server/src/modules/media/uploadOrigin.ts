// Who may upload, beside the session the PINs ask for (BAJAOVRLAY-29): the server's own pages, the pages of a reverse
// proxy listed in BAJAOVRLAY_PUBLIC_ORIGINS, and tools that are not browsers. A page of
// another site open in the operator's browser may not. The rule is the WebSocket's too
// (core/http/originOfAnotherSite.ts).
import { isOriginOfAnotherSite } from '../../core/http/originOfAnotherSite.js';

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
  const originOfTheServer = new URL(requestUrl).origin;
  return isOriginOfAnotherSite(originHeader, originOfTheServer, publicOrigins);
}
