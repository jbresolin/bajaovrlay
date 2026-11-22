/**
 * The results table's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, the settings with their defaults applied,
 * and pt-BR descriptions of bad data. results-table.ograf.json describes the same data as
 * JSON Schema for renderers and forms; resultsTableManifestDataAgreement.test.ts keeps the
 * two in agreement.
 *
 * The rows follow the shared results table shape (BAJAOVRLAY-83). The graphic draws what it
 * is given: a cell is text as the site writes it, a rank left out reads "–", and a row with
 * fewer cells than heads simply shows the missing ones empty.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// Loose on purpose, like the standings' entries: a row of the shape passes as is even when
// the shape gains a field the table does not draw yet.
const resultsTableEntrySchema = z.looseObject({
  rank: z.int().min(1).optional(),
  carNumber: z.int().min(1),
  teamName: z.string(),
  schoolName: z.string(),
  cells: z.array(z.string()),
});

/** The two ways "Sentido" orders the rows. */
const sortDirectionSchema = z.enum(['ascending', 'descending']);

// Strict at the top: a field the graphic does not know (usually a typo) is refused.
const resultsTableDataSchema = z.strictObject({
  entries: z.array(resultsTableEntrySchema),
  columnHeads: z.array(z.string()),
  tableName: z.string().optional(),
  title: z.string().optional(),
  eventLine: z.string().optional(),
  columnsShown: z.string().optional(),
  sortByColumn: z.string().optional(),
  sortDirection: sortDirectionSchema.optional(),
});

const partialResultsTableDataSchema = resultsTableDataSchema.partial();

/** One row as the table reads it (extra fields of a shape row ride along). */
export type ResultsTableEntry = z.infer<typeof resultsTableEntrySchema>;

/** "Crescente" or "Decrescente". */
export type SortDirection = z.infer<typeof sortDirectionSchema>;

/** Everything the table shows, as the renderer sends it. */
export type ResultsTableData = z.infer<typeof resultsTableDataSchema>;

/** What the table draws with, every setting present (defaults applied). */
export type ResultsTableSettings = {
  /** The item's title, else the page's own name, else "RESULTADO". */
  title: string;
  /** The event beside the title; empty when the item gives none (the line is left out). */
  eventLine: string;
  /** "Colunas mostradas" as typed; empty shows every column. */
  columnsShownText: string;
  /** "Ordenar por" as typed; empty keeps the site's order. */
  sortByColumnText: string;
  sortDirection: SortDirection;
};

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type ResultsTableDataCheck =
  { isValid: true; data: ResultsTableData } | { isValid: false; problem: string };

/**
 * Reads the settings from the data, applying the defaults to whatever was left out or
 * left blank: the title from the page's name, no event line, every column, the site's
 * order, ascending. The one place the defaults live in code.
 */
export function readResultsTableSettings(data: ResultsTableData): ResultsTableSettings {
  return {
    title: chooseTitle(data),
    eventLine: data.eventLine ?? '',
    columnsShownText: data.columnsShown ?? '',
    sortByColumnText: data.sortByColumn ?? '',
    sortDirection: data.sortDirection ?? 'ascending',
  };
}

/** The item's title when it has one that is not blank, else the page's name, else the default. */
function chooseTitle(data: ResultsTableData): string {
  const typedTitle = data.title?.trim() ?? '';
  if (typedTitle !== '') {
    return typedTitle;
  }
  const tableName = data.tableName?.trim() ?? '';
  if (tableName !== '') {
    return tableName;
  }
  return ptBR.defaultTitle;
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteResultsTableData(input: unknown): ResultsTableDataCheck {
  const parsed = resultsTableDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current
 * data is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoResultsTableData(
  currentData: ResultsTableData,
  partialInput: unknown,
): ResultsTableDataCheck {
  const parsedUpdate = partialResultsTableDataSchema.safeParse(partialInput);
  if (!parsedUpdate.success) {
    return {
      isValid: false,
      problem: describeFirstDataProblemInPortuguese(
        partialInput,
        parsedUpdate.error,
        ptBR.validationProblems,
      ),
    };
  }
  const mergedData = { ...currentData, ...parsedUpdate.data };
  return parseCompleteResultsTableData(mergedData);
}
