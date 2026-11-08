import type { Command } from '@bajaovrlay/shared';
import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

/**
 * The button every command uses. While the page is connected it is a plain Button.
 * While it is not, the button is disabled and a tooltip says why, so the operator never
 * presses something that silently does nothing. `commandType`, the command it sends, greys
 * it out the same way for a role that may not send it ("O papel Dados não pode …",
 * BAJAOVRLAY-29): greyed out, never hidden, so both roles see the same layout.
 * `disabledReason`, when given, turns it off the same way with that reason (a take of an
 * item filled by an event, BAJAOVRLAY-44). The connection's reason wins, then the role's.
 */
export function ActionButton(
  props: ComponentProps<typeof Button> & {
    disabledReason?: string | undefined;
    commandType?: Command['type'] | undefined;
  },
) {
  const { disabledReason, commandType, ...buttonProps } = props;
  const isConnected = useIsConnectedToServer();
  const whyTheRoleCannotSend = useWhyTheRoleCannotSend(commandType);
  const reasonWhileConnected = whyTheRoleCannotSend ?? disabledReason;
  const reasonForBeingOff = isConnected
    ? reasonWhileConnected
    : ptBR.connection.actionsDisabledReason;
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
