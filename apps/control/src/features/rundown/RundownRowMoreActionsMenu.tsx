import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

import type { MoveToShortcutsChoice } from './moveToShortcutsChoices';

/** What a row's menu needs: whose it is, whether it is open, and what it offers. */
export type RundownRowMoreActionsMenuProps = {
  itemLabel: string;
  /** Open and closed by the row, so a right-click anywhere on the row can open it too. */
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The "Mover para atalhos" entries, in tab order (moveToShortcutsChoices.ts). */
  moveToShortcutsChoices: MoveToShortcutsChoice[];
  onMoveToShortcutsChosen: (panelId: string) => void;
};

/**
 * The small "⋯" of a rundown row and its menu: "Mover para atalhos", one entry per
 * quick-fire panel when there are several. Like the quick-fire button's "⋯" it is off
 * while the page is disconnected, and when the menu closes the focus is NOT handed back to
 * "⋯" (Radix's habit): the shortcuts leave a key pressed inside an open menu alone, and a
 * focused "⋯" would otherwise keep the focus after the menu is gone.
 */
export function RundownRowMoreActionsMenu(props: RundownRowMoreActionsMenuProps) {
  const isConnected = useIsConnectedToServer();
  const texts = ptBR.rundown;
  return (
    <DropdownMenu open={props.isOpen} onOpenChange={props.onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!isConnected}
          aria-label={texts.moreActionsButton(props.itemLabel)}
          className="rounded-sm px-1 text-sm leading-none text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {texts.moreActionsSymbol}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
        {props.moveToShortcutsChoices.map((choice) => (
          <DropdownMenuItem
            key={choice.panelId}
            onSelect={() => props.onMoveToShortcutsChosen(choice.panelId)}
          >
            {choice.menuText}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
