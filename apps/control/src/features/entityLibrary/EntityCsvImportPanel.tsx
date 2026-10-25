import type { EntityType } from '@bajaovrlay/shared';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal } from '@/state/ControlPageStateProvider';

import { listCsvColumnsOfEntityType } from './entityCsvColumns';
import { buildCsvImportPreview, listRecordsToImport } from './entityCsvImport';
import { makeRecordId } from './recordId';
import { useEntityLibrary } from './useEntityLibrary';

const texts = ptBR.entityLibrary.csv;

/** What a tab gives its import panel. */
export type EntityCsvImportPanelProps = { entityType: EntityType; onClose: () => void };

/**
 * "Importar CSV" of one tab: the CSV is pasted, or read from a chosen file into the same
 * box, and the preview (entityCsvImport.ts) is drawn as it is typed: each line with its
 * number, "novo", "atualiza" or "erro" and the pt-BR reason. "Importar" sends the valid
 * lines only, as one importEntities (one state change, one event-log row). The panel
 * lists the tab's columns, says which is the key and that images are not in the CSV. A
 * new person, sponsor or slot of the file gets an id made for this preview.
 */
export function EntityCsvImportPanel(props: EntityCsvImportPanelProps) {
  const { entityType } = props;
  const pasteBoxId = useId();
  const fileInputId = useId();
  const noteAboutIdsId = useId();
  // A team is keyed by its car, which every line carries; the other kinds by an id a line
  // may leave out, and then each import of the same file makes the records again.
  const isKeyedByAnId = entityType !== 'team';
  const library = useEntityLibrary();
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [csvText, setCsvText] = useState('');
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const [outcomeMessage, setOutcomeMessage] = useState<{ text: string; isRefusal: boolean } | null>(
    null,
  );

  const preview =
    csvText.trim() === ''
      ? undefined
      : buildCsvImportPreview(entityType, csvText, library, makeRecordId);
  const recordsToImport = preview === undefined ? undefined : listRecordsToImport(preview);
  const validRowCount = recordsToImport?.records.length ?? 0;

  async function importTheValidRows(): Promise<void> {
    if (recordsToImport === undefined) {
      return;
    }
    setIsWaitingForTheServer(true);
    const refusal = await sendCommandAndReadItsRefusal({
      type: 'importEntities',
      ...recordsToImport,
    });
    setIsWaitingForTheServer(false);
    if (refusal === null) {
      setOutcomeMessage({ text: texts.imported(validRowCount), isRefusal: false });
      setCsvText('');
    } else {
      setOutcomeMessage({ text: refusal, isRefusal: true });
    }
  }

  return (
    <section
      aria-label={texts.panelTitle(ptBR.entityLibrary.tabs[entityType])}
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <h3 className="font-semibold">{texts.panelTitle(ptBR.entityLibrary.tabs[entityType])}</h3>
      <div className="text-sm">
        <p className="text-muted-foreground">{texts.columnsTitle}</p>
        <ul className="list-inside list-disc">
          {listCsvColumnsOfEntityType(entityType).map((column) => (
            <li key={column.columnName}>
              <code>{column.columnName}</code>
              {column.isRequired && (
                <span className="ml-1 text-muted-foreground">{texts.requiredMark}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          {entityType === 'team' ? texts.keyColumnHint.team : texts.keyColumnHint.other}
        </p>
        {entityType === 'scheduleSlot' && (
          <p className="text-muted-foreground">{texts.dateTimeColumnsHint}</p>
        )}
        {/* Teams and sponsors both have the placa_clara column (BAJAOVRLAY-24, -23). */}
        {(entityType === 'team' || entityType === 'sponsor') && (
          <p className="text-muted-foreground">{texts.yesNoColumnsHint}</p>
        )}
        <p className="text-muted-foreground">{texts.imagesNotInTheCsv}</p>
      </div>

      <Label htmlFor={pasteBoxId}>{texts.pasteLabel}</Label>
      <Textarea
        id={pasteBoxId}
        rows={6}
        className="font-mono text-xs"
        value={csvText}
        onChange={(event) => {
          setCsvText(event.target.value);
          setOutcomeMessage(null);
        }}
      />
      <Label htmlFor={fileInputId}>{texts.chooseFileLabel}</Label>
      <Input
        id={fileInputId}
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            void file.text().then((fileText) => {
              setCsvText(fileText);
              setOutcomeMessage(null);
            });
          }
        }}
      />

      {preview?.problemOfTheFile !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {preview.problemOfTheFile}
        </p>
      )}
      {preview !== undefined && preview.rows.length > 0 && (
        <Table aria-label={texts.previewTableLabel}>
          <TableHeader>
            <TableRow>
              <TableHead>{texts.lineColumn}</TableHead>
              <TableHead>{texts.statusColumn}</TableHead>
              <TableHead>{texts.recordColumn}</TableHead>
              <TableHead>{texts.reasonColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={row.lineNumber}>
                <TableCell>{row.lineNumber}</TableCell>
                <TableCell className={row.status === 'error' ? 'text-destructive' : undefined}>
                  {texts.statuses[row.status]}
                </TableCell>
                <TableCell>{row.recordDescription}</TableCell>
                <TableCell>{row.reason ?? ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {outcomeMessage !== null && (
        <p
          role={outcomeMessage.isRefusal ? 'alert' : 'status'}
          className={outcomeMessage.isRefusal ? 'text-sm text-destructive' : 'text-sm'}
        >
          {outcomeMessage.text}
        </p>
      )}
      {isKeyedByAnId && (
        <p id={noteAboutIdsId} className="text-sm text-muted-foreground">
          {texts.linesWithoutIdsCreateNewRecords}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          size="sm"
          aria-describedby={isKeyedByAnId ? noteAboutIdsId : undefined}
          disabled={validRowCount === 0 || isWaitingForTheServer}
          onClick={() => void importTheValidRows()}
        >
          {isWaitingForTheServer
            ? texts.importingButton
            : texts.importValidRowsButton(validRowCount)}
        </ActionButton>
        <Button size="sm" variant="ghost" onClick={props.onClose}>
          {texts.closeButton}
        </Button>
      </div>
    </section>
  );
}
