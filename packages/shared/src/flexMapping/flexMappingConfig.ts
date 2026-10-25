import { z } from 'zod';

import { type DataShapeKey, DataShapeKeySchema } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { checkTransformParameters } from '../transforms/checkTransformParameters.js';
import { ptBRTransforms } from '../transforms/ptBRTransforms.js';
import { findTransform } from '../transforms/transformRegistry.js';
import { findMappableField, type MappableFieldLevel } from './mappableFields.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { parseValuePath } from './valuePath.js';

/**
 * One field rule: the canonical field it fills, and exactly one source for its value.
 * - `fromPath` reads the response (or the list element, for an entry field), with at most
 *   one transform from the registry (`transformId`, and `transformParameters` for the one
 *   that takes any). One transform per rule: a chain is out of scope (see the README).
 * - `constantValue` is a fixed value, such as `sessionKind: "enduro"`.
 * - `fromListOrder` is the element's 1-based place in the list, for a source that sends
 *   its list in order but no place number.
 * - `fromPollMoment` is the moment of the poll on the server's clock.
 * Strict, so a misspelt key ("fromPth") is refused instead of leaving a rule with no source.
 */
export const FlexFieldRuleSchema = z
  .strictObject(
    {
      /** A canonical field name, nested with a dot: "clock.referenceTimeMs". */
      targetField: z.string().min(1),
      fromPath: z.string().optional(),
      transformId: z.string().optional(),
      /**
       * Checked against the transform's own schema (checkTransformParameters), so left
       * unknown here, as a literal field value is (see fieldValue.ts).
       */
      transformParameters: z.unknown().optional(),
      /** Canonical fields hold text, numbers and booleans only. */
      constantValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
      fromListOrder: z.literal(true).optional(),
      fromPollMoment: z.literal(true).optional(),
    },
    { error: explainUnknownKeysOfRule },
  )
  .superRefine((rule, context) => {
    checkOneFieldRule(rule, context);
  });

/** One field rule after it has passed FlexFieldRuleSchema. */
export type FlexFieldRule = z.infer<typeof FlexFieldRuleSchema>;

/**
 * The mapping of one shape: which request's response it reads, and its rules. A shape's
 * rules read that one response only: there are no joins across requests (see the README).
 * - `fields` fill the shape's own fields (all of the session's; `sessionId`, `updatedAtMs`
 *   and standings' `scope` for the lists);
 * - `entriesPath` and `entryFields`, for every shape but the session: the path to the
 *   list in the response, and the rules applied to each element of it. For brackets the
 *   list is the matches, each naming its round (BAJAOVRLAY-25).
 */
export const FlexShapeMappingSchema = z
  .strictObject(
    {
      shapeKey: DataShapeKeySchema,
      /** The request whose response this shape reads (the httpJson config's requests). */
      requestId: z.string().min(1),
      entriesPath: z.string().optional(),
      fields: z.array(FlexFieldRuleSchema),
      entryFields: z.array(FlexFieldRuleSchema).optional(),
    },
    { error: explainUnknownKeysOfMapping },
  )
  .superRefine((mapping, context) => {
    checkOneShapeMapping(mapping, context);
  });

/** The mapping of one shape after it has passed FlexShapeMappingSchema. */
export type FlexShapeMapping = z.infer<typeof FlexShapeMappingSchema>;

/**
 * The mapping config of a flex source: one mapping per produced shape, each shape at most
 * once, at least one in all. The httpJson config embeds it and checks its requestIds.
 */
export const FlexMappingConfigSchema = z
  .array(FlexShapeMappingSchema, { error: ptBRFlexMapping.configReasons.mappingsNotAList })
  .superRefine((mappings, context) => {
    checkMappingsAcrossShapes(mappings, context);
  });

/** A mapping config after it has passed FlexMappingConfigSchema. */
export type FlexMappingConfig = z.infer<typeof FlexMappingConfigSchema>;

/** Gives the pt-BR sentence for misspelt keys on a rule; Zod's own for anything else. */
function explainUnknownKeysOfRule(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRFlexMapping.configReasons.unknownKeysInRule(issue.keys);
  }
  return undefined;
}

/** Gives the pt-BR sentence for misspelt keys on a mapping; Zod's own for anything else. */
function explainUnknownKeysOfMapping(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRFlexMapping.configReasons.unknownKeysInMapping(issue.keys);
  }
  return undefined;
}

