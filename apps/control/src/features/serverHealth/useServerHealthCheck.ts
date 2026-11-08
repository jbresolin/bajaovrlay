import { useState } from 'react';

import { ptBR } from '@/i18n/ptBR';

import { fetchServerHealth } from './fetchServerHealth';

// What the operator has learned about the server so far. This is a one-off answer to
// a press, not server state, so it lives in the component and not in the store.
type ServerCheckStatus =
  | { kind: 'not-checked' }
  | { kind: 'checking' }
  | { kind: 'online'; version: string }
  | { kind: 'unreachable' };

/** The server check: start it, and the pt-BR sentence saying what the server answered. */
export type ServerHealthCheck = {
  checkServer: () => Promise<void>;
  /** Empty until the first check; then "Verificando…", the version, or why not. */
  statusText: string;
};

/**
 * "Verificar servidor" (an entry of the header's menu since BAJAOVRLAY-62): asks
 * `GET /health` whether the server is up and which version it runs.
 */
export function useServerHealthCheck(): ServerHealthCheck {
  const [status, setStatus] = useState<ServerCheckStatus>({ kind: 'not-checked' });

  async function checkServer(): Promise<void> {
    setStatus({ kind: 'checking' });
    try {
      const health = await fetchServerHealth();
      setStatus({ kind: 'online', version: health.version });
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
    case 'online':
      return ptBR.serverHealth.online(status.version);
    case 'unreachable':
      return ptBR.serverHealth.unreachable;
  }
}
