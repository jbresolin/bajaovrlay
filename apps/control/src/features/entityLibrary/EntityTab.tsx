import type { EntityType } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useReadServerStateNow } from '@/state/ControlPageStateProvider';

import { BajaAppTeamsImportPanel } from './BajaAppTeamsImportPanel';
import { writeExampleCsvOfEntityType, writeRecordsAsCsv } from './entityCsvExport';
import { EntityCsvImportPanel } from './EntityCsvImportPanel';
import { EntityRecordFormPanel } from './EntityRecordFormPanel';
import { type AnyEntityRecord, listRecordsOfType, readKeyOfRecord } from './entityRecordsOfType';
import { EntityTable } from './EntityTable';
import { SimulatorTeamsImportButton } from './SimulatorTeamsImportButton';
import { csvContentType, downloadTextFile } from './textFileDownload';
import { useEntityLibrary } from './useEntityLibrary';

const texts = ptBR.entityLibrary;

/**
 * What the side panel shows: a record's form (new: null), the CSV import (empty, or
 * starting with the Baja app's teams), the Baja app's event field, or nothing.
 */
type SidePanel =
  | { kind: 'form'; recordAsOpened: AnyEntityRecord | null }
  | { kind: 'csvImport'; startingCsvText?: string; note?: string }
  | { kind: 'bajaAppTeams' }
  | null;

/**
 * One Cadastros tab: a toolbar ("+ Equipe", "Importar CSV", "Exportar CSV", "Baixar
 * exemplo", and on Equipes "Importar equipes do simulador" and "Importar equipes do app
 * Baja"), the table, and a side panel with the form or the CSV import; the Baja app's
 * teams are read in the panel, then imported by the CSV import itself. On a tablet the panel sits under the table; it sits
 * beside it from the `lg` width up. The panel open is this tab's own state, not the
 * server's: a reload may close it, and loses nothing saved.
 *
 * `recordKeyToOpen` (the page's address named a record of this tab) opens that record's
 * form as soon as the library holds it: on a new tab the library arrives after the first
 * draw. It opens once; closing the form keeps it closed.
 */
export function EntityTab(props: { entityType: EntityType; recordKeyToOpen?: string | undefined }) {
  const { entityType, recordKeyToOpen } = props;
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const library = useEntityLibrary();
  const recordToOpen =
    recordKeyToOpen === undefined
      ? undefined
      : listRecordsOfType(library, entityType).find(
          (record) => readKeyOfRecord(entityType, record) === recordKeyToOpen,
        );
  // Set while drawing, as React's "adjusting state when a prop changes" does, rather than
  // in an effect: the form shows in the same draw that first finds the record.
  const [hasOpenedTheRecord, setHasOpenedTheRecord] = useState(false);
  if (recordToOpen !== undefined && !hasOpenedTheRecord) {
    setHasOpenedTheRecord(true);
    setSidePanel({ kind: 'form', recordAsOpened: recordToOpen });
  }
  const readServerStateNow = useReadServerStateNow();
  const fileName = texts.csv.fileNames[entityType];

  function exportTheTab(): void {
    downloadTextFile(
      `${fileName}.csv`,
      writeRecordsAsCsv(entityType, readServerStateNow()),
      csvContentType,
    );
  }

  function downloadTheExample(): void {
    downloadTextFile(
      `${fileName}${texts.csv.exampleFileSuffix}.csv`,
      writeExampleCsvOfEntityType(entityType),
      csvContentType,
    );
  }

  // A new key for every record (or new form) opened, so a form never keeps the fields of
  // the previous one.
  const formKey =
    sidePanel?.kind === 'form'
      ? sidePanel.recordAsOpened === null
        ? 'novo'
        : readKeyOfRecord(entityType, sidePanel.recordAsOpened)
      : '';
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setSidePanel({ kind: 'form', recordAsOpened: null })}>
            {texts.addButtons[entityType]}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSidePanel({ kind: 'csvImport' })}>
            {texts.csv.importButton}
          </Button>
          <Button size="sm" variant="outline" onClick={exportTheTab}>
            {texts.csv.exportButton}
          </Button>
          <Button size="sm" variant="ghost" onClick={downloadTheExample}>
            {texts.csv.exampleButton}
          </Button>
        </div>
        {entityType === 'team' && (
          <div className="flex flex-wrap items-start gap-2">
            <SimulatorTeamsImportButton />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSidePanel({ kind: 'bajaAppTeams' })}
            >
              {texts.bajaApp.importButton}
            </Button>
          </div>
        )}
        <EntityTable
          entityType={entityType}
          onEdit={(record) => setSidePanel({ kind: 'form', recordAsOpened: record })}
        />
        <CommandErrorMessage commandTypes={['deleteEntity', 'deleteMedia']} />
      </div>
      {sidePanel?.kind === 'form' && (
        <EntityRecordFormPanel
          key={formKey}
          entityType={entityType}
          recordAsOpened={sidePanel.recordAsOpened}
          onClose={() => setSidePanel(null)}
        />
      )}
      {sidePanel?.kind === 'csvImport' && (
        <EntityCsvImportPanel
          key={sidePanel.note ?? 'csv'}
          entityType={entityType}
          startingCsvText={sidePanel.startingCsvText}
          note={sidePanel.note}
          onClose={() => setSidePanel(null)}
        />
      )}
      {sidePanel?.kind === 'bajaAppTeams' && (
        <BajaAppTeamsImportPanel
          storedTeams={library.teams}
          onTeamsRead={(startingCsvText, note) =>
            setSidePanel({ kind: 'csvImport', startingCsvText, note })
          }
          onClose={() => setSidePanel(null)}
        />
      )}
    </div>
  );
}