/** Counts the sources a rule names: exactly one is right. */
function countSourcesOfRule(rule: FlexFieldRule): number {
  const sourceIsNamed = [
    rule.fromPath !== undefined,
    rule.constantValue !== undefined,
    rule.fromListOrder !== undefined,
    rule.fromPollMoment !== undefined,
  ];
  return sourceIsNamed.filter((isNamed) => isNamed).length;
}

/**
 * Checks what one rule can say about itself, whatever shape it belongs to: one source, a
 * transform only on a path, parameters only with a transform, a path that parses, and a
 * transform the registry has, with parameters its schema accepts.
 */
function checkOneFieldRule(rule: FlexFieldRule, context: z.RefinementCtx): void {
  const reasons = ptBRFlexMapping.configReasons;
  if (countSourcesOfRule(rule) !== 1) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: reasons.ruleNeedsExactlyOneSource(rule.targetField),
    });
    return;
  }

  if (rule.fromPath !== undefined) {
    const pathParsing = parseValuePath(rule.fromPath);
    if (!pathParsing.ok) {
      context.addIssue({ code: 'custom', path: ['fromPath'], message: pathParsing.reason });
    }
  }

  if (rule.transformId !== undefined && rule.fromPath === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['transformId'],
      message: reasons.transformWithoutPath(rule.targetField),
    });
    return;
  }
  if (rule.transformId === undefined) {
    if (rule.transformParameters !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['transformParameters'],
        message: reasons.parametersWithoutTransform(rule.targetField),
      });
    }
    return;
  }

  // An unknown id, or a binding transform (it formats canonical data for the screen, it
  // never reads a source), is reported at the id, a bad table at the parameters, so the
  // form can put the sentence beside the control that is wrong.
  const transform = findTransform(rule.transformId);
  if (transform === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['transformId'],
      message: ptBRTransforms.parameterReasons.unknownTransform(rule.transformId),
    });
    return;
  }
  if (transform.family !== 'mapping') {
    context.addIssue({
      code: 'custom',
      path: ['transformId'],
      message: ptBRTransforms.parameterReasons.bindingTransformInMapping(transform.label),
    });
    return;
  }
  const transformCheck = checkTransformParameters(
    rule.transformId,
    rule.transformParameters,
    'mapping',
  );
  if (!transformCheck.ok) {
    context.addIssue({
      code: 'custom',
      path: ['transformParameters'],
      message: transformCheck.reason,
    });
  }
}

/**
 * Checks one shape's mapping: the session has no list, and the lists have their path and
 * their entry rules; every target is a field of this shape at this level, named once.
 */
function checkOneShapeMapping(mapping: FlexShapeMapping, context: z.RefinementCtx): void {
  const reasons = ptBRFlexMapping.configReasons;
  const shapeName = ptBRDataShapes.shapeNames[mapping.shapeKey];

  if (mapping.shapeKey === 'session') {
    if (mapping.entriesPath !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['entriesPath'],
        message: reasons.sessionHasNoList,
      });
    }
    if (mapping.entryFields !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['entryFields'],
        message: reasons.sessionHasNoList,
      });
    }
  } else {
    checkListPathOfMapping(mapping, shapeName, context);
  }

  checkTargetsOfRules(mapping.shapeKey, mapping.fields, 'topLevel', ['fields'], context);
  if (mapping.entryFields !== undefined) {
    checkTargetsOfRules(mapping.shapeKey, mapping.entryFields, 'entry', ['entryFields'], context);
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

/** Checks the list of mappings: at least one, and each shape once. */
function checkMappingsAcrossShapes(mappings: FlexShapeMapping[], context: z.RefinementCtx): void {
  const reasons = ptBRFlexMapping.configReasons;
  if (mappings.length === 0) {
    context.addIssue({ code: 'custom', path: [], message: reasons.mappingListIsEmpty });
    return;
  }

  const shapeKeysSeen = new Set<DataShapeKey>();
  mappings.forEach((mapping, mappingIndex) => {
    if (shapeKeysSeen.has(mapping.shapeKey)) {
      context.addIssue({
        code: 'custom',
        path: [mappingIndex, 'shapeKey'],
        message: reasons.shapeMappedTwice(ptBRDataShapes.shapeNames[mapping.shapeKey]),
      });
    }
    shapeKeysSeen.add(mapping.shapeKey);
  });
}
