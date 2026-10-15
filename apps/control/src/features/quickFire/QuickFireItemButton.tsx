import type { Item } from '@bajaovrlay/shared';
import { cn } from 'cn';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buttonClassForEachItemColor } from '@/features/items/itemColorButton';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

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
 * rundown". Like a rundown row it is off while the page is disconnected.
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
      <button
        type="button"
        disabled={!isConnected}
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
        {digitKey === null ? null : (
          <kbd aria-hidden="true" className="absolute bottom-1 right-2 text-xs opacity-80">
            {digitKey}
          </kbd>
        )}
      </button>
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
          <DropdownMenuItem onSelect={props.onPreviewChosen}>
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
