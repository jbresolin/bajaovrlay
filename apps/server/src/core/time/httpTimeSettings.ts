/** The HTTPS fallback on, with its servers in order; or off (BAJAOVRLAY-76). */
export type HttpTimeSettings =
  { isHttpTimeOn: true; serverAddresses: string[] } | { isHttpTimeOn: false };

/** Why BAJAOVRLAY_HTTP_TIME_SERVERS cannot be used: an entry, or a list of one. */
export type HttpTimeSettingsProblem =
  { kind: 'badEntry'; badEntry: string } | { kind: 'fewerThanTwoServers' };

/** What reading BAJAOVRLAY_HTTP_TIME_SERVERS gave: the settings, or what is wrong. */
export type HttpTimeSettingsParsing =
  | { isValid: true; httpTimeSettings: HttpTimeSettings }
  | { isValid: false; problem: HttpTimeSettingsProblem };

/**
 * Asked when the variable is unset: three big sites whose servers keep good time and
 * answer HEAD from anywhere with web access. NTP.br's web server is close to the track.
 */
const defaultServerAddresses = [
  'https://www.cloudflare.com',
  'https://www.ntp.br',
  'https://www.google.com',
];

/**
 * Reads BAJAOVRLAY_HTTP_TIME_SERVERS: unset or empty is the default list, "off" turns the
 * fallback off, anything else is a comma-separated list of http:// or https:// addresses.
 * At least two: an answer is only kept when two servers agree (httpDateClient.ts).
 */
export function parseHttpTimeSettings(text: string | undefined): HttpTimeSettingsParsing {
  const trimmedText = (text ?? '').trim();
  if (trimmedText === 'off') {
    return { isValid: true, httpTimeSettings: { isHttpTimeOn: false } };
  }
  const entries =
    trimmedText === ''
      ? defaultServerAddresses
      : trimmedText.split(',').map((entry) => entry.trim());
  for (const entry of entries) {
    if (!isAWebAddress(entry)) {
      return { isValid: false, problem: { kind: 'badEntry', badEntry: entry } };
    }
  }
  if (entries.length < 2) {
    return { isValid: false, problem: { kind: 'fewerThanTwoServers' } };
  }
  return { isValid: true, httpTimeSettings: { isHttpTimeOn: true, serverAddresses: entries } };
}

/** Whether a text is an http:// or https:// address with a host. */
function isAWebAddress(text: string): boolean {
  if (!URL.canParse(text)) {
    return false;
  }
  const address = new URL(text);
  const isWebScheme = address.protocol === 'https:' || address.protocol === 'http:';
  return isWebScheme && address.hostname !== '';
}
