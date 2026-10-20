import type { OverrideKey } from '@bajaovrlay/shared';
import { type ReactNode, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { OverrideDialog } from './OverrideDialog';
import { findOverrideInForce } from './overrideInForce';

/**
 * One value of a source on the "Fontes" page that a data operator can correct: the value
 * shown (the correction while one is in force) is itself the button of a small menu,
 * opened by a click or a right-click, with "Corrigir valor…" (the correction dialog) and,
 * while a correction is in force, "Remover correção" (clearOverride at once). A corrected
 * value carries the badge "corrigido", its reason in the tooltip. The value is the button,
 * rather than a "⋯" beside it, so a table cell reads only its value.
 */
export function CorrectableValue(props: {
  sourceLabel: string;
  overrideKey: OverrideKey;
  /** "Equipe do carro 42": what the button and the dialog name. */
  fieldDescription: string;
  /** The value shown, written for reading (corrected while a correction is in force). */
  valueText: string;
  /** What the source itself sends, written for reading, for the dialog. */
  valueAsSentText: string;
  /** How the value is drawn (a flag's coloured pill); its text when left out. */
  children?: ReactNode;
}) {
  const { sourceLabel, overrideKey, fieldDescription, valueText, valueAsSentText } = props;
  const overrides = useServerState((state) => state.overrides);
  const sendCommand = useSendCommand();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const overrideInForce = findOverrideInForce(overrides, overrideKey);
  const texts = ptBR.bindings.overrides;

  return (
    <span className="inline-flex items-center gap-1">
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={texts.valueButtonLabel(fieldDescription, valueText)}
            onContextMenu={(rightClick) => {
              rightClick.preventDefault();
              setIsMenuOpen(true);
            }}
            className="cursor-pointer rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {props.children ?? valueText}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setIsDialogOpen(true)}>
            {texts.correctMenuItem}
          </DropdownMenuItem>
          {overrideInForce !== undefined && (
            <DropdownMenuItem
              onSelect={() => void sendCommand({ type: 'clearOverride', ...overrideKey })}
            >
              {texts.clearButton}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {overrideInForce !== undefined && (
        <Badge variant="outline" title={overrideInForce.reason}>
          {texts.correctedBadge}
        </Badge>
      )}
      {isDialogOpen && (
        <OverrideDialog
          isOpen
          onClose={() => setIsDialogOpen(false)}
          sourceLabel={sourceLabel}
          overrideKey={overrideKey}
          overrideInForce={overrideInForce}
          valueNowText={valueAsSentText}
        />
      )}
    </span>
  );
}
