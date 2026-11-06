import type { DescribedEventLogEntry } from '@bajaovrlay/shared';

import { writeCsvText } from '@/features/entityLibrary/csvText';
import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.history;

/**
 * The text of "Exportar CSV": exactly the rows the filters show, newest first, as the
 * Cadastros CSVs are written (";" between cells, UTF-8 with a byte-order mark, so a pt-BR
 * spreadsheet opens it with its accents). Each row: its number in the log, the date and
 * time on the operator's clock, who sent it, the sentence, and "sim" for a refusal.
 */
export function writeHistoryCsvText(rows: DescribedEventLogEntry[]): string {
  const cellsOfEachRow = rows.map((row) => [
    String(row.id),
    formatDateAndTimeWithSeconds(Date.parse(row.ts)),
    row.who.label,
    row.sentence,
    row.isRefusal ? texts.csvRefusedYes : texts.csvRefusedNo,
  ]);
  return writeCsvText(texts.csvHeader, cellsOfEachRow);
}

/** "09/10/2026 14:32:05" on the operator's clock. */
function formatDateAndTimeWithSeconds(momentMs: number): string {
  return new Date(momentMs).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}
