import type { ServerClockHealth } from '@bajaovrlay/shared';
import { useState } from 'react';

import { ptBR } from '@/i18n/ptBR';
import { formatTimeOfDay } from '@/i18n/timeOfDayText';

import { fetchServerHealth } from './fetchServerHealth';

// What the operator has learned about the server so far. This is a one-off answer to
// a press, not server state, so it lives in the component and not in the store.
type ServerCheckStatus =
  | { kind: 'not-checked' }
  | { kind: 'checking' }
  | { kind: 'online'; version: string; serverClock: ServerClockHealth | undefined }
  | { kind: 'unreachable' };

/** The server check: start it, and the pt-BR sentence saying what the server answered. */
export type ServerHealthCheck = {
  checkServer: () => Promise<void>;
  /** Empty until the first check; then "Verificando…", the version, or why not. */
  statusText: string;
};

/**
 * "Verificar servidor" (an entry of the header's menu since BAJAOVRLAY-62): asks
 * `GET /health` whether the server is up, which version it runs, and what its clock last
 * heard from NTP: the time of the answer, the server, and the difference it found.
 */
export function useServerHealthCheck(): ServerHealthCheck {
  const [status, setStatus] = useState<ServerCheckStatus>({ kind: 'not-checked' });

  async function checkServer(): Promise<void> {
    setStatus({ kind: 'checking' });
    try {
      const health = await fetchServerHealth();
      setStatus({ kind: 'online', version: health.version, serverClock: health.serverClock });
    } catch {
      setStatus({ kind: 'unreachable' });
    }
  }

  return { checkServer, statusText: describeServerCheckStatus(status) };
}

/** Turns the check status into the pt-BR sentence shown beside the menu. */
function describeServerCheckStatus(status: ServerCheckStatus): string {
  switch (status.kind) {
    case 'not-checked':
      return '';
    case 'checking':
      return ptBR.serverHealth.checking;
    case 'online': {
      const versionSentence = ptBR.serverHealth.online(status.version);
      const clockSentence = describeTheServerClock(status.serverClock);
      return clockSentence === '' ? versionSentence : `${versionSentence} ${clockSentence}`;
    }
    case 'unreachable':
      return ptBR.serverHealth.unreachable;
  }
}

/** What "Verificar servidor" says of NTP; nothing for a server from before BAJAOVRLAY-62. */
function describeTheServerClock(serverClock: ServerClockHealth | undefined): string {
  if (serverClock === undefined) {
    return '';
  }
  if (!serverClock.isNtpOn) {
    return ptBR.serverClock.ntpOff;
  }
  if (serverClock.lastNtpAnswer === null) {
    return ptBR.serverClock.ntpNotAnsweredYet;
  }
  const { atMs, serverName, differenceMs } = serverClock.lastNtpAnswer;
  return ptBR.serverClock.lastNtpAnswer(formatTimeOfDay(atMs), serverName, differenceMs);
}
