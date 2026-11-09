import type { NtpServerAddress } from './ntpClient.js';

/** NTP on, with its servers in the order they are asked; or off. */
export type NtpSettings = { isNtpOn: true; servers: NtpServerAddress[] } | { isNtpOn: false };

/** What reading BAJAOVRLAY_NTP_SERVERS gave: the settings, or the entry that is wrong. */
export type NtpSettingsParsing =
  { isValid: true; ntpSettings: NtpSettings } | { isValid: false; badEntry: string };

/** NTP's own port. */
const ntpPort = 123;

/**
 * Asked when the variable is unset: NTP.br's stratum-1 servers in São Paulo, close to the
 * track and to the Baja app's VPS, then the worldwide pool.
 */
const defaultNtpServerNames = ['a.st1.ntp.br', 'b.st1.ntp.br', 'pool.ntp.org'];

// A host name or IPv4 address, then an optional :port. No scheme, no path.
const serverEntryPattern = /^([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/;

/**
 * Reads BAJAOVRLAY_NTP_SERVERS: unset or empty is the default list, "off" turns NTP off,
 * anything else is a comma-separated list of `host` or `host:port`. The first entry that
 * is neither is named, so the boot can stop on it.
 */
export function parseNtpSettings(text: string | undefined): NtpSettingsParsing {
  const trimmedText = (text ?? '').trim();
  if (trimmedText === 'off') {
    return { isValid: true, ntpSettings: { isNtpOn: false } };
  }
  const entries =
    trimmedText === ''
      ? defaultNtpServerNames
      : trimmedText.split(',').map((entry) => entry.trim());
  const servers: NtpServerAddress[] = [];
  for (const entry of entries) {
    const entryMatch = serverEntryPattern.exec(entry);
    const host = entryMatch?.[1];
    const portText = entryMatch?.[2];
    const port = portText === undefined ? ntpPort : Number(portText);
    if (host === undefined || port < 1 || port > 65_535) {
      return { isValid: false, badEntry: entry };
    }
    servers.push({ host, port });
  }
  return { isValid: true, ntpSettings: { isNtpOn: true, servers } };
}
