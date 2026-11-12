import type { ServerClockSource } from '@bajaovrlay/shared';

/**
 * What the discipline of the server clock reports (serverClockDiscipline.ts), for
 * "Verificar servidor", the header and "Acertar relógio agora" (serverClockControl.ts).
 */

/** The last NTP answer, as "Verificar servidor" shows it. */
export type LastNtpAnswer = {
  serverName: string;
  /** Real time when the answer arrived, in whole ms since 1970. */
  atMs: number;
  /** Real time minus the server clock at that moment, in whole ms. */
  differenceMs: number;
  roundTripMs: number;
};

/**
 * What the discipline reports: the last NTP answer, what is left to cover, the rate in
 * use, and which source the clock follows.
 */
export type ServerClockStatus = {
  /** Undefined until NTP has answered once. */
  lastNtpAnswer: LastNtpAnswer | undefined;
  /**
   * Real time minus the server clock now, as far as NTP or HTTPS said: the slew still to
   * cover, or a difference over 24 h not taken, in whole ms; positive when the server
   * clock is behind. Undefined until either answered. The header warns from 2 s on.
   */
  offFromRealTimeMs: number | undefined;
  rate: number;
  /** NTP, HTTPS (NTP quiet for 64 s), or none; with the last answer (BAJAOVRLAY-76). */
  source: ServerClockSource;
  /** Neither NTP nor HTTPS has answered for a full poll interval (the header's chip). */
  isWithoutSync: boolean;
};

/** What "Acertar relógio agora" did: stepped by how much, or why it could not. */
export type SetToRealTimeOutcome =
  | { isSet: true; steppedByMs: number }
  | { isSet: false; reason: 'noAnswer'; problems: string[] }
  | { isSet: false; reason: 'ntpOff' };
