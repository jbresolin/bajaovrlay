/**
 * What a shape's mapping may declare beside its rules (BAJAOVRLAY-53): lookups (lists
 * joined by key), the layout of a table of columns and positional cells, standings' parts
 * read from columns, a flag that refuses the whole answer, and the conditions that mark a
 * bracket match incomplete. Generic on purpose: no source's word, field or endpoint is
 * written here, only in its preset.
 */
import { z } from 'zod';

import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { parseValuePath } from './valuePath.js';

// A short plain name, like a request id: "equipes".
const lookupNamePattern = /^[A-Za-z0-9_-]{1,40}$/;

/** A path field: text that the hand-written path parser reads. */
function pathFieldOfOption() {
  return z
    .string()
    .min(1)
    .superRefine((path, context) => {
      const pathParsing = parseValuePath(path);
      if (!pathParsing.ok) {
        context.addIssue({ code: 'custom', message: pathParsing.reason });
      }
    });
}

/**
 * A list joined by key. Each poll, the list at `listPath` in the response of `requestId`
 * is indexed by the value at `keyPath` in each element; an entry's value at
 * `entryKeyPath` picks its element, by strict equality (13 is not "13"). One level only:
 * a lookup cannot read another lookup.
 */
export const FlexLookupSchema = z.strictObject({
  lookupName: z
    .string()
    .min(1)
    .superRefine((lookupName, context) => {
      if (!lookupNamePattern.test(lookupName)) {
        context.addIssue({
          code: 'custom',
          message: ptBRFlexMapping.configReasons.badLookupName(lookupName),
        });
      }
    }),
  requestId: z.string().min(1),
  listPath: pathFieldOfOption(),
  keyPath: pathFieldOfOption(),
  entryKeyPath: pathFieldOfOption(),
});

/** One lookup after it has passed FlexLookupSchema. */
export type FlexLookup = z.infer<typeof FlexLookupSchema>;

/**
 * Where a table answer keeps its columns: the list of columns (`columnsPath`, on the
 * response), each column's header (`headerPath`, on a column) and each entry's cells
 * (`cellsPath`, on an entry), one cell per column in the columns' order. A rule then reads
 * a cell by its column's header, so a column the organisers add does not shift the rest.
 */
export const FlexTableLayoutSchema = z.strictObject({
  columnsPath: pathFieldOfOption(),
  headerPath: pathFieldOfOption(),
  cellsPath: pathFieldOfOption(),
});

/** A table layout after it has passed FlexTableLayoutSchema. */
export type FlexTableLayout = z.infer<typeof FlexTableLayoutSchema>;

/**
 * Standings' parts of the score read from columns: one part per header the operator
 * picks, in that order, each header being the part's label and id; `valuePath` reads the
 * number inside each cell (`raw`). Needs the mapping's table layout.
 */
export const FlexScorePartsFromColumnsSchema = z.strictObject({
  headers: z.array(z.string().min(1)).min(1),
  valuePath: pathFieldOfOption().optional(),
});

/** Score parts from columns after they have passed FlexScorePartsFromColumnsSchema. */
export type FlexScorePartsFromColumns = z.infer<typeof FlexScorePartsFromColumnsSchema>;

/** A value a refusal compares with, strictly: text, a number, a boolean or null. */
const RefusalValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * Refuses the whole answer by the value at `path` (on the response), compared one of two
 * ways: it equals `equals`, or it is found and is none of `notOneOf` (a word list that may
 * grow, refused loudly rather than guessed at; gate 2 of PR #38). The poll fails with
 * `message`, written by the operator in pt-BR, `{valor}` in it replaced by the value read,
 * and the last good snapshot stays on air. For an answer that is right but must not be
 * shown, such as results whose organisers hide the positions for now, or one the preset
 * cannot read safely yet.
 */
export const FlexRefusalFlagSchema = z
  .strictObject({
    path: pathFieldOfOption(),
    equals: RefusalValueSchema.optional(),
    notOneOf: z
      .array(RefusalValueSchema)
      .min(1, { error: ptBRFlexMapping.configReasons.refusalKnownValuesEmpty })
      .optional(),
    message: z.string().min(1, { error: ptBRFlexMapping.configReasons.refusalNeedsMessage }),
  })
  .superRefine((refusal, context) => {
    // `equals: null` is a comparison with null, so the key's presence decides, not its value.
    const comparesByEquality = Object.hasOwn(refusal, 'equals');
    const comparesByAList = refusal.notOneOf !== undefined;
    if (comparesByEquality === comparesByAList) {
      context.addIssue({
        code: 'custom',
        path: [],
        message: ptBRFlexMapping.configReasons.refusalComparesOneWay,
      });
    }
  });

/** A refusal flag after it has passed FlexRefusalFlagSchema. */
export type FlexRefusalFlag = z.infer<typeof FlexRefusalFlagSchema>;

/**
 * Marks a bracket match incomplete when the value at `path` (on the match) is one of
 * `isOneOf`, strictly equal: a side still pending, say. The first round holding an
 * incomplete match is left out, with every round after it (contract A, on our side).
 */
export const FlexIncompleteEntryConditionSchema = z.strictObject({
  path: pathFieldOfOption(),
  isOneOf: z.array(z.union([z.string(), z.number(), z.boolean()])).min(1),
});

/** One incomplete-entry condition after it has passed FlexIncompleteEntryConditionSchema. */
export type FlexIncompleteEntryCondition = z.infer<typeof FlexIncompleteEntryConditionSchema>;
