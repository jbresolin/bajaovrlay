// BAJAOVRLAY_SOURCE_ALLOWED_HOSTS: the hosts a flex source may send a request to. Read once
// at boot (core/env/readServerEnvironment.ts) and handed to every place that builds a
// request or checks a config, so the rule is the same for a poll, a sample and a save.
import type { HttpJsonRequest } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../../../core/logger/createLogger.js';

/** The name of the variable, as .env.example and the pt-BR errors write it. */
export const sourceAllowedHostsVariableName = 'BAJAOVRLAY_SOURCE_ALLOWED_HOSTS';

/** One entry of the list: a host in lower case, and its port, or undefined for any port. */
export type AllowedSourceHost = { hostName: string; port: string | undefined };

/**
 * The list as the server holds it. Not set: any host is allowed, and no
 * BAJAOVRLAY_SOURCE_ variable's value is ever sent (see httpJsonRequestAddress.ts).
 */
export type SourceHostAllowlist =
  { isSet: false } | { isSet: true; allowedHosts: AllowedSourceHost[] };

/** The list when the variable is not set; the default wherever the list is optional. */
export const noSourceHostAllowlist: SourceHostAllowlist = { isSet: false };

/** The parsed list, or the first entry that is not a host or host:port, as written. */
export type SourceHostAllowlistParsing =
  { isValid: true; allowlist: SourceHostAllowlist } | { isValid: false; badEntry: string };

// A host name or IPv4 address: letters, digits, dots and hyphens. No scheme, path or "@".
const hostNamePattern = /^[A-Za-z0-9.-]+$/;
// An IPv6 address, in brackets as an address writes it: "[::1]".
const bracketedIpv6Pattern = /^\[[0-9A-Fa-f:.]+\]$/;
// One to five digits; the range is checked as a number.
const portPattern = /^[0-9]{1,5}$/;
const largestPort = 65_535;

/**
 * Parses the variable's text: entries split on commas and trimmed, empty ones skipped.
 * Unset, or set to nothing, means no list. An entry is "host" (any port) or "host:port"
 * (that port only); an IPv6 host goes in brackets. Each host is read the way an address
 * reads it (lower case, "[fe80::7]" written short), so it compares with a request's host
 * as plain text.
 */
export function parseSourceHostAllowlist(text: string | undefined): SourceHostAllowlistParsing {
  const entries = (text ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  if (entries.length === 0) {
    return { isValid: true, allowlist: noSourceHostAllowlist };
  }

  const allowedHosts: AllowedSourceHost[] = [];
  for (const entry of entries) {
    const allowedHost = parseOneEntry(entry);
    if (allowedHost === undefined) {
      return { isValid: false, badEntry: entry };
    }
    allowedHosts.push(allowedHost);
  }
  return { isValid: true, allowlist: { isSet: true, allowedHosts } };
}

/**
 * Tells whether a request to this address may be sent. Not set: always. Set: when an
 * entry has the address's host and either no port or the address's port, which is 80
 * for http and 443 for https when the address writes none.
 */
export function isHostOfAddressAllowed(address: URL, allowlist: SourceHostAllowlist): boolean {
  if (!allowlist.isSet) {
    return true;
  }
  const hostName = address.hostname.toLowerCase();
  const port = readPortOfAddress(address);
  return allowlist.allowedHosts.some((allowedHost) => {
    const isSameHost = allowedHost.hostName === hostName;
    const isAnyPortOrTheSamePort = allowedHost.port === undefined || allowedHost.port === port;
    return isSameHost && isAnyPortOrTheSamePort;
  });
}

/**
 * The first request of a config (in its order) whose host the list does not allow, with
 * its host as the address writes it (with a port that is not the default), or undefined.
 * The config schema has already checked every url, so each one parses.
 */
export function findFirstRequestToAHostNotAllowed(
  requests: HttpJsonRequest[],
  allowlist: SourceHostAllowlist,
): { requestId: string; host: string } | undefined {
  for (const request of requests) {
    const address = new URL(request.url);
    if (!isHostOfAddressAllowed(address, allowlist)) {
      return { requestId: request.requestId, host: address.host };
    }
  }
  return undefined;
}

/**
 * Logs the boot warning when no list is set: any host may be fetched, so no variable's
 * value is sent, and a flex source that names one fails every poll until the list is set.
 */
export function warnWhenNoSourceHostAllowlistIsSet(
  allowlist: SourceHostAllowlist,
  logger: ServerLogger,
): void {
  if (allowlist.isSet) {
    return;
  }
  logger.warn(
    { variable: sourceAllowedHostsVariableName },
    `${sourceAllowedHostsVariableName} is not set: flex sources may fetch any host, and no BAJAOVRLAY_SOURCE_ variable value will be sent`,
  );
}

/** Reads one entry, or undefined when it is not a host or host:port. */
function parseOneEntry(entry: string): AllowedSourceHost | undefined {
  const hostAndPort = splitHostAndPort(entry);
  if (hostAndPort === undefined) {
    return undefined;
  }
  const { hostPart, portPart } = hostAndPort;

  const isHostWritten = hostNamePattern.test(hostPart) || bracketedIpv6Pattern.test(hostPart);
  if (!isHostWritten) {
    return undefined;
  }
  const hostName = readHostNameAsAnAddressWould(hostPart);
  if (hostName === undefined) {
    return undefined;
  }

  if (portPart === undefined) {
    return { hostName, port: undefined };
  }
  if (!portPattern.test(portPart)) {
    return undefined;
  }
  const portNumber = Number(portPart);
  if (portNumber < 1 || portNumber > largestPort) {
    return undefined;
  }
  return { hostName, port: String(portNumber) };
}

/**
 * Splits "host:port" at its colon. A bracketed IPv6 host keeps its own colons; any other
 * entry with more than one colon is refused, since a bare IPv6 cannot be told from host:port.
 */
function splitHostAndPort(
  entry: string,
): { hostPart: string; portPart: string | undefined } | undefined {
  if (entry.startsWith('[')) {
    const closingBracketIndex = entry.indexOf(']');
    if (closingBracketIndex === -1) {
      return undefined;
    }
    const hostPart = entry.slice(0, closingBracketIndex + 1);
    const afterTheHost = entry.slice(closingBracketIndex + 1);
    if (afterTheHost === '') {
      return { hostPart, portPart: undefined };
    }
    if (!afterTheHost.startsWith(':')) {
      return undefined;
    }
    return { hostPart, portPart: afterTheHost.slice(1) };
  }

  const pieces = entry.split(':');
  if (pieces.length === 1) {
    return { hostPart: entry, portPart: undefined };
  }
  if (pieces.length === 2) {
    return { hostPart: pieces[0] ?? '', portPart: pieces[1] ?? '' };
  }
  return undefined;
}

/**
 * The host as a request's address reads it ("127.1" as "127.0.0.1", capitals lowered,
 * IPv6 written short), or undefined when an address cannot be made of it.
 */
function readHostNameAsAnAddressWould(hostPart: string): string | undefined {
  try {
    return new URL(`http://${hostPart}/`).hostname;
  } catch {
    return undefined;
  }
}

/** The port a request to this address goes to: the written one, or the default of its scheme. */
function readPortOfAddress(address: URL): string {
  if (address.port !== '') {
    return address.port;
  }
  return address.protocol === 'https:' ? '443' : '80';
}
