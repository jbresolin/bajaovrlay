import type { Item } from '@bajaovrlay/shared';
import { cn } from 'cn';
import { type ReactNode, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ItemSourceMarker } from '@/features/bindings/ItemSourceMarker';
import { ItemEntityMarker } from '@/features/entityLibrary/ItemEntityMarker';
import { findWhyTheTakeOfItemIsOff } from '@/features/events/itemTakenThroughAnEvent';
import { buttonClassForEachItemColor } from '@/features/items/itemColorButton';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

/** What one button needs: its item, the names and key to show, and what each action does. */
export type QuickFireItemButtonProps = {
  item: Item;
  graphicName: string;
  /** The digit that fires it from the keyboard ('1' to '9'), or null past the ninth button. */
  digitKey: string | null;
  onTakePressed: () => void;
  onPreviewChosen: () => void;
  onEditChosen: () => void;
  onMoveToRundownChosen: () => void;
};

const texts = ptBR.quickFire;

/**
 * One quick-fire button: painted in the item's colour, its label large and its graphic's
 * name small, with the digit that fires it in the corner. A click puts the item on air;
 * right-click, or the small "⋯" beside it, opens "Prévia", "Editar" and "Mover para
 * rundown". Like a rundown row it is off while the page is disconnected. A button of an
 * item filled by an event (the notices of "Avisos") is off too, a tooltip saying why, its
 * "Prévia" kept (gate 2 of PR #22).
 *
 * Two focus rules keep Space and Enter safe in the middle of a show. After a click the
 * button lets go of the focus, as the rundown's "Disparar" does, so a later Enter cannot
 * fire it again. And when the menu closes the focus is NOT handed back to "⋯" (Radix's
 * habit): a Space pressed on a focused "⋯" opens its menu instead of taking the next
 * rundown item, the same exception as the rundown's "Mover" handle.
 */
export function QuickFireItemButton(props: QuickFireItemButtonProps) {
  const { item, graphicName, digitKey } = props;
  const isConnected = useIsConnectedToServer();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // A role that may not take (Dados, BAJAOVRLAY-29) sees the button greyed out, saying why.
  const whyTheRoleCannotTake = useWhyTheRoleCannotSend('takeItem');
  const whyTheTakeIsOff = whyTheRoleCannotTake ?? findWhyTheTakeOfItemIsOff(item);
  const isPreviewOffForTheRole = useWhyTheRoleCannotSend('previewItem') !== undefined;

  function takeThisItemAndLetGoOfTheFocus(button: HTMLButtonElement): void {
    button.blur();
    props.onTakePressed();
  }

  return (
    // The colour is on the row, so the main button and its "⋯" share the background and
    // the text colour that reads on it.
    <li
      aria-label={item.label}
      className={cn('relative flex rounded-md shadow-xs', buttonClassForEachItemColor[item.color])}
    >
      <TakeButtonWithItsReason whyTheTakeIsOff={whyTheTakeIsOff}>
        <button
          type="button"
          disabled={!isConnected || whyTheTakeIsOff !== undefined}
          data-item-color={item.color}
          onClick={(click) => takeThisItemAndLetGoOfTheFocus(click.currentTarget)}
          onContextMenu={(rightClick) => {
            // The browser's own menu would cover the button; ours opens instead.
            rightClick.preventDefault();
            setIsMenuOpen(true);
          }}
          className="flex min-h-16 w-full min-w-0 flex-col items-start gap-0.5 rounded-md p-2 pr-7 text-left outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="w-full truncate text-sm font-semibold">{item.label}</span>
          <span className="w-full truncate text-xs opacity-80">{graphicName}</span>
          <ItemSourceMarker item={item} />
          <ItemEntityMarker item={item} />
          {digitKey === null ? null : (
            <kbd aria-hidden="true" className="absolute bottom-1 right-2 text-xs opacity-80">
              {digitKey}
            </kbd>
          )}
        </button>
      </TakeButtonWithItsReason>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={!isConnected}
            aria-label={texts.moreActionsButton(item.label)}
            className="absolute top-1 right-1 rounded-sm px-1 text-sm leading-none outline-none hover:opacity-70 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
          >
            {texts.moreActionsSymbol}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
          <DropdownMenuItem disabled={isPreviewOffForTheRole} onSelect={props.onPreviewChosen}>
            {texts.previewAction}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onEditChosen}>{texts.editAction}</DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onMoveToRundownChosen}>
            {texts.moveToRundownAction}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/**
 * The button as it is, or, when its take is off for a reason (an item filled by an
 * event), wrapped in a focusable span that shows the reason as a tooltip: a disabled
 * button receives neither hover nor focus (as features/connection/ActionButton.tsx does).
 */
function TakeButtonWithItsReason(props: {
  whyTheTakeIsOff: string | undefined;
  children: ReactNode;
}) {
  if (props.whyTheTakeIsOff === undefined) {
    return props.children;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="flex w-full rounded-md">
          {props.children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{props.whyTheTakeIsOff}</TooltipContent>
    </Tooltip>
  );
}
