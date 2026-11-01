/**
 * One rule of a flex mapping applied to its source (the response, or one element of a
 * list): a fixed value, the poll moment, the place in the list, or a value read (at a
 * path, on the outer element, on a lookup's match, in a column, or the first of its
 * alternatives) through its transform; and the writing of that value at a dotted target,
 * text cleaned up (sourceTextCleanup.ts). Split from applyFlexMapping.ts (BAJAOVRLAY-25),
 * which walks the shapes and their lists and calls these for every rule.
 */
import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { ptBRTransforms } from '../transforms/ptBRTransforms.js';
import { findTransform } from '../transforms/transformRegistry.js';
import type { FlexFieldRule } from './flexMappingConfig.js';
import type { FlexAlternativeSource } from './flexRuleSources.js';
import { readCellUnderHeader } from './flexTableColumns.js';
import { findMappableField } from './mappableFields.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { cleanUpTextFromASource } from './sourceTextCleanup.js';
import { readValueAtPath, type ValueAtPath } from './valuePath.js';

/**
 * What a rule needs besides the value it reads: the poll moment, the place in the list,
 * and for an entry the outer element, the lookups' matches and the cells by header.
 */
export type RuleSurroundings = {
  pollMomentMs: number;
  /** The element's 1-based place in its list; undefined for a shape's own fields. */
  placeInList: number | undefined;
  /** The outer element of a nested list; undefined for a flat list or the shape's fields. */
  parentElement: unknown;
  /** The element each lookup matched for this entry, by lookup name; absent when none. */
  lookupMatches: ReadonlyMap<string, unknown>;
  /** This entry's cells, when the mapping reads a table; undefined otherwise. */
  cellsOfEntry: unknown[] | undefined;
  /** Each column's place in the cells, by its cleaned-up header. */
  columnPlaceByHeader: ReadonlyMap<string, number>;
};

/** The surroundings of a shape's own fields: no list, no lookup, no table. */
export function buildSurroundingsOfShape(pollMomentMs: number): RuleSurroundings {
  return {
    pollMomentMs,
    placeInList: undefined,
    parentElement: undefined,
    lookupMatches: new Map(),
    cellsOfEntry: undefined,
    columnPlaceByHeader: new Map(),
  };
}

/** What one rule gave: a value to set, nothing to set, or a pt-BR problem. */
export type RuleOutcome =
  | { outcome: 'set'; value: unknown }
  | { outcome: 'leftOut' }
  | { outcome: 'problem'; detail: string };

/**
 * Applies one rule to its source (the response, or one element of the list). A target the
 * shape does not list is a problem, so nothing but a canonical field is ever written. Text
 * that is set is cleaned up (entities decoded, spaces collapsed, ends trimmed), and text
 * that cleans up to nothing is left out.
 */
export function applyOneRule(
  shapeKey: DataShapeKey,
  rule: FlexFieldRule,
  source: unknown,
  surroundings: RuleSurroundings,
): RuleOutcome {
  const ruleOutcome = applyOneRuleAsRead(shapeKey, rule, source, surroundings);
  if (ruleOutcome.outcome !== 'set' || typeof ruleOutcome.value !== 'string') {
    return ruleOutcome;
  }
  // Text that cleans up to nothing ("&nbsp;", spaces) is left out, never written as "": the
  // source does not know the value, as with a null, so a required field is named as missing
  // and an optional one stays valid (gate 2 of PR #35). firstOf treats a blank the same way.
  const cleanedText = cleanUpTextFromASource(ruleOutcome.value);
  if (cleanedText === '') {
    return { outcome: 'leftOut' };
  }
  return { outcome: 'set', value: cleanedText };
}

/** Applies one rule, giving its value as read (or transformed), not yet cleaned up. */
function applyOneRuleAsRead(
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
  if (rule.firstOf !== undefined) {
    return readFirstOfTheAlternatives(rule, rule.firstOf, source, surroundings);
  }
  // A path of any kind: read it; nothing there, or a null, leaves the field out.
  const reading = readOneSource(rule, source, surroundings);
  if (reading.outcome === 'pathRefused') {
    return { outcome: 'problem', detail: reading.reason };
  }
  if (reading.outcome === 'nothingThere' || reading.value === null) {
    return { outcome: 'leftOut' };
  }
  return runTransformOfRule(rule, describeWhereRead(rule), reading.value);
}

