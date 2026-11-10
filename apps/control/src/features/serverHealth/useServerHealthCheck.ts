import type { ServerClockHealth } from '@bajaovrlay/shared';
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { useState } from 'react';

import { ptBR } from '@/i18n/ptBR';
import { formatTimeOfDay } from '@/i18n/timeOfDayText';
import { useServerState } from '@/state/ControlPageStateProvider';

import { describeTheDataSourcesThatAreOn } from './dataSourcesSentence';
import { fetchServerHealth } from './fetchServerHealth';

// What the operator has learned about the server so far. This is a one-off answer to
// a press, not server state, so it lives in the component and not in the store.
type ServerCheckStatus =
  | { kind: 'not-checked' }
  | { kind: 'checking' }
  | {
      kind: 'online';
      version: string;
      serverClock: ServerClockHealth | undefined;
      dataSourcesSentence: string;
    }
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
 * heard from NTP: the time of the answer, the server, and the difference it found. Then
 * the data sources that are on, late or in error by name (BAJAOVRLAY-32), as the page
 * knew them when the server answered: a late feed is the other usual "is it the server?".
 */
export function useServerHealthCheck(): ServerHealthCheck {
  const [status, setStatus] = useState<ServerCheckStatus>({ kind: 'not-checked' });
  const dataSources = useServerState((state) => state.dataSources);

  async function checkServer(): Promise<void> {
    setStatus({ kind: 'checking' });
    try {
      const health = await fetchServerHealth();
      setStatus({
        kind: 'online',
        version: health.version,
        serverClock: health.serverClock,
        dataSourcesSentence: describeTheDataSourcesThatAreOn(
          dataSources,
          readServerAlignedTimeMs(),
        ),
      });
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
      const sentences = [
        ptBR.serverHealth.online(status.version),
        describeTheServerClock(status.serverClock),
        status.dataSourcesSentence,
      ];
      return sentences.filter((sentence) => sentence !== '').join(' ');
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
