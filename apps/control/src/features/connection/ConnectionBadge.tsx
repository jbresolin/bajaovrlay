import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';
import type { ConnectionStatus } from '@/state/serverStateStore';

// Only the semantic badge colours are used: solid for "all good", muted while the first
// connection is being made, and the destructive colour when a working line was lost.
const badgeVariantForEachStatus = {
  connecting: 'secondary',
  connected: 'default',
  reconnecting: 'destructive',
} as const satisfies Record<ConnectionStatus, string>;

/** Says in the header how the connection to the server is doing, at all times. */
export function ConnectionBadge() {
  const connectionStatus = useServerState((state) => state.connectionStatus);

  return (
    <Badge
      role="status"
      aria-label={ptBR.connection.statusLabel}
      variant={badgeVariantForEachStatus[connectionStatus]}
    >
      {ptBR.connection.status[connectionStatus]}
    </Badge>
  );
}
