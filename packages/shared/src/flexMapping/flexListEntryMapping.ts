/**
 * One entry of a list shape built from one element (split from applyFlexMapping.ts by
 * BAJAOVRLAY-53): every entry rule applied with the entry's surroundings (its outer
 * element, its lookups' matches, its cells), the parts of the score read from columns or
 * from a list, a disqualified team's rank dropped, and the entry's problem lines, kept
 * aside so the shape reports only the entries it keeps.
 */
import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import type { EntryElement } from './flexEntryElements.js';
import {
  applyOneRule,
  labelTargetField,
  type RuleOutcome,
  type RuleSurroundings,
  setValueAtTargetField,
} from './flexFieldRuleApplication.js';
import { findLookupMatchesOfEntry, type IndexedLookup } from './flexLookups.js';
import type { FlexFieldRule, FlexShapeMapping } from './flexMappingConfig.js';
import { readCellsOfEntry } from './flexTableColumns.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import {
  readScorePartListIntoPointsByPart,
  readScorePartsFromColumns,
} from './standingsScorePartLists.js';
import { readValueAtPath } from './valuePath.js';

/** What every entry of one shape is mapped with: the shape-wide readings, made once. */
export type EntryMappingContext = {
  mapping: FlexShapeMapping;
  pollMomentMs: number;
  indexedLookups: IndexedLookup[];
  columnPlaceByHeader: ReadonlyMap<string, number>;
  /** Filled with every score part label the entries' lists name, in the order met. */
  scorePartLabelsMet: string[];
};

/** A problem of one entry's field, before the entry is labelled for its problem line. */
type ProblemOfEntry = { fieldLabel: string; targetField: string; detail: string };

/** One entry as mapped, with its problems, written once the shape knows which entries it keeps. */
export type MappedEntry = {
  entry: Record<string, unknown>;
  problemLines: string[];
  isIncomplete: boolean;
};

/**
 * Builds one entry from one element. Its problem lines are written once the whole entry
 * is built, so each can name the car by its number ("carro 7 (linha 3)") even when the
 * car number rule comes after the broken one; by its line alone when the number itself
 * could not be read.
 */
export function mapOneEntry(
  entryElement: EntryElement,
  elementIndex: number,
  context: EntryMappingContext,
): MappedEntry {
  const { mapping } = context;
  const shapeKey = mapping.shapeKey;
  const lines = ptBRFlexMapping.problemLines;
  const shapeName = ptBRDataShapes.shapeNames[shapeKey];
  const lineNumber = elementIndex + 1;
  const { element, parentElement } = entryElement;
  const cellsOfEntry =
    mapping.table === undefined ? undefined : readCellsOfEntry(mapping.table, element);
  const surroundingsOfEntry: RuleSurroundings = {
    pollMomentMs: context.pollMomentMs,
    placeInList: lineNumber,
    parentElement,
    lookupMatches: findLookupMatchesOfEntry(context.indexedLookups, element),
    cellsOfEntry,
    columnPlaceByHeader: context.columnPlaceByHeader,
  };

  const entry: Record<string, unknown> = {};
  const problemsOfEntry: ProblemOfEntry[] = [];
  for (const rule of mapping.entryFields ?? []) {
    const ruleOutcome = readScorePartListWhenItIsOne(
      shapeKey,
      rule,
      applyOneRule(shapeKey, rule, element, surroundingsOfEntry),
      context.scorePartLabelsMet,
    );
    if (ruleOutcome.outcome === 'problem') {
      const fieldLabel = labelTargetField(shapeKey, rule.targetField);
      problemsOfEntry.push({
        fieldLabel,
        targetField: rule.targetField,
        detail: ruleOutcome.detail,
      });
    }
    if (ruleOutcome.outcome === 'set') {
      setValueAtTargetField(entry, rule.targetField, ruleOutcome.value);
    }
  }
  if (mapping.scorePartsFromColumns !== undefined) {
    const partsReading = readScorePartsFromColumns(
      cellsOfEntry,
      context.columnPlaceByHeader,
      mapping.scorePartsFromColumns,
    );
    if (partsReading.ok) {
      entry.pointsByPart = partsReading.pointsByPart;
    } else {
      const fieldLabel = lines.scorePartsFromColumnsLabel;
      problemsOfEntry.push({
        fieldLabel,
        targetField: 'pointsByPart',
        detail: partsReading.reason,
      });
    }
  }
  const problemsKept = dropTheRankOfADisqualifiedTeam(shapeKey, entry, problemsOfEntry);

  const entryLabel = labelEntryOfList(entry, lineNumber);
  const problemLines = problemsKept.map(({ fieldLabel, detail }) =>
    lines.atEntryField(shapeName, entryLabel, fieldLabel, detail),
  );
  const isIncomplete = isEntryIncomplete(mapping, element);
  return { entry, problemLines, isIncomplete };
}

