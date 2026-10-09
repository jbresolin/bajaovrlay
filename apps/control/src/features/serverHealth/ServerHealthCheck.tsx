import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';

import { fetchServerHealth } from './fetchServerHealth';

// What the operator has learned about the server so far. This is a one-off answer to
// a button press, not server state, so it lives in the component and not in the store.
type ServerCheckStatus =
  | { kind: 'not-checked' }
  | { kind: 'checking' }
  | { kind: 'online'; version: string }
  | { kind: 'unreachable' };

/** Button that asks the server whether it is up, and a line saying what it answered. */
export function ServerHealthCheck() {
  const [status, setStatus] = useState<ServerCheckStatus>({ kind: 'not-checked' });

  async function checkServer() {
    setStatus({ kind: 'checking' });
    try {
      const health = await fetchServerHealth();
      setStatus({ kind: 'online', version: health.version });
    } catch {
      setStatus({ kind: 'unreachable' });
    }
  }

  return (
    <section className="flex flex-col items-start gap-3">
      <Button onClick={checkServer} disabled={status.kind === 'checking'}>
        {ptBR.serverHealth.checkButton}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {describeServerCheckStatus(status)}
      </p>
    </section>
  );
}

/** Turns the check status into the pt-BR sentence shown under the button. */
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
