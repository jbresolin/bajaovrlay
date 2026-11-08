import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

const texts = ptBR.triggers.pause;
const pauseSwitchId = 'triggers-pause';

/**
 * "Pausar gatilhos" in the header (BAJAOVRLAY-48): one switch that pauses every trigger for
 * a rehearsal, with "Gatilhos pausados" beside it while it is on, so a paused show is never
 * forgotten. It shows the server's `triggerActivity.isPaused` and only sends
 * setTriggersPaused: a press changes nothing on the page until the server says so.
 * For a role that may not pause them (Dados, BAJAOVRLAY-29) the switch is off, and its
 * title says why.
 */
export function TriggersPauseSwitch() {
  const isPaused = useServerState((state) => state.triggerActivity.isPaused);
  const sendCommand = useSendCommand();
  const whyTheRoleCannotPause = useWhyTheRoleCannotSend('setTriggersPaused');
  return (
    <div className="flex items-center gap-2" title={whyTheRoleCannotPause}>
      <Switch
        id={pauseSwitchId}
        checked={isPaused}
        disabled={whyTheRoleCannotPause !== undefined}
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