/** Says whether any of the mapping's incomplete-entry conditions holds for this element. */
function isEntryIncomplete(mapping: FlexShapeMapping, element: unknown): boolean {
  return (mapping.entryIsIncompleteWhen ?? []).some((condition) => {
    const reading = readValueAtPath(element, condition.path);
    if (reading.outcome !== 'found') {
      return false;
    }
    return condition.isOneOf.some((value) => value === reading.value);
  });
}

/**
 * How a problem line names an entry: a bracket match by its id ("disputa r1-m2 (linha 2)"),
 * since it has two cars; any other entry by its car ("carro 7 (linha 3)"); by its line
 * alone when neither could be read.
 */
export function labelEntryOfList(entry: Record<string, unknown>, lineNumber: number): string {
  const lines = ptBRFlexMapping.problemLines;
  if (typeof entry.matchId === 'string') {
    return lines.entryWithMatch(entry.matchId, lineNumber);
  }
  if (typeof entry.carNumber === 'number') {
    return lines.entryWithCar(entry.carNumber, lineNumber);
  }
  return lines.entryWithoutCar(lineNumber);
}

/**
 * A disqualified standings team has no rank (a rule of the shape), but the real export
 * still writes one ("51º" beside "Desclassificada"; the Baja API's "position 50"), so a
 * rank rule would fill it and the shape would refuse the whole poll: the source would go
 * stale over one team. So when the mapped `isDisqualified` is true the rank is dropped,
 * with any problem its rule had, since that value is discarded anyway (gate 2 of PR #25,
 * João's call). Gives back the problems to report; any other entry is left as it is.
 */
function dropTheRankOfADisqualifiedTeam(
  shapeKey: DataShapeKey,
  entry: Record<string, unknown>,
  problemsOfEntry: ProblemOfEntry[],
): ProblemOfEntry[] {
  const isADisqualifiedTeam = shapeKey === 'standings' && entry.isDisqualified === true;
  if (!isADisqualifiedTeam) {
    return problemsOfEntry;
  }
  delete entry.rank;
  return problemsOfEntry.filter((problem) => problem.targetField !== 'rank');
}

/**
 * A standings team's `pointsByPart` arrives as a list of parts, each a label and a value;
 * this turns that list into the points by part the shape carries, or into a problem, and
 * adds the list's labels (a part with no value too) to `scorePartLabelsMet`. Any other
 * rule's outcome is passed on unchanged.
 */
function readScorePartListWhenItIsOne(
  shapeKey: DataShapeKey,
  rule: FlexFieldRule,
  ruleOutcome: RuleOutcome,
  scorePartLabelsMet: string[],
): RuleOutcome {
  const isAScorePartList = shapeKey === 'standings' && rule.targetField === 'pointsByPart';
  if (!isAScorePartList || ruleOutcome.outcome !== 'set') {
    return ruleOutcome;
  }
  const reading = readScorePartListIntoPointsByPart(ruleOutcome.value);
  if (!reading.ok) {
    return { outcome: 'problem', detail: reading.reason };
  }
  scorePartLabelsMet.push(...reading.labelsInOrder);
  return { outcome: 'set', value: reading.pointsByPart };
}
