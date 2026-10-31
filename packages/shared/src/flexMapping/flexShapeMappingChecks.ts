/**
 * The checks of one shape's mapping that no single rule can make: the session has no list
 * and the lists have theirs; every target is a field of the shape at its level, named
 * once; and (BAJAOVRLAY-53) what a rule reads is declared by the mapping (its lookups,
 * its nested list, its table), and each option sits on the shape it is for. Split from
 * flexMappingConfig.ts, which runs checkOneShapeMapping as the mapping's superRefine.
 */
import type { z } from 'zod';

import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import type { FlexFieldRule, FlexShapeMapping } from './flexMappingConfig.js';
import { listReadingsOfRule } from './flexRuleSources.js';
import { findMappableField, type MappableFieldLevel } from './mappableFields.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { parseValuePath } from './valuePath.js';

/** The target only the gaps step reads (gapsFromLaps.ts); it never reaches the shape. */
export const lastPassTargetField = 'lastPassAtMs';

/**
 * Checks one shape's mapping: its list (or the session's lack of one), its options on the
 * right shape, its rules' targets, and what its rules read.
 */
export function checkOneShapeMapping(mapping: FlexShapeMapping, context: z.RefinementCtx): void {
  const shapeName = ptBRDataShapes.shapeNames[mapping.shapeKey];

  if (mapping.shapeKey === 'session') {
    checkSessionHasNoList(mapping, context);
  } else {
    checkListPathOfMapping(mapping, shapeName, context);
  }
  if (mapping.nestedEntriesPath !== undefined) {
    const pathParsing = parseValuePath(mapping.nestedEntriesPath);
    if (!pathParsing.ok) {
      context.addIssue({ code: 'custom', path: ['nestedEntriesPath'], message: pathParsing.reason });
    }
  }
  checkLookupNamesAreUnique(mapping, context);
  checkOptionsSitOnTheirShape(mapping, context);

  checkTargetsOfRules(mapping.shapeKey, mapping.fields, 'topLevel', ['fields'], context);
  checkReadingsOfRules(mapping, mapping.fields, 'topLevel', ['fields'], context);
  if (mapping.entryFields !== undefined) {
    checkTargetsOfRules(mapping.shapeKey, mapping.entryFields, 'entry', ['entryFields'], context);
    checkReadingsOfRules(mapping, mapping.entryFields, 'entry', ['entryFields'], context);
    checkLastPassIsUsed(mapping, mapping.entryFields, context);
  }
  if (mapping.scorePartsFromColumns !== undefined && mapping.shapeKey === 'standings') {
    checkScorePartsFromColumns(mapping, context);
  }
}

/** The session is not a list: no list path, nested list, entry rules or table. */
function checkSessionHasNoList(mapping: FlexShapeMapping, context: z.RefinementCtx): void {
  const reasons = ptBRFlexMapping.configReasons;
  const listKeys = ['entriesPath', 'nestedEntriesPath', 'entryFields', 'table'] as const;
  for (const listKey of listKeys) {
    if (mapping[listKey] !== undefined) {
      context.addIssue({ code: 'custom', path: [listKey], message: reasons.sessionHasNoList });
    }
  }
}

/** Checks that a list shape has its list's path, readable, and entry rules. */
function checkListPathOfMapping(
  mapping: FlexShapeMapping,
  shapeName: string,
  context: z.RefinementCtx,
): void {
  const reasons = ptBRFlexMapping.configReasons;
  if (mapping.entriesPath === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['entriesPath'],
      message: reasons.listShapeNeedsEntriesPath(shapeName),
    });
  } else {
    const pathParsing = parseValuePath(mapping.entriesPath);
    if (!pathParsing.ok) {
      context.addIssue({ code: 'custom', path: ['entriesPath'], message: pathParsing.reason });
    }
  }
  if (mapping.entryFields === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['entryFields'],
      message: reasons.listShapeNeedsEntryFields(shapeName),
    });
  }
}

/** Two lookups with one name: a rule could not say which it reads. */
function checkLookupNamesAreUnique(mapping: FlexShapeMapping, context: z.RefinementCtx): void {
  const lookupNamesSeen = new Set<string>();
  (mapping.lookups ?? []).forEach((lookup, lookupIndex) => {
    if (lookupNamesSeen.has(lookup.lookupName)) {
      context.addIssue({
        code: 'custom',
        path: ['lookups', lookupIndex, 'lookupName'],
        message: ptBRFlexMapping.configReasons.lookupNamedTwice(lookup.lookupName),
      });
    }
    lookupNamesSeen.add(lookup.lookupName);
  });
}

/**
 * Each option belongs to one shape: parts from columns to the standings (with a table, and
 * not beside a parts list), gaps to the positions, incomplete matches to the brackets.
 */
function checkOptionsSitOnTheirShape(mapping: FlexShapeMapping, context: z.RefinementCtx): void {
  const reasons = ptBRFlexMapping.configReasons;
  if (mapping.scorePartsFromColumns !== undefined) {
    const hasAPartsListRule = (mapping.entryFields ?? []).some(
      (rule) => rule.targetField === 'pointsByPart',
    );
    let message: string | undefined;
    if (mapping.shapeKey !== 'standings') {
      message = reasons.scorePartsFromColumnsOnlyInStandings;
    } else if (mapping.table === undefined) {
      message = reasons.scorePartsFromColumnsNeedTable;
    } else if (hasAPartsListRule) {
      message = reasons.scorePartsFromTwoPlaces;
    }
    if (message !== undefined) {
      context.addIssue({ code: 'custom', path: ['scorePartsFromColumns'], message });
    }
  }
  if (mapping.workOutGapsFromLaps === true && mapping.shapeKey !== 'positions') {
    context.addIssue({
      code: 'custom',
      path: ['workOutGapsFromLaps'],
      message: reasons.gapsOnlyInPositions,
    });
  }
  if (mapping.entryIsIncompleteWhen !== undefined && mapping.shapeKey !== 'brackets') {
    context.addIssue({
      code: 'custom',
      path: ['entryIsIncompleteWhen'],
      message: reasons.incompleteEntriesOnlyInBrackets,
    });
  }
}

