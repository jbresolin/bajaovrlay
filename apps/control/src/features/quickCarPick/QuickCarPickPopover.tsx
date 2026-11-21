import type { Item } from '@bajaovrlay/shared';
import type { KeyboardEvent, ReactNode } from 'react';

import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

import type { CarGroupsToPickQuickly } from './carGroupsToPickQuickly';
import { QuickCarPickBox } from './QuickCarPickBox';

const texts = ptBR.quickCarPick;

/** What the popover needs: whose box it is, whether it is open, and what its buttons do. */
export type QuickCarPickPopoverProps = {
  item: Item;
  /** What "Escolher carros" offers for the item; undefined draws the children alone. */
  offer: CarGroupsToPickQuickly | undefined;
  /** Open and closed by the button or row, so its "⋯" menu can open it too. */
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPreviewChosen: () => void;
  onTakeChosen: () => void;
  /** The quick-fire button or the rundown row: one element, which the box is placed under. */
  children: ReactNode;
};

/**
 * Keeps every key pressed inside the box from the page's shortcuts (BAJAOVRLAY-82): a Space
 * on "No ar" must press it, not take the rundown's next item, and the page refuses Space
 * when it is let go on any button it does not see as typing. Esc still closes the box:
 * Radix reads it before this, while the key travels down to the box.
 */
function keepKeysFromThePageShortcuts(keyPress: KeyboardEvent<HTMLDivElement>): void {
  keyPress.stopPropagation();
}

/**
 * "Escolher carros" around a quick-fire button or a rundown row (BAJAOVRLAY-82): the box
 * (QuickCarPickBox.tsx) opens under the whole button or row, drawn only while open, so
 * the positions it follows redraw nothing while it is closed. Like the "⋯" menus, closing
 * it does not hand the focus back to what opened it: a focused chevron would take the next
 * Space for itself instead of the rundown.
 */
export function QuickCarPickPopover(props: QuickCarPickPopoverProps) {
  const { item, offer } = props;
  if (offer === undefined) {
    return props.children;
  }
  return (
    <Popover open={props.isOpen} onOpenChange={props.onOpenChange}>
      <PopoverAnchor asChild>{props.children}</PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-80"
        aria-label={texts.boxTitle(item.label)}
        // The box puts the focus in its first box itself, not on the first tab.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div onKeyDown={keepKeysFromThePageShortcuts} onKeyUp={keepKeysFromThePageShortcuts}>
          <QuickCarPickBox
            item={item}
            offer={offer}
            onPreviewChosen={props.onPreviewChosen}
            onTakeChosen={props.onTakeChosen}
            onClose={() => props.onOpenChange(false)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The small chevron on a quick-fire button that opens "Escolher carros" (and closes it
 * again). Must be drawn inside a QuickCarPickPopover with an offer. Off while the page is
 * disconnected, like the "⋯" beside it, and for a role that may not take (Dados): the box
 * ends in a take or a preview, so it is greyed out with the role's reason as its tooltip,
 * on a focusable span since a disabled button receives neither hover nor focus.
 */
export function QuickCarPickOpenButton(props: { itemLabel: string; className: string }) {
  const isConnected = useIsConnectedToServer();
  const whyTheRoleCannotTake = useWhyTheRoleCannotSend('takeItem');
  const chevron = (
    <PopoverTrigger asChild>
      <button
        type="button"
        disabled={!isConnected || whyTheRoleCannotTake !== undefined}
        aria-label={texts.openButton(props.itemLabel)}
        className={props.className}
      >
        {texts.openSymbol}
      </button>
    </PopoverTrigger>
  );
  if (whyTheRoleCannotTake === undefined) {
    return chevron;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={props.className}>
          {chevron}
        </span>
      </TooltipTrigger>
      <TooltipContent>{whyTheRoleCannotTake}</TooltipContent>
    </Tooltip>
  );
}
