import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ptBR } from '@/i18n/ptBR';

import { readImportedFlexConfig, writeExportedFlexConfig } from './flexConfigImportAndExport';
import { readFlexConfigFormValues } from './flexSourceFormReading';
import { buildFlexConfigFormValues, type FlexSourceFormValues } from './flexSourceFormValues';

const texts = ptBR.dataSources.flexForm.importExport;

/** Which of the two boxes is open, with what it shows. */
type OpenBox =
  | { kind: 'none' }
  | { kind: 'export'; exportedText: string | null }
  | { kind: 'import'; problems: string[] };

/**
 * "Exportar configuração" shows the form's config as JSON to copy (once the form reads
 * as a valid config); "Importar configuração" takes pasted JSON, checks it with the
 * shared schema (flexConfigImportAndExport.ts) and fills the requests and mappings,
 * leaving the name and interval as typed. A refused import changes nothing and lists why.
 * No file upload: copy and paste is all a preset needs.
 */
export function FlexConfigImportExport(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  controlIdPrefix: string;
}) {
  const { form } = props;
  const [openBox, setOpenBox] = useState<OpenBox>({ kind: 'none' });
  const [pastedText, setPastedText] = useState('');
  const [wasJustImported, setWasJustImported] = useState(false);
  const ids = {
    exported: `${props.controlIdPrefix}-exported-config`,
    imported: `${props.controlIdPrefix}-imported-config`,
  };

  function exportTheConfig(): void {
    setWasJustImported(false);
    const configReading = readFlexConfigFormValues(form.getValues());
    if (!configReading.isValid) {
      void form.trigger(['requests', 'mappings']);
      setOpenBox({ kind: 'export', exportedText: null });
      return;
    }
    setOpenBox({ kind: 'export', exportedText: writeExportedFlexConfig(configReading.config) });
  }

  function importThePastedConfig(): void {
    const configImport = readImportedFlexConfig(pastedText);
    if (!configImport.isImported) {
      setOpenBox({ kind: 'import', problems: configImport.problems });
      return;
    }
    const currentValues = form.getValues();
    form.reset({
      label: currentValues.label,
      pollIntervalSeconds: currentValues.pollIntervalSeconds,
      ...buildFlexConfigFormValues(configImport.config),
    });
    setPastedText('');
    setOpenBox({ kind: 'none' });
    setWasJustImported(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={exportTheConfig}>
          {texts.exportButton}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setWasJustImported(false);
            setOpenBox({ kind: 'import', problems: [] });
          }}
        >
          {texts.importButton}
        </Button>
      </div>
      {wasJustImported && <p className="text-sm">{texts.importedNote}</p>}

      {openBox.kind === 'export' && openBox.exportedText === null && (
        <p role="alert" className="text-sm text-destructive">
          {texts.exportNeedsAValidForm}
        </p>
      )}
      {openBox.kind === 'export' && openBox.exportedText !== null && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.exported}>{texts.exportedLabel}</Label>
          <Textarea
            id={ids.exported}
            readOnly
            rows={10}
            className="field-sizing-fixed max-h-80 bg-muted font-mono text-xs"
            value={openBox.exportedText}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => setOpenBox({ kind: 'none' })}
          >
            {texts.closeButton}
          </Button>
        </div>
      )}

      {openBox.kind === 'import' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.imported}>{texts.importLabel}</Label>
          <Textarea
            id={ids.imported}
            rows={10}
            spellCheck={false}
            className="field-sizing-fixed max-h-80 font-mono text-xs"
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
          />
          {openBox.problems.length > 0 && (
            <div role="alert" className="text-sm text-destructive">
              <p className="font-medium">{texts.importRefusedTitle}</p>
              <ul className="list-disc pl-5">
                {openBox.problems.map((problem, problemIndex) => (
                  <li key={`${problemIndex}-${problem}`}>{problem}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={importThePastedConfig}>
              {texts.importConfirmButton}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpenBox({ kind: 'none' })}
            >
              {texts.closeButton}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