/** A header picked twice would be two columns of one name on the graphic. */
function checkScorePartsFromColumns(mapping: FlexShapeMapping, context: z.RefinementCtx): void {
  const headersSeen = new Set<string>();
  (mapping.scorePartsFromColumns?.headers ?? []).forEach((header, headerIndex) => {
    if (headersSeen.has(header)) {
      context.addIssue({
        code: 'custom',
        path: ['scorePartsFromColumns', 'headers', headerIndex],
        message: ptBRFlexMapping.configReasons.headerTwiceInScoreParts(header),
      });
    }
    headersSeen.add(header);
  });
}

/**
 * Checks the targets of one list of rules: each is a mappable field of the shape, at the
 * level of this list, named by one rule only; "ordem na lista" only fills entry fields.
 */
function checkTargetsOfRules(
  shapeKey: DataShapeKey,
  rules: FlexFieldRule[],
  level: MappableFieldLevel,
  pathOfRules: string[],
  context: z.RefinementCtx,
): void {
  const reasons = ptBRFlexMapping.configReasons;
  const shapeName = ptBRDataShapes.shapeNames[shapeKey];
  const targetFieldsSeen = new Set<string>();

  rules.forEach((rule, ruleIndex) => {
    const pathOfTarget = [...pathOfRules, ruleIndex, 'targetField'];
    const mappableField = findMappableField(shapeKey, rule.targetField);
    if (mappableField === undefined) {
      context.addIssue({
        code: 'custom',
        path: pathOfTarget,
        message: reasons.unknownTargetField(shapeName, rule.targetField),
      });
      return;
    }

    if (mappableField.level !== level) {
      const message =
        mappableField.level === 'entry'
          ? reasons.entryFieldAtTopLevel(mappableField.label)
          : reasons.topLevelFieldInEntry(mappableField.label);
      context.addIssue({ code: 'custom', path: pathOfTarget, message });
      return;
    }

    if (targetFieldsSeen.has(rule.targetField)) {
      context.addIssue({
        code: 'custom',
        path: pathOfTarget,
        message: reasons.targetFieldTwice(mappableField.label),
      });
    }
    targetFieldsSeen.add(rule.targetField);

    if (rule.fromListOrder !== undefined && level === 'topLevel') {
      context.addIssue({
        code: 'custom',
        path: [...pathOfRules, ruleIndex, 'fromListOrder'],
        message: reasons.listOrderOnlyForEntries(mappableField.label),
      });
    }
  });
}

/**
 * Checks what each rule reads, alternatives included: a lookup only from an entry and only
 * one the mapping declares; the outer element only with a nested list; a column only with
 * the table's layout.
 */
function checkReadingsOfRules(
  mapping: FlexShapeMapping,
  rules: FlexFieldRule[],
  level: MappableFieldLevel,
  pathOfRules: string[],
  context: z.RefinementCtx,
): void {
  const reasons = ptBRFlexMapping.configReasons;
  const lookupNames = new Set((mapping.lookups ?? []).map((lookup) => lookup.lookupName));

  rules.forEach((rule, ruleIndex) => {
    const fieldLabel = findMappableField(mapping.shapeKey, rule.targetField)?.label ?? rule.targetField;
    for (const reading of listReadingsOfRule(rule)) {
      const pathOfReading = [...pathOfRules, ruleIndex, ...reading.whereInRule];
      if (reading.kind === 'lookup' && level === 'topLevel') {
        context.addIssue({
          code: 'custom',
          path: pathOfReading,
          message: reasons.lookupOnlyForEntries(fieldLabel),
        });
      } else if (reading.kind === 'lookup' && !lookupNames.has(reading.lookupName)) {
        context.addIssue({
          code: 'custom',
          path: [...pathOfReading, 'lookup'],
          message: reasons.unknownLookup(reading.lookupName),
        });
      } else if (reading.kind === 'parent' && mapping.nestedEntriesPath === undefined) {
        context.addIssue({
          code: 'custom',
          path: pathOfReading,
          message: reasons.parentWithoutNestedList(fieldLabel),
        });
      } else if (reading.kind === 'column' && mapping.table === undefined) {
        context.addIssue({
          code: 'custom',
          path: pathOfReading,
          message: reasons.columnWithoutTable(fieldLabel),
        });
      }
    }
  });
}

/** A last pass with the gaps off would be read and thrown away, so it is refused. */
function checkLastPassIsUsed(
  mapping: FlexShapeMapping,
  entryRules: FlexFieldRule[],
  context: z.RefinementCtx,
): void {
  if (mapping.workOutGapsFromLaps === true) {
    return;
  }
  entryRules.forEach((rule, ruleIndex) => {
    if (rule.targetField !== lastPassTargetField) {
      return;
    }
    const fieldLabel = findMappableField(mapping.shapeKey, rule.targetField)?.label ?? rule.targetField;
    context.addIssue({
      code: 'custom',
      path: ['entryFields', ruleIndex, 'targetField'],
      message: ptBRFlexMapping.configReasons.lastPassWithoutGaps(fieldLabel),
    });
  });
}
