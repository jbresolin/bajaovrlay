import type { ServerClockHealth, ServerClockSource } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { type HttpDatePollOutcome, pollHttpDateServers } from './httpDateClient.js';
import { openConnectionsForHeadRequests } from './httpHeadRequest.js';
import type { HttpTimeSettings } from './httpTimeSettings.js';
import { pollNtpServers } from './ntpPolls.js';
import type { NtpSettings } from './ntpSettings.js';
import type { ServerClock } from './serverClock.js';
import { type ServerClockDiscipline, startServerClockDiscipline } from './serverClockDiscipline.js';
import type { SetToRealTimeOutcome } from './serverClockStatus.js';

/** What the rest of the server sees of the server clock's NTP: reports, and one action. */
export type ServerClockControl = {
  /** For GET /health ("Verificar servidor"). */
  readServerClockHealth: () => ServerClockHealth;
  /** For the `time` message (the header's warning); undefined when NTP is off or silent. */
  readOffFromRealTimeMs: () => number | undefined;
  /** For the `time` message (the header's menu): what the clock follows (BAJAOVRLAY-76). */
  readServerClockSource: () => ServerClockSource;
  /**
   * For the `time` message (the header's "Relógio sem sincronização"): neither NTP nor
   * HTTPS has answered for a full poll interval. False with NTP off: that is chosen.
   */
  readIsServerClockWithoutSync: () => boolean;
  /** "Acertar relógio agora"; with NTP off it answers so, without asking anyone. */
  setToRealTimeNow: (actor: string) => Promise<SetToRealTimeOutcome>;
  /** The boot's step to real time (waits up to 3 s); nothing with NTP off. */
  stepToRealTimeAtBoot: () => Promise<void>;
  /** Stops the polls; nothing with NTP off. */
  stop: () => void;
};

/** The control with NTP off: the clock runs on the wall clock as read at boot. */
export const serverClockWithNtpOff: ServerClockControl = {
  readServerClockHealth: () => ({ isNtpOn: false }),
  readOffFromRealTimeMs: () => undefined,
  readServerClockSource: () => ({ following: 'none', lastAnswer: null }),
  readIsServerClockWithoutSync: () => false,
  setToRealTimeNow: () => Promise.resolve({ isSet: false, reason: 'ntpOff' }),
  stepToRealTimeAtBoot: () => Promise.resolve(),
  stop: () => {},
};

/**
 * One poll of the HTTPS servers' Date headers on the server clock's monotonic time, on
 * connections of its own, all closed when it ends, however it ends (BAJAOVRLAY-76).
 */
async function pollTheHttpsServersOnce(
  serverAddresses: readonly string[],
  serverClock: ServerClock,
  abortSignal: AbortSignal,
): Promise<HttpDatePollOutcome> {
  const connections = openConnectionsForHeadRequests();
  try {
    return await pollHttpDateServers({
      serverAddresses,
      readLocalTimeMs: serverClock.readMonotonicTimeMs,
      sendHeadRequest: connections.sendHeadRequest,
      abortSignal,
    });
  } finally {
    connections.closeEveryConnection();
  }
}

/**
 * Starts the discipline of the server clock on the NTP servers of the settings, with the
 * HTTPS servers as its fallback unless `httpTimeSettings` is off, or gives the control
 * with NTP off (the fallback then off too: it stands in for NTP, never alone).
 * `isAnythingCountingTimeOnAir` is asked about each step of a confirmed big difference,
 * never at boot (the boot always steps); `afterEachStep` runs after every step, the boot's
 * included.
 */
export function startTheServerClockOnNtp(options: {
  ntpSettings: NtpSettings;
  httpTimeSettings: HttpTimeSettings;
  serverClock: ServerClock;
  isAnythingCountingTimeOnAir: (stepByMs: number) => boolean;
  afterEachStep: () => void;
  logger: ServerLogger;
}): ServerClockControl {
  const { ntpSettings, serverClock } = options;
  if (!ntpSettings.isNtpOn) {
    options.logger.info(
      'NTP is off (BAJAOVRLAY_NTP_SERVERS=off): the server clock runs on the wall clock read at boot',
    );
    return serverClockWithNtpOff;
  }
  const { httpTimeSettings } = options;
  const discipline: ServerClockDiscipline = startServerClockDiscipline({
    serverClock,
    pollForRealTime: (request, abortSignal) =>
      pollNtpServers({
        servers: ntpSettings.servers,
        readLocalTimeMs: serverClock.readMonotonicTimeMs,
        questionsPerServer: request.questionsPerServer,
        serverToAskLast: request.serverToAskLast,
        abortSignal,
      }),
    isAnythingCountingTimeOnAir: options.isAnythingCountingTimeOnAir,
    afterEachStep: options.afterEachStep,
    pollHttpDateServers: httpTimeSettings.isHttpTimeOn
      ? (abortSignal) =>
          pollTheHttpsServersOnce(httpTimeSettings.serverAddresses, serverClock, abortSignal)
      : undefined,
    logger: options.logger,
  });
  return {
    readServerClockHealth: () => {
      const status = discipline.readStatus();
      return {
        isNtpOn: true,
        lastNtpAnswer: status.lastNtpAnswer ?? null,
        offFromRealTimeMs: status.offFromRealTimeMs ?? null,
        source: status.source,
      };
    },
    readOffFromRealTimeMs: () => discipline.readStatus().offFromRealTimeMs,
    readServerClockSource: () => discipline.readStatus().source,
    readIsServerClockWithoutSync: () => discipline.readStatus().isWithoutSync,
    setToRealTimeNow: discipline.setToRealTimeNow,
    stepToRealTimeAtBoot: discipline.stepToRealTimeAtBoot,
    stop: discipline.stop,
  };
}
