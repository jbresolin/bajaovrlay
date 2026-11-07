import type { EventLogFilters } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { csvContentType, downloadTextFile } from '@/features/entityLibrary/textFileDownload';
import { useCurrentTime } from '@/features/layers/useCurrentTime';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { writeHistoryCsvText } from './historyCsv';
import { HistoryFilters } from './HistoryFilters';
import { formatMomentOfHistoryRow } from './historyMoments';
import { useHistoryOfTheShow } from './useHistoryOfTheShow';

const texts = ptBR.history;

// A row's moment shows its date once it is no longer today; a minute late is fine for that.
const dayCheckIntervalInMilliseconds = 60_000;

/**
 * The "Histórico" page, "#/historico" (BAJAOVRLAY-30, concept §7 rule 4): every change of
 * the show read back in plain pt-BR, newest first. Each row says when, who ("Operador",
 * "API · companion", "Macro"…) and one sentence (from @bajaovrlay/shared's eventLogReading);
 * a refusal reads "Recusado: …" with its reason, in red. The rows heard live come in at the top by themselves;
 * "Carregar mais" reads older ones from the server (useHistoryOfTheShow.ts), saying
 * "Procurando em registros mais antigos…" while it goes on through rows that match nothing. The filters
 * run on both, and "Exportar CSV" hands over exactly the rows they show. Opened from the
 * header in a new tab, like "Eventos", so it never takes the console's place.
 */
export function HistoryPage() {
  const [filters, setFilters] = useState<EventLogFilters>({});
  const outputs = useServerState((state) => state.outputs);
  const layers = useServerState((state) => state.layers);
  const items = useServerState((state) => state.items);
  const macros = useServerState((state) => state.macros);
  const quickFirePanels = useServerState((state) => state.quickFirePanels);
  const rundowns = useServerState((state) => state.rundowns);
  const dataSources = useServerState((state) => state.dataSources);
  const events = useServerState((state) => state.events);
  const instances = useServerState((state) => state.instances);
  const triggers = useServerState((state) => state.triggers);
  const triggerActivity = useServerState((state) => state.triggerActivity);
  const names = {
    outputs,
    layers,
    items,
    macros,
    quickFirePanels,
    rundowns,
    dataSources,
    events,
    instances,
    triggers,
    triggerActivity,
  };
  const history = useHistoryOfTheShow(filters, names);
  // Only to tell today's rows ("14:32:05") from an older day's ("09/10 14:32:05").
  const nowMs = useCurrentTime(dayCheckIntervalInMilliseconds).getTime();

  function exportTheRowsShown(): void {
    downloadTextFile(texts.csvFileName, writeHistoryCsvText(history.rows), csvContentType);
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-semibold">{texts.title}</h2>
        <Button size="sm" variant="outline" onClick={exportTheRowsShown}>
          {texts.exportCsvButton}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{texts.intro}</p>
      <HistoryFilters
        filters={filters}
        layers={layers}
        outputs={outputs}
        onFiltersChanged={setFilters}
      />

      {history.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {Object.keys(filters).length === 0 ? texts.nothingYet : texts.nothingFound}
        </p>
      ) : (
        <Table aria-label={texts.tableLabel}>
          <TableHeader>
            <TableRow>
              <TableHead>{texts.columns.time}</TableHead>
              <TableHead>{texts.columns.who}</TableHead>
              <TableHead>{texts.columns.whatHappened}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.rows.map((row) => (
              // A refusal reads "Recusado: …" (the shared sentence) and is drawn in red.
              <TableRow key={row.id} className={row.isRefusal ? 'text-destructive' : undefined}>
                <TableCell className="tabular-nums">
                  {formatMomentOfHistoryRow(Date.parse(row.ts), nowMs)}
                </TableCell>
                <TableCell>{row.who.label}</TableCell>
                <TableCell className="whitespace-normal">{row.sentence}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {history.hasOlderPageFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {texts.olderPageFailed}
        </p>
      ) : null}
      {history.isSearchingOlderRows ? (
        <p role="status" className="text-sm text-muted-foreground">
          {texts.searchingOlder}
        </p>
      ) : null}
      {history.canLoadOlderRows ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={history.isLoadingOlderRows || history.isSearchingOlderRows}
          onClick={history.loadOlderRows}
        >
          {history.isLoadingOlderRows ? texts.loadingOlder : texts.loadMoreButton}
        </Button>
      ) : null}
    </main>
  );
}
