import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { keepWholeRoundsWithTheThirdPlaceBeforeTheFinal } from './bracketRoundsContracts.js';
import { groupMappedMatchesIntoRounds } from './bracketRoundsOfMappedMatches.js';
import { listEntryElements } from './flexEntryElements.js';
import {
  applyOneRule,
  buildSurroundingsOfShape,
  labelTargetField,
  setValueAtTargetField,
} from './flexFieldRuleApplication.js';
import {
  type EntryMappingContext,
  labelEntryOfList,
  mapOneEntry,
  type MappedEntry,
} from './flexListEntryMapping.js';
import { indexLookups } from './flexLookups.js';
import type { FlexMappingConfig, FlexShapeMapping } from './flexMappingConfig.js';
import {
  addProblemLine,
  type FlexMappingProblems,
  startFlexMappingProblems,
  summarizeFlexMappingProblems,
} from './flexMappingProblems.js';
import { findRefusalsByFlag } from './flexRefusalFlag.js';
import {
  findHeadersMissingFromTable,
  listHeadersReadByMapping,
  readColumnPlacesByHeader,
} from './flexTableColumns.js';
import { addGapsWorkedOutFromLaps } from './gapsFromLaps.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { listScorePartsOfLabelsMet } from './standingsScorePartLists.js';

/**
 * The answer of applyFlexMapping: the shapes it built (not yet validated), or the problem
 * lines (the first 20) and the one-line summary the poll error stores. `isRefusedByAFlag`
 * says the answer was refused by a mapping's refuseWhen: the problems are then the
 * operator's own sentences, which "Testar" shows as they are.
 */
export type FlexMappingResult =
  | { ok: true; shapes: Partial<Record<DataShapeKey, unknown>> }
  | { ok: false; isRefusedByAFlag: boolean; problems: string[]; summary: string };

/**
 * Maps the responses of one poll into the canonical shapes with a flex source's mapping
 * config. Pure: the poll moment is handed in, so the server and the "Testar" panel get the
 * same answer. Rules:
 * - a mapping whose refuseWhen flag is raised fails the whole mapping with its sentence
 *   alone, before any shape is built (flexRefusalFlag.ts);
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
  const refusalMessages = findRefusalsByFlag(mappings, responsesByRequestId);
  const firstRefusalMessage = refusalMessages[0];
  if (firstRefusalMessage !== undefined) {
    return {
      ok: false,
      isRefusedByAFlag: true,
      problems: refusalMessages,
      summary: firstRefusalMessage,
    };
  }

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
      isRefusedByAFlag: false,
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
  const surroundingsOfShape = buildSurroundingsOfShape(pollMomentMs);
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
    mapEntriesIntoShape(mapping, mapping.entriesPath, shape, {
      response,
      responsesByRequestId,
      pollMomentMs,
      problems,
    });
  }
  return shape;
}

/** What mapping the entries of a list shape reads, besides the mapping itself. */
type EntriesInput = {
  response: unknown;
  responsesByRequestId: Readonly<Record<string, unknown>>;
  pollMomentMs: number;
  problems: FlexMappingProblems;
};

/**
 * Builds a list shape's entries and puts them in the shape: lists the elements (a nested
 * list too), indexes the lookups and reads the table's columns once, maps every element,
 * then places the entries (brackets grouped into rounds, gaps worked out for positions,
 * standings' parts listed).
 */
function mapEntriesIntoShape(
  mapping: FlexShapeMapping,
  entriesPath: string,
  shape: Record<string, unknown>,
  input: EntriesInput,
): void {
  const { problems } = input;
  const lines = ptBRFlexMapping.problemLines;
  const shapeName = ptBRDataShapes.shapeNames[mapping.shapeKey];

  const listing = listEntryElements(mapping, entriesPath, input.response, shapeName);
  if (!listing.ok) {
    addProblemLine(problems, listing.problemLine);
    return;
  }
  for (const problemLine of listing.problemLines) {
    addProblemLine(problems, problemLine);
  }

  const lookupIndexing = indexLookups(mapping.lookups ?? [], input.responsesByRequestId);
  for (const { lookupName, detail } of lookupIndexing.problems) {
    addProblemLine(problems, lines.atLookup(shapeName, lookupName, detail));
  }
  const columnPlaceByHeader = readColumnsOfTable(mapping, input.response, problems);

  const context: EntryMappingContext = {
    mapping,
    pollMomentMs: input.pollMomentMs,
    indexedLookups: lookupIndexing.indexedLookups,
    columnPlaceByHeader,
    scorePartLabelsMet: [],
  };
  const mappedEntries = listing.entryElements.map((entryElement, elementIndex) =>
    mapOneEntry(entryElement, elementIndex, context),
  );
  placeMappedEntriesInTheirShape(shape, mappedEntries, context, problems);
}

/**
 * Reads the table's columns by header, when the mapping reads a table: no columns list,
 * or a header the mapping reads that the table lacks, is one problem for the whole shape.
 */
