import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { groupMappedMatchesIntoRounds } from './bracketRoundsOfMappedMatches.js';
import {
  applyOneRule,
  labelTargetField,
  type RuleOutcome,
  type RuleSurroundings,
  setValueAtTargetField,
} from './flexFieldRuleApplication.js';
import type { FlexFieldRule, FlexMappingConfig, FlexShapeMapping } from './flexMappingConfig.js';
import {
  addProblemLine,
  type FlexMappingProblems,
  startFlexMappingProblems,
  summarizeFlexMappingProblems,
} from './flexMappingProblems.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import {
  listScorePartsOfLabelsMet,
  readScorePartListIntoPointsByPart,
} from './standingsScorePartLists.js';
import { readValueAtPath } from './valuePath.js';

/**
 * The answer of applyFlexMapping: the shapes it built (not yet validated), or the problem
 * lines (the first 20) and the one-line summary the poll error stores.
 */
export type FlexMappingResult =
  | { ok: true; shapes: Partial<Record<DataShapeKey, unknown>> }
  | { ok: false; problems: string[]; summary: string };

/**
 * Maps the responses of one poll into the canonical shapes with a flex source's mapping
 * config. Pure: the poll moment is handed in, so the server and the "Testar" panel get the
 * same answer. Rules:
 * - a path that is missing, or holds null, leaves its field out (the source does not
 *   know); a required field left out is then named by validateDataShape, which every
 *   caller runs next;
 * - a transform that refuses fails the whole mapping: no field is silently dropped;
 * - keys of the response that no rule reads are ignored;
 * - every problem is counted, the first 20 are listed, and the summary is the first one
 *   plus "(e mais N problemas)".
 * The config is expected to have passed FlexMappingConfigSchema; what it would refuse
 * (an unknown target, an unknown transform) is still a problem here, never a throw.
 */
export function applyFlexMapping(
  mappings: FlexMappingConfig,
  responsesByRequestId: Readonly<Record<string, unknown>>,
  pollMomentMs: number,
): FlexMappingResult {
  const problems = startFlexMappingProblems();
  const shapes: Partial<Record<DataShapeKey, unknown>> = {};

  for (const mapping of mappings) {
    const shape = mapOneShape(mapping, responsesByRequestId, pollMomentMs, problems);
    if (shape !== undefined) {
      shapes[mapping.shapeKey] = shape;
    }
  }

  if (problems.totalCount > 0) {
    return {
      ok: false,
      problems: problems.lines,
      summary: summarizeFlexMappingProblems(problems),
    };
  }
  return { ok: true, shapes };
}

/**
 * Builds one shape from its request's response: its own fields first, then, for a list
 * shape, one entry per element of the list (for brackets, one match, grouped into rounds).
 * Undefined when the shape could not even start (no response); its problem is counted.
 */
function mapOneShape(
  mapping: FlexShapeMapping,
  responsesByRequestId: Readonly<Record<string, unknown>>,
  pollMomentMs: number,
  problems: FlexMappingProblems,
): Record<string, unknown> | undefined {
  const lines = ptBRFlexMapping.problemLines;
  const shapeName = ptBRDataShapes.shapeNames[mapping.shapeKey];

  if (!Object.hasOwn(responsesByRequestId, mapping.requestId)) {
    addProblemLine(problems, lines.noResponseForRequest(shapeName, mapping.requestId));
    return undefined;
  }
  const response = responsesByRequestId[mapping.requestId];

  const shape: Record<string, unknown> = {};
  const surroundingsOfShape: RuleSurroundings = { pollMomentMs, placeInList: undefined };
  for (const rule of mapping.fields) {
    const fieldLabel = labelTargetField(mapping.shapeKey, rule.targetField);
    const ruleOutcome = applyOneRule(mapping.shapeKey, rule, response, surroundingsOfShape);
    if (ruleOutcome.outcome === 'problem') {
      addProblemLine(problems, lines.atTopLevelField(shapeName, fieldLabel, ruleOutcome.detail));
    }
    if (ruleOutcome.outcome === 'set') {
      setValueAtTargetField(shape, rule.targetField, ruleOutcome.value);
    }
  }

  if (mapping.entriesPath !== undefined) {
    // Every label of the teams' score part lists, in the order met, filled while the
    // entries are mapped: a part with no value is in it too, so its column stays.
    const scorePartLabelsMet: string[] = [];
    const entries = mapListEntries(mapping, mapping.entriesPath, response, {
      pollMomentMs,
      problems,
      scorePartLabelsMet,
    });
    if (entries !== undefined) {
      placeMappedEntriesInTheirShape(mapping.shapeKey, shape, entries, {
        scorePartLabelsMet,
        problems,
      });
    }
  }
  return shape;
}

/**
 * Puts a list shape's mapped entries where its shape holds them: brackets group their
 * matches into rounds (bracketRoundsOfMappedMatches.ts), a match naming no round being a
 * problem; every other list shape keeps them as `entries`, and standings get their parts
 * of the score, one per label the teams' lists named, a part with no value included.
 */
