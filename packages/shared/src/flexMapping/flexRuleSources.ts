/**
 * Where a rule's value may come from besides a path on the response or the entry
 * (BAJAOVRLAY-53): the outer element of a nested list, a joined list (a lookup), a table
 * cell found by its column's header, and an ordered list of alternatives (`firstOf`).
 * The schemas live here; flexMappingConfig.ts puts them on a rule, and
 * flexShapeMappingChecks.ts checks that the mapping declares what they read.
 */
import { z } from 'zod';

import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { parseValuePath } from './valuePath.js';

/** Reads `path` on the element of a lookup matched by the entry's key. */
export const FlexLookupReadingSchema = z.strictObject({
  /** The `lookupName` of one of the mapping's lookups. */
  lookup: z.string().min(1),
  path: z.string().min(1),
});

/** One lookup reading after it has passed FlexLookupReadingSchema. */
export type FlexLookupReading = z.infer<typeof FlexLookupReadingSchema>;

/**
 * Reads the entry's cell under the column whose header is `header`, then `path` inside
 * that cell (`raw`), or the whole cell without one.
 */
export const FlexColumnReadingSchema = z.strictObject({
  header: z.string().min(1),
  path: z.string().min(1).optional(),
});

/** One column reading after it has passed FlexColumnReadingSchema. */
export type FlexColumnReading = z.infer<typeof FlexColumnReadingSchema>;

/**
 * One alternative of a `firstOf`: exactly one of a path on the response or the entry, a
 * path on the outer element, a lookup, a column, or a fixed value (last only). Strict, so
 * a misspelt key is refused rather than leaving an alternative with no source.
 */
