import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

/**
 * The button every command uses. While the page is connected it is a plain Button.
 * While it is not, the button is disabled and a tooltip says why, so the operator never
 * presses something that silently does nothing. `disabledReason`, when given, turns it
 * off the same way with that reason (a take of an item filled by an event, BAJAOVRLAY-44).
 */
export function ActionButton(
  props: ComponentProps<typeof Button> & { disabledReason?: string | undefined },
) {
  const { disabledReason, ...buttonProps } = props;
  const isConnected = useIsConnectedToServer();
  const reasonForBeingOff = isConnected ? disabledReason : ptBR.connection.actionsDisabledReason;
  if (reasonForBeingOff === undefined) {
    return <Button {...buttonProps} />;
  }

  // A disabled button receives neither hover nor focus, so it could never show its own
  // tooltip. The focusable <span> around it is what the mouse and the Tab key reach.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md">
          <Button {...buttonProps} disabled />
        </span>
      </TooltipTrigger>
      <TooltipContent>{reasonForBeingOff}</TooltipContent>
    </Tooltip>
  );
}
