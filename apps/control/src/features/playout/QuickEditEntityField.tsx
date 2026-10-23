import { buildHashOfRecordToOpen } from '@/app/recordToOpen';
import { Button } from '@/components/ui/button';
import type { EntityFieldOfInstance } from '@/features/entityLibrary/entityFieldsOfInstance';
import { ptBR } from '@/i18n/ptBR';

/**
 * A field of the loaded instance that reads the entity library, as "Edição rápida" draws
 * it (gate 2 of PR #23), alike QuickEditBoundField.tsx: read-only, because typing over it
 * would stop it following the record while the record still said the old thing for the
 * next take; where it reads; its value on air; and "Editar no cadastro", the honest way
 * to change it, which opens the record in Cadastros in a new browser tab so the console
 * stays put. A record no longer in the library offers nothing to open.
 */
export function QuickEditEntityField(props: {
  entityField: EntityFieldOfInstance;
  fieldLabel: string;
  /** What the field shows on air now, written for reading. */
  valueOnAirText: string;
}) {
  const { entityField, fieldLabel, valueOnAirText } = props;
  const texts = ptBR.entityLibrary.onAir;
  const recordToOpen = entityField.recordToOpen;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed border-border p-2">
      <p className="text-sm">{entityField.whereItReadsText}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{valueOnAirText}</span>
        {recordToOpen !== undefined && (
          <Button asChild variant="outline" size="xs">
            <a
              href={buildHashOfRecordToOpen(recordToOpen)}
              target="_blank"
              rel="noopener"
              aria-label={texts.editInTheLibraryButtonLabel(fieldLabel)}
              title={texts.editInTheLibraryHint}
            >
              {texts.editInTheLibraryButton}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
