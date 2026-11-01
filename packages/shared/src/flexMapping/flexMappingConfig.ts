import { z } from 'zod';

import { type DataShapeKey, DataShapeKeySchema } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { checkTransformParameters } from '../transforms/checkTransformParameters.js';
import { ptBRTransforms } from '../transforms/ptBRTransforms.js';
import { findTransform } from '../transforms/transformRegistry.js';
import {
  FlexIncompleteEntryConditionSchema,
  FlexLookupSchema,
  FlexRefusalFlagSchema,
  FlexScorePartsFromColumnsSchema,
  FlexTableLayoutSchema,
} from './flexMappingListOptions.js';
import {
  checkAlternativesOfRule,
  checkPathsParse,
  countSourcesNamed,
  doesSourceReadTheData,
  FlexAlternativeSourceSchema,
  FlexColumnReadingSchema,
  FlexLookupReadingSchema,
  listPathsOfOneSource,
} from './flexRuleSources.js';
import { checkOneShapeMapping } from './flexShapeMappingChecks.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';

/**
 * One field rule: the canonical field it fills, and exactly one source for its value.
 * - `fromPath` reads the response (or the list element, for an entry field).
 * - `fromParent` reads the outer element of a nested list (nestedEntriesPath), entries only.
 * - `fromLookup` reads the element of a lookup the entry's key matched, entries only.
 * - `fromColumn` reads the entry's cell under a column's header (the mapping's table).
 * - `firstOf` tries alternatives in order (flexRuleSources.ts): the first value present,
 *   not null and not blank text wins.
 * - `constantValue` is a fixed value, such as `sessionKind: "enduro"`.
 * - `fromListOrder` is the element's 1-based place in the list, for a source that sends
 *   its list in order but no place number.
 * - `fromPollMoment` is the moment of the poll on the server's clock.
 * A source that reads the data may have one transform from the registry (`transformId`,
 * and `transformParameters` for one that takes any); with `firstOf` it runs on the value
 * read, never on a fixed value. One transform per rule: a chain is out of scope.
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
      fromParent: z.string().optional(),
      fromLookup: FlexLookupReadingSchema.optional(),
      fromColumn: FlexColumnReadingSchema.optional(),
      firstOf: z.array(FlexAlternativeSourceSchema).optional(),
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
 * rules read that one response, and other requests only through its lookups.
 * - `fields` fill the shape's own fields (all of the session's; `sessionId`, `updatedAtMs`
 *   and standings' `scope` for the lists);
 * - `entriesPath` and `entryFields`, for every shape but the session: the path to the
 *   list in the response, and the rules applied to each element of it. For brackets the
 *   list is the matches, each naming its round (BAJAOVRLAY-25);
 * - `nestedEntriesPath`: the list inside each element of that list, each inner element
 *   being one entry, so rounds holding matches are read as matches (BAJAOVRLAY-53);
 * - `lookups`, `table`, `scorePartsFromColumns`, `refuseWhen`, `workOutGapsFromLaps` and
 *   `entryIsIncompleteWhen`: see flexMappingListOptions.ts and the README.
 * Which shape may declare what is checked by flexShapeMappingChecks.ts.
 */
export const FlexShapeMappingSchema = z
  .strictObject(
    {
      shapeKey: DataShapeKeySchema,
      /** The request whose response this shape reads (the httpJson config's requests). */
      requestId: z.string().min(1),
      entriesPath: z.string().optional(),
      nestedEntriesPath: z.string().optional(),
      lookups: z.array(FlexLookupSchema).optional(),
      table: FlexTableLayoutSchema.optional(),
      scorePartsFromColumns: FlexScorePartsFromColumnsSchema.optional(),
      refuseWhen: FlexRefusalFlagSchema.optional(),
      workOutGapsFromLaps: z.boolean().optional(),
      entryIsIncompleteWhen: z.array(FlexIncompleteEntryConditionSchema).min(1).optional(),
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

/**
 * Checks what one rule can say about itself, whatever shape it belongs to: one source, its
 * alternatives (flexRuleSources.ts), a transform only on a source that reads the data,
 * parameters only with a transform, paths that parse, and a transform the registry has,
 * with parameters its schema accepts.
 */
function checkOneFieldRule(rule: FlexFieldRule, context: z.RefinementCtx): void {
  const reasons = ptBRFlexMapping.configReasons;
  if (countSourcesNamed(rule) !== 1) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: reasons.ruleNeedsExactlyOneSource(rule.targetField),
    });
    return;
  }

  checkPathsParse(listPathsOfOneSource(rule, []), context);
  if (rule.firstOf !== undefined) {
    checkAlternativesOfRule(rule.targetField, rule.firstOf, context);
  }

  if (rule.transformId !== undefined && !doesSourceReadTheData(rule)) {
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
