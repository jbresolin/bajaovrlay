// BAJAOVRLAY_PUBLIC_ORIGINS: the public addresses of a reverse proxy in front of the
// server (Nginx Proxy Manager on TrueNAS), whose pages may upload images as well as the
// server's own address. Read once at boot (core/env/readServerEnvironment.ts).

/** The name of the variable, as .env.example and the boot error write it. */
export const publicOriginsVariableName = 'BAJAOVRLAY_PUBLIC_ORIGINS';

/** The parsed list, or the first entry that is not an http or https origin, as written. */
export type PublicOriginsParsing =
  { isValid: true; publicOrigins: string[] } | { isValid: false; badEntry: string };

/**
 * Parses the variable's text: entries split on commas and trimmed, empty ones skipped.
 * Each entry must be an http or https address with nothing after the host and port; it
 * is kept as the browser writes an Origin header (lower case, no default port, no slash),
 * so it compares with a request's Origin as plain text.
 */
export function parsePublicOrigins(text: string | undefined): PublicOriginsParsing {
  const entries = (text ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

  const publicOrigins: string[] = [];
  for (const entry of entries) {
    const origin = readOriginOfEntry(entry);
    if (origin === undefined) {
      return { isValid: false, badEntry: entry };
    }
    publicOrigins.push(origin);
  }
  return { isValid: true, publicOrigins };
}

/** The origin an entry names, or undefined when it is not just an http(s) scheme, host and port. */
function readOriginOfEntry(entry: string): string | undefined {
  if (!URL.canParse(entry)) {
    return undefined;
  }
  const address = new URL(entry);
  const isWebAddress = address.protocol === 'http:' || address.protocol === 'https:';
  // An Origin header never carries a path, a query or a user; an entry with one would
  // never match, so it is refused at boot rather than ignored at every upload.
  const hasNothingAfterThePort =
    address.pathname === '/' &&
    address.search === '' &&
    address.hash === '' &&
    address.username === '' &&
    address.password === '';
  if (!isWebAddress || !hasNothingAfterThePort) {
    return undefined;
  }
  return address.origin;
}
