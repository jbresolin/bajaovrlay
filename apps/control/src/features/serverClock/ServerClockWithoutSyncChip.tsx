import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * "Relógio sem sincronização" in the header, amber, beside the clock warning
 * (BAJAOVRLAY-76's addition): neither NTP nor HTTPS has answered the server for a full
 * poll interval, so every clock on air counts on the computer's own time. The server
 * decides and says so in each `time` message; the chip goes with the first good answer.
 * Reachable with the Tab key, so its tooltip opens from the keyboard too.
 */
export function ServerClockWithoutSyncChip() {
  const isWithoutSync = useServerState((state) => state.isServerClockWithoutSync);
  if (!isWithoutSync) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="warning" role="status" tabIndex={0}>
          {ptBR.serverClock.withoutSyncChip}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{ptBR.serverClock.withoutSyncTooltip}</TooltipContent>
    </Tooltip>
  );
}
