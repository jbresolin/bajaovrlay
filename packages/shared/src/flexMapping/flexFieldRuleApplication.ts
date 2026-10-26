/**
 * One rule of a flex mapping applied to its source (the response, or one element of a
 * list): a fixed value, the poll moment, the place in the list, or the value at a path
 * through its transform; and the writing of that value at a dotted target. Split from
 * applyFlexMapping.ts (BAJAOVRLAY-25), which walks the shapes and their lists and calls
 * these for every rule.
 */
import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { ptBRTransforms } from '../transforms/ptBRTransforms.js';
import { findTransform } from '../transforms/transformRegistry.js';
import type { FlexFieldRule } from './flexMappingConfig.js';
import { findMappableField } from './mappableFields.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { readValueAtPath } from './valuePath.js';

/** What a rule needs besides the value it reads: the poll moment, and the place in the list. */
export type RuleSurroundings = {
  pollMomentMs: number;
  /** The element's 1-based place in its list; undefined for a shape's own fields. */
  placeInList: number | undefined;
};

/** What one rule gave: a value to set, nothing to set, or a pt-BR problem. */
export type RuleOutcome =
  | { outcome: 'set'; value: unknown }
  | { outcome: 'leftOut' }
  | { outcome: 'problem'; detail: string };

/**
 * Applies one rule to its source (the response, or one element of the list): a fixed
 * value, the poll moment, the place in the list, or the value at its path through its
 * transform. A target the shape does not list is a problem, so nothing but a canonical
 * field is ever written.
 */
export function applyOneRule(
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
  // The config's schema already refused a binding transform here; this keeps apply typed.
  if (transform?.family !== 'mapping') {
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