/**
 * Tries the alternatives in order: the first value present, not null and not blank text
 * (once cleaned up, so "&nbsp;" is blank) wins. A fixed value wins as it is; a value read
 * goes through the rule's transform. None present leaves the field out.
 */
function readFirstOfTheAlternatives(
  rule: FlexFieldRule,
  alternatives: FlexAlternativeSource[],
  source: unknown,
  surroundings: RuleSurroundings,
): RuleOutcome {
  for (const alternative of alternatives) {
    if (alternative.constantValue !== undefined) {
      return { outcome: 'set', value: alternative.constantValue };
    }
    const reading = readOneSource(alternative, source, surroundings);
    if (reading.outcome === 'pathRefused') {
      return { outcome: 'problem', detail: reading.reason };
    }
    if (reading.outcome === 'found' && isAValuePresent(reading.value)) {
      return runTransformOfRule(rule, describeWhereRead(alternative), reading.value);
    }
  }
  return { outcome: 'leftOut' };
}

/** Says whether a value counts as present for an alternative: not null, not blank text. */
function isAValuePresent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return cleanUpTextFromASource(value) !== '';
  }
  return true;
}

/**
 * Reads the one path-like source of a rule or alternative: on the source itself, on the
 * outer element, on the element a lookup matched (nothing there when it matched none), or
 * in the cell under a column's header.
 */
function readOneSource(
  sourceOfRule: FlexAlternativeSource,
  source: unknown,
  surroundings: RuleSurroundings,
): ValueAtPath {
  if (sourceOfRule.fromPath !== undefined) {
    return readValueAtPath(source, sourceOfRule.fromPath);
  }
  if (sourceOfRule.fromParent !== undefined) {
    return readValueAtPath(surroundings.parentElement, sourceOfRule.fromParent);
  }
  if (sourceOfRule.fromLookup !== undefined) {
    const matchedElement = surroundings.lookupMatches.get(sourceOfRule.fromLookup.lookup);
    if (matchedElement === undefined) {
      return { outcome: 'nothingThere' };
    }
    return readValueAtPath(matchedElement, sourceOfRule.fromLookup.path);
  }
  if (sourceOfRule.fromColumn !== undefined) {
    return readCellUnderHeader(
      surroundings.cellsOfEntry,
      surroundings.columnPlaceByHeader,
      sourceOfRule.fromColumn,
    );
  }
  // A rule with no source is refused by the config schema; unchecked, it maps nothing.
  return { outcome: 'nothingThere' };
}

/** How a problem names where a value was read: its path quoted, or the column. */
function describeWhereRead(sourceOfRule: FlexAlternativeSource): string {
  const lines = ptBRFlexMapping.problemLines;
  if (sourceOfRule.fromColumn !== undefined) {
    return lines.whereReadInColumn(sourceOfRule.fromColumn.header);
  }
  const path =
    sourceOfRule.fromPath ?? sourceOfRule.fromParent ?? sourceOfRule.fromLookup?.path ?? '';
  return lines.whereReadAtPath(path);
}

/**
 * Runs the rule's transform, if it has one, on a value read. A refused value is a problem
 * quoting where it was read ("não consegui ler "ultima_volta": …").
 */
function runTransformOfRule(rule: FlexFieldRule, whereRead: string, value: unknown): RuleOutcome {
  const lines = ptBRFlexMapping.problemLines;
  if (rule.transformId === undefined) {
    return { outcome: 'set', value };
  }

  const transform = findTransform(rule.transformId);
  // The config's schema already refused a binding transform here; this keeps apply typed.
  if (transform?.family !== 'mapping') {
    const reason = ptBRTransforms.parameterReasons.unknownTransform(rule.transformId);
    return { outcome: 'problem', detail: lines.couldNotRead(whereRead, reason) };
  }
  const transformResult = transform.apply(value, rule.transformParameters);
  if (!transformResult.ok) {
    return {
      outcome: 'problem',
      detail: lines.couldNotRead(whereRead, transformResult.reason),
    };
  }
  return { outcome: 'set', value: transformResult.value };
}

/** The pt-BR label a problem line shows for a target, or the target itself if unlisted. */
export function labelTargetField(shapeKey: DataShapeKey, targetField: string): string {
  return findMappableField(shapeKey, targetField)?.label ?? targetField;
}

/**
 * Writes a value at a target field, creating the nested object of a dotted target:
 * "clock.running" writes `running` inside `clock`, which the earlier clock rules may
 * already have started.
 */
export function setValueAtTargetField(
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
