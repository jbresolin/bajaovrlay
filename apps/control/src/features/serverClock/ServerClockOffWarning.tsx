import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * "Relógio do servidor X s fora da hora certa" in the header (BAJAOVRLAY-62), while the
 * server clock is 2 s or more off real time by NTP: the server does not step it while
 * something on air counts time, and slews at 0.5% instead. "Acertar relógio agora", in
 * the header's menu, steps it at once. The number comes with each `time` message.
 */
export function ServerClockOffWarning() {
  const secondsOff = useServerState((state) => state.serverClockSecondsOffRealTime);
  if (secondsOff === null) {
    return null;
  }
  return (
    <Badge variant="warning" role="status">
      {ptBR.serverClock.offRealTimeWarning(secondsOff)}
    </Badge>
  );
}
