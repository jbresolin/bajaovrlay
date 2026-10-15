import type { Macro, MacroRun } from '@bajaovrlay/shared';
import { cn } from 'cn';

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
  onRunPressed: () => void;
  onEditPressed: () => void;
};

const texts = ptBR.quickFire.macros;

/**
 * One macro: a button painted in its colour that runs it, and a small "Editar" beside it.
 * While the server lists a run of it, the button says "Rodando" and the step the run is
 * on, counted from 1 ("Rodando 2/3"), and is marked busy for a screen reader. A macro
 * with no step says "Rodando" alone for the moment its run lasts, never "Rodando 1/0".
 *
 * Deliberate: the button is never switched off by a run, its own or another's. The
 * server refuses a second run (MACRO_RUNNING) with a pt-BR message, and the strip shows
 * it; a page that missed the slice ending a run would otherwise block the operator.
 */
export function MacroButton(props: MacroButtonProps) {
  const { macro, runOfThisMacro, digitKey } = props;
  const isConnected = useIsConnectedToServer();
  const isRunning = runOfThisMacro !== undefined;
  const hasSteps = macro.steps.length > 0;

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
      <button
        type="button"
        disabled={!isConnected}
        data-item-color={macro.color}
        aria-busy={isRunning}
        onClick={(click) => runThisMacroAndLetGoOfTheFocus(click.currentTarget)}
        className={cn(
          'flex min-h-16 w-full min-w-0 flex-col items-start gap-0.5 rounded-md p-2 pr-12 text-left outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
          isRunning && 'ring-[3px] ring-ring',
        )}
      >
        <span className="w-full truncate text-sm font-semibold">{macro.label}</span>
        {isRunning ? (
          <span className="text-xs font-medium">
            {hasSteps
              ? texts.runningBadge(runOfThisMacro.currentStep + 1, macro.steps.length)
              : texts.runningBadgeWithoutSteps}
          </span>
        ) : null}
        {digitKey === null ? null : (
          <kbd aria-hidden="true" className="absolute bottom-1 right-2 text-xs opacity-80">
            {digitKey}
          </kbd>
        )}
      </button>
      <button
        type="button"
        disabled={!isConnected}
        aria-label={texts.editMacroButton(macro.label)}
        onClick={props.onEditPressed}
        className="absolute top-1 right-1 rounded-sm px-1 text-xs underline outline-none hover:opacity-70 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
      >
        {texts.editMacroSymbol}
      </button>
    </li>
  );
}
