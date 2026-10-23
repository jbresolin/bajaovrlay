import type { EntityType } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useReadServerStateNow } from '@/state/ControlPageStateProvider';

import { writeExampleCsvOfEntityType, writeRecordsAsCsv } from './entityCsvExport';
import { EntityCsvImportPanel } from './EntityCsvImportPanel';
import { EntityRecordFormPanel } from './EntityRecordFormPanel';
import { type AnyEntityRecord, readKeyOfRecord } from './entityRecordsOfType';
import { EntityTable } from './EntityTable';
import { SimulatorTeamsImportButton } from './SimulatorTeamsImportButton';
import { csvContentType, downloadTextFile } from './textFileDownload';

const texts = ptBR.entityLibrary;

/** What the side panel shows: a record's form (new: null), the CSV import, or nothing. */
type SidePanel =
  { kind: 'form'; recordAsOpened: AnyEntityRecord | null } | { kind: 'csvImport' } | null;

/**
 * One Cadastros tab: a toolbar ("+ Equipe", "Importar CSV", "Exportar CSV", "Baixar
 * exemplo", and on Equipes "Importar equipes do simulador"), the table, and a side panel
 * with the form or the CSV import. On a tablet the panel sits under the table; it sits
 * beside it from the `lg` width up. The panel open is this tab's own state, not the
 * server's: a reload may close it, and loses nothing saved.
 */
export function EntityTab(props: { entityType: EntityType }) {
  const { entityType } = props;
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
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
        {entityType === 'team' && <SimulatorTeamsImportButton />}
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
        <EntityCsvImportPanel entityType={entityType} onClose={() => setSidePanel(null)} />
      )}
    </div>
  );
}
