import { z } from 'zod';

import { ptBRDataShapes } from './ptBRDataShapes.js';

/**
 * One row of a result page, as the site shows it (BAJAOVRLAY-83): the site's own rank,
 * when it has one, the team, and one text cell per column of the page, in the columns'
 * order. The cells are text on purpose: a page writes "SPOILERS", "SIM", "–", "102.5%" or
 * "55.6 / 54.9" where another would write a number, and every one of them goes on air as
 * it is written. Nothing here is ever recomputed from the cells.
 */
export const ResultsTableEntrySchema = z.object({
  /**
   * The rank the site gives the team ("position"), from 1. Absent when the site gives
   * none: during spoilers, or on a page that ranks nobody. Never worked out here.
   */
  rank: z.number().int().min(1).optional(),
  carNumber: z.number().int().positive(),
  teamName: z.string().min(1),
  /** The university, short form when the source has one ("UFPR"). */
  schoolName: z.string().min(1),
  /** One text per column of `columnHeads`, in the same order; "" for an empty cell. */
  cells: z.array(z.string()),
});

/** One row that has passed ResultsTableEntrySchema. */
export type ResultsTableEntry = z.infer<typeof ResultsTableEntrySchema>;

/**
 * The results table shape: one result page with its own columns. `columnHeads` are the
 * page's value columns in order ("Voltas", "Melhor volta", "Pontos"), without the rank,
 * car number and team columns, which every row carries as fields of its own. The rows
 * come in the source's order, which a graphic keeps unless its item asks for another.
 * The one rule: every row has exactly one cell per head, so a cell is never drawn under
 * the wrong column.
 */
export const ResultsTableShapeSchema = z
  .object({
    /** When the source produced this, in ms since 1970 (the server's clock). */
    updatedAtMs: z.number().int().min(0),
    /** The page's own name, as the site writes it: "Geral", "Enduro". */
    tableName: z.string().min(1).optional(),
    /** The heads of the page's value columns, in order; "" for a column with no title. */
    columnHeads: z.array(z.string()),
    entries: z.array(ResultsTableEntrySchema),
  })
  .superRefine((resultsTable, context) => {
    const headCount = resultsTable.columnHeads.length;
    resultsTable.entries.forEach((entry, index) => {
      // A row with one cell too few would shift every cell after the gap one column left.
      if (entry.cells.length !== headCount) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'cells'],
          message: ptBRDataShapes.shapeRuleReasons.cellCountNotHeadCount(headCount),
        });
      }
    });
  });

/** A results table that has passed ResultsTableShapeSchema. */
export type ResultsTableShape = z.infer<typeof ResultsTableShapeSchema>;
