import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { ptBRTransforms } from '../transforms/ptBRTransforms.js';
import { findTransform } from '../transforms/transformRegistry.js';
import type { FlexFieldRule, FlexMappingConfig, FlexShapeMapping } from './flexMappingConfig.js';
import {
  addProblemLine,
  type FlexMappingProblems,
  startFlexMappingProblems,
  summarizeFlexMappingProblems,
} from './flexMappingProblems.js';
import { findMappableField } from './mappableFields.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import {
  listScorePartsOfMappedEntries,
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

/** What a rule needs besides the value it reads: the poll moment, and the place in the list. */
type RuleSurroundings = {
  pollMomentMs: number;
  /** The element's 1-based place in its list; undefined for a shape's own fields. */
  placeInList: number | undefined;
};

/** What one rule gave: a value to set, nothing to set, or a pt-BR problem. */
type RuleOutcome =
  | { outcome: 'set'; value: unknown }
  | { outcome: 'leftOut' }
  | { outcome: 'problem'; detail: string };

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
 * (an unknown target, brackets, an unknown transform) is still a problem here, never a throw.
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
 * shape, one entry per element of the list. Undefined when the shape could not even
 * start (no response, brackets); its problem is already counted.
 */
function mapOneShape(
  mapping: FlexShapeMapping,
  responsesByRequestId: Readonly<Record<string, unknown>>,
  pollMomentMs: number,
  problems: FlexMappingProblems,
): Record<string, unknown> | undefined {
  const lines = ptBRFlexMapping.problemLines;
  const shapeName = ptBRDataShapes.shapeNames[mapping.shapeKey];

  if (mapping.shapeKey === 'brackets') {
    addProblemLine(problems, lines.bracketsNotBuilt(shapeName));
    return undefined;
  }
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
    const entries = mapListEntries(mapping, mapping.entriesPath, response, pollMomentMs, problems);
    if (entries !== undefined) {
      shape.entries = entries;
      addScorePartsOfStandings(mapping.shapeKey, shape, entries);
    }
  }
  return shape;
}

/**
 * Gives standings their parts of the score, built from the teams' points by part (the
 * source sends one list per team; standingsScorePartLists.ts). Other shapes, and standings
 * whose teams have no parts, are left as they are.
 */
function addScorePartsOfStandings(
  shapeKey: DataShapeKey,
  shape: Record<string, unknown>,
  entries: Array<Record<string, unknown>>,
): void {
  if (shapeKey !== 'standings') {
    return;
  }
  const scoreParts = listScorePartsOfMappedEntries(entries);
  if (scoreParts.length > 0) {
    shape.scoreParts = scoreParts;
  }
}

/**
 * Builds the entries of a list shape: finds the list at `entriesPath` in the response and
 * applies the entry rules to each element. Undefined, with a problem, when there is no
 * list there: an empty tower would look like a race with no cars.
 */
function mapListEntries(
  mapping: FlexShapeMapping,
  entriesPath: string,
  response: unknown,
  pollMomentMs: number,
  problems: FlexMappingProblems,
): Array<Record<string, unknown>> | undefined {
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
    mapOneEntry(mapping.shapeKey, entryRules, element, elementIndex, pollMomentMs, problems),
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
  pollMomentMs: number,
  problems: FlexMappingProblems,
): Record<string, unknown> {
  const lines = ptBRFlexMapping.problemLines;
  const shapeName = ptBRDataShapes.shapeNames[shapeKey];
  const lineNumber = elementIndex + 1;
  const surroundingsOfEntry: RuleSurroundings = { pollMomentMs, placeInList: lineNumber };

  const entry: Record<string, unknown> = {};
  const problemsOfEntry: Array<{ fieldLabel: string; detail: string }> = [];
  for (const rule of entryRules) {
    const ruleOutcome = readScorePartListWhenItIsOne(
      shapeKey,
      rule,
      applyOneRule(shapeKey, rule, element, surroundingsOfEntry),
    );
    if (ruleOutcome.outcome === 'problem') {
      const fieldLabel = labelTargetField(shapeKey, rule.targetField);
      problemsOfEntry.push({ fieldLabel, detail: ruleOutcome.detail });
    }
    if (ruleOutcome.outcome === 'set') {
      setValueAtTargetField(entry, rule.targetField, ruleOutcome.value);
    }
  }

  const carNumber = entry.carNumber;
  const entryLabel =
    typeof carNumber === 'number'
      ? lines.entryWithCar(carNumber, lineNumber)
      : lines.entryWithoutCar(lineNumber);
  for (const { fieldLabel, detail } of problemsOfEntry) {
    addProblemLine(problems, lines.atEntryField(shapeName, entryLabel, fieldLabel, detail));
  }
  return entry;
}

