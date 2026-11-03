import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

const texts = ptBR.triggers.pause;
const pauseSwitchId = 'triggers-pause';

/**
 * "Pausar gatilhos" in the header (BAJAOVRLAY-48): one switch that pauses every trigger for
 * a rehearsal, with "Gatilhos pausados" beside it while it is on, so a paused show is never
 * forgotten. It shows the server's `triggerActivity.isPaused` and only sends
 * setTriggersPaused: a press changes nothing on the page until the server says so.
 */
export function TriggersPauseSwitch() {
  const isPaused = useServerState((state) => state.triggerActivity.isPaused);
  const sendCommand = useSendCommand();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={pauseSwitchId}
        checked={isPaused}
        onCheckedChange={(isPausedNow) =>
          void sendCommand({ type: 'setTriggersPaused', isPaused: isPausedNow })
        }
        onClick={(click) => click.currentTarget.blur()}
      />
      <Label htmlFor={pauseSwitchId} className="text-xs">
        {texts.switchLabel}
      </Label>
      {isPaused ? <Badge variant="warning">{texts.pausedBadge}</Badge> : null}
    </div>
  );
}
