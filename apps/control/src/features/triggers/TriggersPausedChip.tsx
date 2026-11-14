import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

const texts = ptBR.triggers.pause;

/**
 * "Gatilhos e eventos automáticos pausados" in the header, with "Retomar" on it, shown only
 * while every trigger is paused (BAJAOVRLAY-48); since BAJAOVRLAY-73 the pause holds the
 * automatic events too, and the words' tooltip says what is held. The words take the
 * keyboard's focus, so the tooltip opens from the keyboard too. The pause itself is an entry of the header's menu since
 * BAJAOVRLAY-62; a pause hidden in a menu is a show risk, so this chip keeps it in sight.
 * It shows the server's `triggerActivity.isPaused`, and "Retomar" only sends
 * setTriggersPaused: the chip goes when the server says so. For Dados, who may not
 * resume them (BAJAOVRLAY-29), "Retomar" is greyed out and the chip says why in its
 * text: a title would show only on hover, which a greyed-out button never gets.
 */
export function TriggersPausedChip() {
  const isPaused = useServerState((state) => state.triggerActivity.isPaused);
  const sendCommand = useSendCommand();
  const whyTheRoleCannotResume = useWhyTheRoleCannotSend('setTriggersPaused');
  if (!isPaused) {
    return null;
  }
  return (
    <Badge variant="warning" className="gap-2 py-0.5 pr-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>{texts.pausedChip}</span>
        </TooltipTrigger>
        <TooltipContent>{texts.pausedChipTooltip}</TooltipContent>
      </Tooltip>
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
      {whyTheRoleCannotResume !== undefined && (
        <span className="pr-2 text-xs font-normal">{whyTheRoleCannotResume}</span>
      )}
    </Badge>
  );
}
