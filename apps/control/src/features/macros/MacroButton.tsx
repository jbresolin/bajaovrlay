import type { Macro, MacroRun } from '@bajaovrlay/shared';
import { cn } from 'cn';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { buttonClassForEachItemColor } from '@/features/items/itemColorButton';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

/** What one macro button needs. */
export type MacroButtonProps = {
  macro: Macro;
  /** This macro's entry in the `macroRuns` slice while it runs, otherwise undefined. */
  runOfThisMacro: MacroRun | undefined;
  /** The digit that runs it on this tab ('1' to '9'), or null past the ninth macro. */
  digitKey: string | null;
  /** The click of the button, and the menu's "Executar". */
  onRunPressed: () => void;
  /** The menu's "Prévia": the macro's end state on the preview output. */
  onPreviewChosen: () => void;
  onEditChosen: () => void;
  /** "Parar": drawn only while this macro runs and no stop was asked for yet. */
  onStopPressed: () => void;
};

const texts = ptBR.quickFire.macros;

/**
 * One macro: a button painted in its colour that runs it, and a small "⋯" beside it
 * (also opened by a right-click on the button) with "Executar", "Prévia" and "Editar".
 * The button's tooltip says that "Prévia" shows the end state, which "Tomar tudo" then
 * applies without the waits, unlike "Executar".
 * While the server lists a run of it, the button says "Rodando" and the step the run is
 * on, counted from 1 ("Rodando 2/3"), and is marked busy for a screen reader. A macro
 * with no step says "Rodando" alone for the moment its run lasts, never "Rodando 1/0".
 * A running macro also gets "Parar" (stopMacro); once the server marked the run as being
 * stopped the badge says "Parando…" until the run ends, and "Parar" is gone.
 *
 * Deliberate: the button is never switched off by a run, its own or another's. The
 * server refuses a second run (MACRO_RUNNING) with a pt-BR message, and the strip shows
 * it; a page that missed the slice ending a run would otherwise block the operator.
 * The focus rules are the quick-fire button's (QuickFireItemButton.tsx): the button lets
 * go of the focus after a click, and a closing menu does not hand the focus back to "⋯".
 */
export function MacroButton(props: MacroButtonProps) {
  const { macro, runOfThisMacro, digitKey } = props;
  const isConnected = useIsConnectedToServer();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isRunning = runOfThisMacro !== undefined;
  const isBeingStopped = runOfThisMacro?.isStopRequested === true;

  // The button lets go of the focus after a click, as every firing button of the page.
  function runThisMacroAndLetGoOfTheFocus(button: HTMLButtonElement): void {
    button.blur();
    props.onRunPressed();
  }

  return (
    <li
      aria-label={macro.label}
      className={cn('relative flex rounded-md shadow-xs', buttonClassForEachItemColor[macro.color])}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={!isConnected}
            data-item-color={macro.color}
            aria-busy={isRunning}
            onClick={(click) => runThisMacroAndLetGoOfTheFocus(click.currentTarget)}
            onContextMenu={(rightClick) => {
              // The browser's own menu would cover the button; ours opens instead.
              rightClick.preventDefault();
              setIsMenuOpen(true);
            }}
            className={cn(
              'flex min-h-16 w-full min-w-0 flex-col items-start gap-0.5 rounded-md p-2 pr-12 text-left outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
              isRunning && 'ring-[3px] ring-ring',
            )}
          >
            <span className="w-full truncate text-sm font-semibold">{macro.label}</span>
            {isRunning ? (
              <span className="text-xs font-medium">
                {describeRun(runOfThisMacro, macro.steps.length)}
              </span>
            ) : null}
            {digitKey === null ? null : (
              <kbd aria-hidden="true" className="absolute bottom-1 right-2 text-xs opacity-80">
                {digitKey}
              </kbd>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{texts.previewAndTakeAllHint}</TooltipContent>
      </Tooltip>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={!isConnected}
            aria-label={texts.moreActionsButton(macro.label)}
            className="absolute top-1 right-1 rounded-sm px-1 text-sm leading-none outline-none hover:opacity-70 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
          >
            {texts.moreActionsSymbol}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
          <DropdownMenuItem onSelect={props.onRunPressed}>{texts.runAction}</DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onPreviewChosen}>
            {texts.previewAction}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onEditChosen}>{texts.editAction}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isRunning && !isBeingStopped ? (
        <button
          type="button"
          disabled={!isConnected}
          aria-label={texts.stopMacroButton(macro.label)}
          onClick={props.onStopPressed}
          className="absolute top-6 right-1 rounded-sm bg-background px-1 text-xs font-semibold text-foreground outline-none hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
        >
          {texts.stopMacroSymbol}
        </button>
      ) : null}
    </li>
  );
}

/** The badge of a running macro: "Parando…", "Rodando 2/3", or "Rodando" with no step. */
function describeRun(run: MacroRun, numberOfSteps: number): string {
  if (run.isStopRequested) {
    return texts.stoppingBadge;
  }
  if (numberOfSteps === 0) {
    return texts.runningBadgeWithoutSteps;
  }
  return texts.runningBadge(run.currentStep + 1, numberOfSteps);
}
