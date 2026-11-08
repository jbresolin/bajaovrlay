import type { ServerClockHealth } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { pollNtpServers } from './ntpPolls.js';
import type { NtpSettings } from './ntpSettings.js';
import type { ServerClock } from './serverClock.js';
import {
  type ServerClockDiscipline,
  type SetToRealTimeOutcome,
  startServerClockDiscipline,
} from './serverClockDiscipline.js';

/** What the rest of the server sees of the server clock's NTP: reports, and one action. */
export type ServerClockControl = {
  /** For GET /health ("Verificar servidor"). */
  readServerClockHealth: () => ServerClockHealth;
  /** For the `time` message (the header's warning); undefined when NTP is off or silent. */
  readOffFromRealTimeMs: () => number | undefined;
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
  setToRealTimeNow: () => Promise.resolve({ isSet: false, reason: 'ntpOff' }),
  stepToRealTimeAtBoot: () => Promise.resolve(),
  stop: () => {},
};

/**
 * Starts the discipline of the server clock on the NTP servers of the settings, or gives
 * the control with NTP off. `isAnythingCountingTimeOnAir` is read at each confirmed big
 * difference, never at boot (the boot always steps).
 */
export function startTheServerClockOnNtp(options: {
  ntpSettings: NtpSettings;
  serverClock: ServerClock;
  isAnythingCountingTimeOnAir: () => boolean;
  logger: ServerLogger;
}): ServerClockControl {
  const { ntpSettings, serverClock } = options;
  if (!ntpSettings.isNtpOn) {
    options.logger.info(
      'NTP is off (BAJAOVRLAY_NTP_SERVERS=off): the server clock runs on the wall clock read at boot',
    );
    return serverClockWithNtpOff;
  }
  const discipline: ServerClockDiscipline = startServerClockDiscipline({
    serverClock,
    pollForRealTime: () =>
      pollNtpServers({
        servers: ntpSettings.servers,
        readLocalTimeMs: serverClock.readMonotonicTimeMs,
      }),
    isAnythingCountingTimeOnAir: options.isAnythingCountingTimeOnAir,
    logger: options.logger,
  });
  return {
    readServerClockHealth: () => {
      const status = discipline.readStatus();
      return {
        isNtpOn: true,
        lastNtpAnswer: status.lastNtpAnswer ?? null,
        offFromRealTimeMs: status.offFromRealTimeMs ?? null,
      };
    },
    readOffFromRealTimeMs: () => discipline.readStatus().offFromRealTimeMs,
    setToRealTimeNow: discipline.setToRealTimeNow,
    stepToRealTimeAtBoot: discipline.stepToRealTimeAtBoot,
    stop: discipline.stop,
  };
}