function readColumnsOfTable(
  mapping: FlexShapeMapping,
  response: unknown,
  problems: FlexMappingProblems,
): ReadonlyMap<string, number> {
  const lines = ptBRFlexMapping.problemLines;
  const shapeName = ptBRDataShapes.shapeNames[mapping.shapeKey];
  if (mapping.table === undefined) {
    return new Map();
  }
  const columnPlaceByHeader = readColumnPlacesByHeader(mapping.table, response);
  if (columnPlaceByHeader === undefined) {
    const line = lines.noColumnsListAtPath(shapeName, mapping.table.columnsPath, mapping.requestId);
    addProblemLine(problems, line);
    return new Map();
  }
  const headersRead = listHeadersReadByMapping(mapping);
  for (const header of findHeadersMissingFromTable(headersRead, columnPlaceByHeader)) {
    addProblemLine(problems, lines.tableWithoutHeader(shapeName, header));
  }
  return columnPlaceByHeader;
}

/**
 * Puts a list shape's mapped entries where its shape holds them, and writes the problems
 * of the entries it keeps:
 * - brackets group their matches into rounds (bracketRoundsOfMappedMatches.ts), keep whole
 *   rounds with the third place before the final (bracketRoundsContracts.ts), and report
 *   the problems of the kept rounds' matches only, plus any match naming no round;
 * - positions work out their gaps when the mapping says so (gapsFromLaps.ts);
 * - every other list shape keeps its entries as `entries`, and standings get their parts
 *   of the score: from the picked columns, or one per label the teams' lists named.
 */
function placeMappedEntriesInTheirShape(
  shape: Record<string, unknown>,
  mappedEntries: MappedEntry[],
  context: EntryMappingContext,
  problems: FlexMappingProblems,
): void {
  const { mapping } = context;
  const entries = mappedEntries.map((mappedEntry) => mappedEntry.entry);
  if (mapping.shapeKey === 'brackets') {
    // A match left with one car is a bye only when the mapping reads a second one at all.
    const doesTheMappingReadCarB = (mapping.entryFields ?? []).some((rule) =>
      rule.targetField.startsWith('carB.'),
    );
    placeMatchesInRounds(shape, mappedEntries, doesTheMappingReadCarB, problems);
    return;
  }

  for (const mappedEntry of mappedEntries) {
    for (const problemLine of mappedEntry.problemLines) {
      addProblemLine(problems, problemLine);
    }
  }
  if (mapping.shapeKey === 'positions') {
    // The gaps step also takes lastPassAtMs off every car, which the shape does not have.
    shape.entries =
      mapping.workOutGapsFromLaps === true ? addGapsWorkedOutFromLaps(entries) : entries;
    return;
  }
  shape.entries = entries;
  if (mapping.shapeKey !== 'standings') {
    return;
  }
  const partLabels = mapping.scorePartsFromColumns?.headers ?? context.scorePartLabelsMet;
  const scoreParts = listScorePartsOfLabelsMet(partLabels);
  if (scoreParts.length > 0) {
    shape.scoreParts = scoreParts;
  }
}

/**
 * Groups the matches into rounds, applies contracts A and C, and reports the problems of
 * the matches in the rounds kept: a match left out with its round (a pending side that its
 * rules cannot read, say) is no problem, since nothing of it reaches the air.
 */
function placeMatchesInRounds(
  shape: Record<string, unknown>,
  mappedEntries: MappedEntry[],
  doesTheMappingReadCarB: boolean,
  problems: FlexMappingProblems,
): void {
  const lines = ptBRFlexMapping.problemLines;
  const entries = mappedEntries.map((mappedEntry) => mappedEntry.entry);
  const isMatchIncomplete = mappedEntries.map((mappedEntry) => mappedEntry.isIncomplete);
  const grouping = groupMappedMatchesIntoRounds(entries, isMatchIncomplete, {
    isAOneCarMatchABye: doesTheMappingReadCarB,
  });
  const roundsKept = keepWholeRoundsWithTheThirdPlaceBeforeTheFinal(grouping.groupedRounds);
  shape.rounds = roundsKept.map((groupedRound) => groupedRound.round);

  const linesOfMatchesKept = roundsKept.flatMap((groupedRound) => groupedRound.matchLineNumbers);
  for (const lineNumber of linesOfMatchesKept) {
    for (const problemLine of mappedEntries[lineNumber - 1]?.problemLines ?? []) {
      addProblemLine(problems, problemLine);
    }
  }
  const roundNameLabel = labelTargetField('brackets', 'roundName');
  for (const lineNumber of grouping.linesWithoutRoundName) {
    const entryLabel = labelEntryOfList(entries[lineNumber - 1] ?? {}, lineNumber);
    const shapeName = ptBRDataShapes.shapeNames.brackets;
    const detail = lines.matchWithoutRoundName;
    addProblemLine(problems, lines.atEntryField(shapeName, entryLabel, roundNameLabel, detail));
  }
}
