import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BoundFieldOfInstance } from '@/features/bindings/boundFieldsOfInstance';
import { OverrideDialog } from '@/features/overrides/OverrideDialog';
import { ptBR } from '@/i18n/ptBR';

/**
 * A field of the loaded instance that a source keeps up to date, as "Edição rápida" draws
 * it: read-only, because the next refresh would overwrite anything typed over it; where
 * it reads; the badge "corrigido" (the reason in its tooltip) while a correction changed
 * its value; and "Corrigir valor da fonte…", the honest way to change it, which opens the
 * correction dialog for the source's value it reads (setOverride).
 */
export function QuickEditBoundField(props: {
  boundField: BoundFieldOfInstance;
  fieldLabel: string;
  /** What the field shows on air now, written for reading. */
  valueOnAirText: string;
}) {
  const { boundField, fieldLabel, valueOnAirText } = props;
  const [isCorrecting, setIsCorrecting] = useState(false);
  const texts = ptBR.bindings.onAir;
  const overrideKey = boundField.overrideKey;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed border-border p-2">
      <p className="text-sm">{boundField.whereItReadsText}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{valueOnAirText}</span>
        {boundField.isOverridden && (
          <Badge variant="outline" title={boundField.overrideInForce?.reason}>
            {ptBR.bindings.overrides.correctedBadge}
          </Badge>
        )}
        {overrideKey !== undefined && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            aria-label={texts.correctButtonLabel(fieldLabel)}
            onClick={() => setIsCorrecting(true)}
          >
            {texts.correctButton}
          </Button>
        )}
      </div>
      {overrideKey !== undefined && isCorrecting && (
        <OverrideDialog
          isOpen
          onClose={() => setIsCorrecting(false)}
          sourceLabel={boundField.sourceLabel ?? texts.deletedSourceName}
          overrideKey={overrideKey}
          overrideInForce={boundField.overrideInForce}
          valueNowText={valueOnAirText}
        />
      )}
    </div>
  );
}
