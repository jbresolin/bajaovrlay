import type { Override, OverrideKey } from '@bajaovrlay/shared';
import { type ReactNode, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';

import { CorrectableValueMenu } from './CorrectableValueMenu';

/** Nothing until the value is pressed; then its menu; then, once chosen, the dialog. */
type WhatIsOpen = 'nothing' | 'menu' | 'dialog';

/**
 * One value of a source on the "Fontes" page that a data operator can correct: the value
 * shown (the correction while one is in force) is a plain button; a click or a right-click
 * opens its menu, "Corrigir valor…" and, while a correction is in force, "Remover
 * correção". A corrected value carries the badge "corrigido", its reason in the tooltip.
 * The value is the button, rather than a "⋯" beside it, so a table cell reads only its value.
 * Deliberate (gate 2 of PR #18): the cell holds no store subscription and no menu until it
 * is pressed. Its correction comes in as a prop, from one lookup the detail builds per
 * redraw (overrideLookup.ts), and the menu and the dialog mount only when asked for: with
 * one menu and one subscription per cell, about 360 for 60 cars, every poll froze the page.
 */
export function CorrectableValue(props: {
  sourceLabel: string;
  overrideKey: OverrideKey;
  /** The correction in force for this value, from the detail's lookup, if any. */
  overrideInForce: Override | undefined;
  /** "Equipe do carro 42": what the button and the dialog name. */
  fieldDescription: string;
  /** The value shown, written for reading (corrected while a correction is in force). */
  valueText: string;
  /** What the source itself sends, written for reading, for the dialog. */
  valueAsSentText: string;
  /** How the value is drawn (a flag's coloured pill); its text when left out. */
  children?: ReactNode;
}) {
  const { overrideInForce, fieldDescription, valueText } = props;
  const [whatIsOpen, setWhatIsOpen] = useState<WhatIsOpen>('nothing');
  const texts = ptBR.bindings.overrides;

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={texts.valueButtonLabel(fieldDescription, valueText)}
        onClick={() => setWhatIsOpen('menu')}
        onContextMenu={(rightClick) => {
          rightClick.preventDefault();
          setWhatIsOpen('menu');
        }}
        className="cursor-pointer rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {props.children ?? valueText}
      </button>
      {overrideInForce !== undefined && (
        <Badge variant="outline" title={overrideInForce.reason}>
          {texts.correctedBadge}
        </Badge>
      )}
      {whatIsOpen !== 'nothing' && (
        <CorrectableValueMenu
          sourceLabel={props.sourceLabel}
          overrideKey={props.overrideKey}
          overrideInForce={overrideInForce}
          valueAsSentText={props.valueAsSentText}
          isDialogChosen={whatIsOpen === 'dialog'}
          onDialogChosen={() => setWhatIsOpen('dialog')}
          // The menu also reports itself closed right after "Corrigir valor…" was chosen;
          // read against the latest state, that report leaves the dialog open.
          onMenuClosed={() =>
            setWhatIsOpen((openNow) => (openNow === 'menu' ? 'nothing' : openNow))
          }
          onFinished={() => setWhatIsOpen('nothing')}
        />
      )}
    </span>
  );
}
