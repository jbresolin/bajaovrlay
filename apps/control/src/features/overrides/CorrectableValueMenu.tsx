import type { Override, OverrideKey } from '@bajaovrlay/shared';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand } from '@/state/ControlPageStateProvider';

import { OverrideDialog } from './OverrideDialog';

/**
 * The menu of one correctable value, mounted only once its value was pressed
 * (CorrectableValue.tsx): open at once beside the value, with "Corrigir valor…" (the
 * correction dialog) and, while a correction is in force, "Remover correção" (clearOverride
 * at once). What is open is the value's own state (CorrectableValue.tsx): the menu reports
 * itself closed, "Corrigir valor…" chosen, and the end (the removal sent, the dialog closed).
 */
export function CorrectableValueMenu(props: {
  sourceLabel: string;
  overrideKey: OverrideKey;
  overrideInForce: Override | undefined;
  valueAsSentText: string;
  isDialogChosen: boolean;
  onDialogChosen: () => void;
  onMenuClosed: () => void;
  onFinished: () => void;
}) {
  const { overrideKey, overrideInForce, onFinished } = props;
  const sendCommand = useSendCommand();
  const texts = ptBR.bindings.overrides;

  if (props.isDialogChosen) {
    return (
      <OverrideDialog
        isOpen
        onClose={onFinished}
        sourceLabel={props.sourceLabel}
        overrideKey={overrideKey}
        overrideInForce={overrideInForce}
        valueNowText={props.valueAsSentText}
      />
    );
  }
  return (
    <DropdownMenu
      open
      onOpenChange={(isOpenNow) => {
        if (!isOpenNow) {
          props.onMenuClosed();
        }
      }}
    >
      {/* An empty anchor right after the value, so the menu opens beside it. */}
      <DropdownMenuTrigger asChild>
        <span aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={props.onDialogChosen}>{texts.correctMenuItem}</DropdownMenuItem>
        {overrideInForce !== undefined && (
          <DropdownMenuItem
            onSelect={() => {
              void sendCommand({ type: 'clearOverride', ...overrideKey });
              onFinished();
            }}
          >
            {texts.clearButton}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