function placeMappedEntriesInTheirShape(
  shapeKey: DataShapeKey,
  shape: Record<string, unknown>,
  entries: Array<Record<string, unknown>>,
  context: { scorePartLabelsMet: string[]; problems: FlexMappingProblems },
): void {
  if (shapeKey === 'brackets') {
    const grouping = groupMappedMatchesIntoRounds(entries);
    shape.rounds = grouping.rounds;
    const lines = ptBRFlexMapping.problemLines;
    const roundNameLabel = labelTargetField(shapeKey, 'roundName');
    for (const lineNumber of grouping.linesWithoutRoundName) {
      const entryLabel = labelEntryOfList(entries[lineNumber - 1] ?? {}, lineNumber);
      const detail = lines.matchWithoutRoundName;
      addProblemLine(
        context.problems,
        lines.atEntryField(ptBRDataShapes.shapeNames.brackets, entryLabel, roundNameLabel, detail),
      );
    }
    return;
  }
  shape.entries = entries;
  if (shapeKey !== 'standings') {
    return;
  }
  const scoreParts = listScorePartsOfLabelsMet(context.scorePartLabelsMet);
  if (scoreParts.length > 0) {
    shape.scoreParts = scoreParts;
  }
}

/** What mapping the entries of a list shape works with besides the list itself. */
type EntryMappingContext = {
  pollMomentMs: number;
  problems: FlexMappingProblems;
  /** Filled with every score part label the entries' lists name, in the order met. */
  scorePartLabelsMet: string[];
};

/**
 * Builds the entries of a list shape: finds the list at `entriesPath` in the response and
 * applies the entry rules to each element. Undefined, with a problem, when there is no
 * list there: an empty tower would look like a race with no cars.
 */
function mapListEntries(
  mapping: FlexShapeMapping,
  entriesPath: string,
  response: unknown,
  context: EntryMappingContext,
): Array<Record<string, unknown>> | undefined {
  const problems = context.problems;
  const lines = ptBRFlexMapping.problemLines;
  const shapeName = ptBRDataShapes.shapeNames[mapping.shapeKey];

  const listReading = readValueAtPath(response, entriesPath);
  if (listReading.outcome === 'pathRefused') {
    addProblemLine(problems, lines.atShape(shapeName, listReading.reason));
    return undefined;
  }
  if (listReading.outcome === 'nothingThere' || !Array.isArray(listReading.value)) {
    addProblemLine(problems, lines.noListAtPath(shapeName, entriesPath, mapping.requestId));
    return undefined;
  }

  const listElements: unknown[] = listReading.value;
  const entryRules = mapping.entryFields ?? [];
  return listElements.map((element, elementIndex) =>
    mapOneEntry(mapping.shapeKey, entryRules, element, elementIndex, context),
  );
}

/**
 * Builds one entry from one element of the list. Its problems are written once the whole
 * entry is built, so each line can name the car by its number ("carro 7 (linha 3)") even
 * when the car number rule comes after the broken one; by its line alone when the number
 * itself could not be read.
 */
function mapOneEntry(
  shapeKey: DataShapeKey,
  entryRules: FlexFieldRule[],
  element: unknown,
  elementIndex: number,
  context: EntryMappingContext,
): Record<string, unknown> {
  const lines = ptBRFlexMapping.problemLines;
  const shapeName = ptBRDataShapes.shapeNames[shapeKey];
  const lineNumber = elementIndex + 1;
  const surroundingsOfEntry: RuleSurroundings = {
    pollMomentMs: context.pollMomentMs,
    placeInList: lineNumber,
  };

  const entry: Record<string, unknown> = {};
  const problemsOfEntry: Array<{ targetField: string; detail: string }> = [];
  for (const rule of entryRules) {
    const ruleOutcome = readScorePartListWhenItIsOne(
      shapeKey,
      rule,
      applyOneRule(shapeKey, rule, element, surroundingsOfEntry),
      context.scorePartLabelsMet,
    );
    if (ruleOutcome.outcome === 'problem') {
      problemsOfEntry.push({ targetField: rule.targetField, detail: ruleOutcome.detail });
    }
    if (ruleOutcome.outcome === 'set') {
      setValueAtTargetField(entry, rule.targetField, ruleOutcome.value);
    }
  }
  const problemsKept = dropTheRankOfADisqualifiedTeam(shapeKey, entry, problemsOfEntry);

  const entryLabel = labelEntryOfList(entry, lineNumber);
  for (const { targetField, detail } of problemsKept) {
    const fieldLabel = labelTargetField(shapeKey, targetField);
    addProblemLine(context.problems, lines.atEntryField(shapeName, entryLabel, fieldLabel, detail));
  }
  return entry;
}

/**
 * How a problem line names an entry: a bracket match by its id ("disputa r1-m2 (linha 2)"),
 * since it has two cars; any other entry by its car ("carro 7 (linha 3)"); by its line
 * alone when neither could be read.
 */
function labelEntryOfList(entry: Record<string, unknown>, lineNumber: number): string {
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
 * still writes one ("51º" beside "Desclassificada"), so a rank rule would fill it and the
 * shape would refuse the whole poll: the source would go stale over one team. So when the
 * mapped `isDisqualified` is true the rank is dropped, with any problem its rule had, since
 * that value is discarded anyway (gate 2 of PR #25, João's call). Gives back the problems
 * to report; any other entry is left as it is.
 */
function dropTheRankOfADisqualifiedTeam(
  shapeKey: DataShapeKey,
  entry: Record<string, unknown>,
  problemsOfEntry: Array<{ targetField: string; detail: string }>,
): Array<{ targetField: string; detail: string }> {
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