/**
 * A standings team's `pointsByPart` arrives as a list of parts, each a label and a value;
 * this turns that list into the points by part the shape carries, or into a problem. Any
 * other rule's outcome is passed on unchanged.
 */
function readScorePartListWhenItIsOne(
  shapeKey: DataShapeKey,
  rule: FlexFieldRule,
  ruleOutcome: RuleOutcome,
): RuleOutcome {
  const isAScorePartList = shapeKey === 'standings' && rule.targetField === 'pointsByPart';
  if (!isAScorePartList || ruleOutcome.outcome !== 'set') {
    return ruleOutcome;
  }
  const reading = readScorePartListIntoPointsByPart(ruleOutcome.value);
  if (!reading.ok) {
    return { outcome: 'problem', detail: reading.reason };
  }
  return { outcome: 'set', value: reading.pointsByPart };
}

/**
 * Applies one rule to its source (the response, or one element of the list): a fixed
 * value, the poll moment, the place in the list, or the value at its path through its
 * transform. A target the shape does not list is a problem, so nothing but a canonical
 * field is ever written.
 */
function applyOneRule(
  shapeKey: DataShapeKey,
  rule: FlexFieldRule,
  source: unknown,
  surroundings: RuleSurroundings,
): RuleOutcome {
  const configReasons = ptBRFlexMapping.configReasons;
  const mappableField = findMappableField(shapeKey, rule.targetField);
  if (mappableField === undefined) {
    const shapeName = ptBRDataShapes.shapeNames[shapeKey];
    return {
      outcome: 'problem',
      detail: configReasons.unknownTargetField(shapeName, rule.targetField),
    };
  }

  if (rule.constantValue !== undefined) {
    return { outcome: 'set', value: rule.constantValue };
  }
  if (rule.fromPollMoment !== undefined) {
    return { outcome: 'set', value: surroundings.pollMomentMs };
  }
  if (rule.fromListOrder !== undefined) {
    if (surroundings.placeInList === undefined) {
      return {
        outcome: 'problem',
        detail: configReasons.listOrderOnlyForEntries(mappableField.label),
      };
    }
    return { outcome: 'set', value: surroundings.placeInList };
  }
  if (rule.fromPath !== undefined) {
    return readRuleValueAtPath(rule, rule.fromPath, source);
  }
  // A rule with no source is refused by the config schema; unchecked, it maps nothing.
  return { outcome: 'leftOut' };
}

/**
 * Reads a rule's value at its path and runs its transform, if it has one. Nothing there,
 * or a null, leaves the field out; a refused path or a refused value is a problem quoting
 * the path ("não consegui ler "ultima_volta": …").
 */
function readRuleValueAtPath(rule: FlexFieldRule, path: string, source: unknown): RuleOutcome {
  const lines = ptBRFlexMapping.problemLines;
  const reading = readValueAtPath(source, path);
  if (reading.outcome === 'pathRefused') {
    return { outcome: 'problem', detail: reading.reason };
  }
  if (reading.outcome === 'nothingThere' || reading.value === null) {
    return { outcome: 'leftOut' };
  }
  if (rule.transformId === undefined) {
    return { outcome: 'set', value: reading.value };
  }

  const transform = findTransform(rule.transformId);
  if (transform === undefined) {
    const reason = ptBRTransforms.parameterReasons.unknownTransform(rule.transformId);
    return { outcome: 'problem', detail: lines.couldNotReadAtPath(path, reason) };
  }
  const transformResult = transform.apply(reading.value, rule.transformParameters);
  if (!transformResult.ok) {
    return { outcome: 'problem', detail: lines.couldNotReadAtPath(path, transformResult.reason) };
  }
  return { outcome: 'set', value: transformResult.value };
}

/** The pt-BR label a problem line shows for a target, or the target itself if unlisted. */
function labelTargetField(shapeKey: DataShapeKey, targetField: string): string {
  return findMappableField(shapeKey, targetField)?.label ?? targetField;
}

/**
 * Writes a value at a target field, creating the nested object of a dotted target:
 * "clock.running" writes `running` inside `clock`, which the earlier clock rules may
 * already have started.
 */
function setValueAtTargetField(
  target: Record<string, unknown>,
  targetField: string,
  value: unknown,
): void {
  const fieldNames = targetField.split('.');
  const lastFieldName = fieldNames.pop();
  if (lastFieldName === undefined) {
    return;
  }

  let container = target;
  for (const fieldName of fieldNames) {
    const existingValue = container[fieldName];
    const isExistingObject =
      typeof existingValue === 'object' && existingValue !== null && !Array.isArray(existingValue);
    if (isExistingObject) {
      container = existingValue as Record<string, unknown>;
    } else {
      const nestedObject: Record<string, unknown> = {};
      container[fieldName] = nestedObject;
      container = nestedObject;
    }
  }
  container[lastFieldName] = value;
}