export const FlexAlternativeSourceSchema = z.strictObject({
  fromPath: z.string().optional(),
  fromParent: z.string().optional(),
  fromLookup: FlexLookupReadingSchema.optional(),
  fromColumn: FlexColumnReadingSchema.optional(),
  constantValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

/** One alternative after it has passed FlexAlternativeSourceSchema. */
export type FlexAlternativeSource = z.infer<typeof FlexAlternativeSourceSchema>;

/**
 * The sources a rule or an alternative may name. A rule also has fromListOrder,
 * fromPollMoment and firstOf, which alternatives do not.
 */
export type SourcesOfARule = FlexAlternativeSource & {
  fromListOrder?: true | undefined;
  fromPollMoment?: true | undefined;
  firstOf?: FlexAlternativeSource[] | undefined;
};

/** Counts the sources named: exactly one is right, for a rule as for an alternative. */
export function countSourcesNamed(sources: SourcesOfARule): number {
  const sourceIsNamed = [
    sources.fromPath !== undefined,
    sources.fromParent !== undefined,
    sources.fromLookup !== undefined,
    sources.fromColumn !== undefined,
    sources.firstOf !== undefined,
    sources.constantValue !== undefined,
    sources.fromListOrder !== undefined,
    sources.fromPollMoment !== undefined,
  ];
  return sourceIsNamed.filter((isNamed) => isNamed).length;
}

/**
 * Says whether a rule's source reads a value out of the data (a path of any kind, or
 * alternatives), which is what a transform may work on; a fixed value, the list order and
 * the poll moment are not read.
 */
export function doesSourceReadTheData(sources: SourcesOfARule): boolean {
  return (
    sources.fromPath !== undefined ||
    sources.fromParent !== undefined ||
    sources.fromLookup !== undefined ||
    sources.fromColumn !== undefined ||
    sources.firstOf !== undefined
  );
}

/**
 * One place a rule reads, directly or in one of its alternatives, with where it sits in
 * the rule (for the problem's path). The mapping's checks walk these to find a lookup,
 * an outer element or a column the mapping does not declare.
 */
export type ReadingOfARule =
  | { kind: 'parent'; whereInRule: Array<string | number> }
  | { kind: 'lookup'; lookupName: string; whereInRule: Array<string | number> }
  | { kind: 'column'; header: string; whereInRule: Array<string | number> };

/** Lists the outer-element, lookup and column readings of a rule, alternatives included. */
export function listReadingsOfRule(rule: SourcesOfARule): ReadingOfARule[] {
  const readings = listReadingsOfOneSource(rule, []);
  (rule.firstOf ?? []).forEach((alternative, alternativeIndex) => {
    readings.push(...listReadingsOfOneSource(alternative, ['firstOf', alternativeIndex]));
  });
  return readings;
}

/** The readings of one rule or one alternative, its own source only. */
function listReadingsOfOneSource(
  source: FlexAlternativeSource,
  whereInRule: Array<string | number>,
): ReadingOfARule[] {
  const readings: ReadingOfARule[] = [];
  if (source.fromParent !== undefined) {
    readings.push({ kind: 'parent', whereInRule: [...whereInRule, 'fromParent'] });
  }
  if (source.fromLookup !== undefined) {
    readings.push({
      kind: 'lookup',
      lookupName: source.fromLookup.lookup,
      whereInRule: [...whereInRule, 'fromLookup'],
    });
  }
  if (source.fromColumn !== undefined) {
    readings.push({
      kind: 'column',
      header: source.fromColumn.header,
      whereInRule: [...whereInRule, 'fromColumn'],
    });
  }
  return readings;
}

/** A path a rule or alternative holds, with where it sits, for the path parser's check. */
type PathInSource = { path: string; whereInRule: Array<string | number> };

/** Lists every path one rule or alternative holds (its own source only). */
export function listPathsOfOneSource(
  source: FlexAlternativeSource,
  whereInRule: Array<string | number>,
): PathInSource[] {
  const paths: PathInSource[] = [];
  if (source.fromPath !== undefined) {
    paths.push({ path: source.fromPath, whereInRule: [...whereInRule, 'fromPath'] });
  }
  if (source.fromParent !== undefined) {
    paths.push({ path: source.fromParent, whereInRule: [...whereInRule, 'fromParent'] });
  }
  if (source.fromLookup !== undefined) {
    paths.push({
      path: source.fromLookup.path,
      whereInRule: [...whereInRule, 'fromLookup', 'path'],
    });
  }
  if (source.fromColumn?.path !== undefined) {
    paths.push({
      path: source.fromColumn.path,
      whereInRule: [...whereInRule, 'fromColumn', 'path'],
    });
  }
  return paths;
}

/**
 * Checks a rule's alternatives: at least two, each naming exactly one source, a fixed value
 * only as the last one (it is always present, so anything after it would never be read),
 * and every path parsing.
 */
export function checkAlternativesOfRule(
  targetField: string,
  alternatives: FlexAlternativeSource[],
  context: z.RefinementCtx,
): void {
  const reasons = ptBRFlexMapping.configReasons;
  if (alternatives.length < 2) {
    context.addIssue({
      code: 'custom',
      path: ['firstOf'],
      message: reasons.alternativesNeedTwoSources(targetField),
    });
    return;
  }

  alternatives.forEach((alternative, alternativeIndex) => {
    const whereInRule = ['firstOf', alternativeIndex];
    if (countSourcesNamed(alternative) !== 1) {
      context.addIssue({
        code: 'custom',
        path: whereInRule,
        message: reasons.alternativeNeedsExactlyOneSource(targetField, alternativeIndex + 1),
      });
      return;
    }
    const isLastAlternative = alternativeIndex === alternatives.length - 1;
    if (alternative.constantValue !== undefined && !isLastAlternative) {
      context.addIssue({
        code: 'custom',
        path: whereInRule,
        message: reasons.fixedValueOnlyLast(targetField),
      });
      return;
    }
    checkPathsParse(listPathsOfOneSource(alternative, whereInRule), context);
  });
}

/** Checks that each path parses, reporting a broken one where it sits in the rule. */
export function checkPathsParse(paths: PathInSource[], context: z.RefinementCtx): void {
  for (const { path, whereInRule } of paths) {
    const pathParsing = parseValuePath(path);
    if (!pathParsing.ok) {
      context.addIssue({ code: 'custom', path: whereInRule, message: pathParsing.reason });
    }
  }
}
