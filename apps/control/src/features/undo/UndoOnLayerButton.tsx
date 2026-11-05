import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

/**
 * "Desfazer" on a Camadas row (BAJAOVRLAY-30), with a tooltip saying what comes back
 * ("Volta: "Tarja – Ana Souza""), so the operator knows before pressing. While the page is
 * not connected it is the usual ActionButton, off, whose own tooltip says why.
 */
export function UndoOnLayerButton(props: { whatComesBack: string; onPressed: () => void }) {
  const isConnected = useIsConnectedToServer();
  if (!isConnected) {
    return (
      <ActionButton variant="outline" size="sm">
        {ptBR.undo.undoOnLayerButton}
      </ActionButton>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" onClick={props.onPressed}>
          {ptBR.undo.undoOnLayerButton}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{props.whatComesBack}</TooltipContent>
    </Tooltip>
  );
}
