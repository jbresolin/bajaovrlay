import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

const texts = ptBR.triggers.pause;

/**
 * "Gatilhos pausados" in the header, with "Retomar" on it, shown only while every trigger
 * is paused (BAJAOVRLAY-48). The pause itself is an entry of the header's menu since
 * BAJAOVRLAY-62; a pause hidden in a menu is a show risk, so this chip keeps it in sight.
 * It shows the server's `triggerActivity.isPaused`, and "Retomar" only sends
 * setTriggersPaused: the chip goes when the server says so. For Dados, who may not
 * resume them (BAJAOVRLAY-29), "Retomar" is greyed out and the chip's title says why.
 */
export function TriggersPausedChip() {
  const isPaused = useServerState((state) => state.triggerActivity.isPaused);
  const sendCommand = useSendCommand();
  const whyTheRoleCannotResume = useWhyTheRoleCannotSend('setTriggersPaused');
  if (!isPaused) {
    return null;
  }
  return (
    <Badge variant="warning" className="gap-2 py-0.5 pr-0.5" title={whyTheRoleCannotResume}>
      <span>{texts.pausedChip}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={whyTheRoleCannotResume !== undefined}
        onClick={() => void sendCommand({ type: 'setTriggersPaused', isPaused: false })}
      >
        {texts.resumeButton}
      </Button>
    </Badge>
  );
}
