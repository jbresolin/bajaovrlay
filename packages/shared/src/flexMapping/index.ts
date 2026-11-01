// Everything about the flex mapping that @bajaovrlay/shared exports. The package's own
// index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// Paths into a JSON response ("dados.carros[3].equipe"): parsing one, and reading it.
export {
  parseValuePath,
  readValueAtPath,
  type ValueAtPath,
  type ValuePathParsing,
  type ValuePathSegment,
} from './valuePath.js';
// The mapping config: one mapping per shape, one rule per canonical field.
export {
  type FlexFieldRule,
  FlexFieldRuleSchema,
  type FlexMappingConfig,
  FlexMappingConfigSchema,
  type FlexShapeMapping,
  FlexShapeMappingSchema,
} from './flexMappingConfig.js';
// Where a rule may read besides a path: the outer element, a lookup, a column, alternatives.
export {
  type FlexAlternativeSource,
  type FlexColumnReading,
  type FlexLookupReading,
} from './flexRuleSources.js';
// What a shape's mapping may declare beside its rules (BAJAOVRLAY-53).
export {
  type FlexIncompleteEntryCondition,
  type FlexLookup,
  type FlexRefusalFlag,
  type FlexScorePartsFromColumns,
  type FlexTableLayout,
} from './flexMappingListOptions.js';
// The canonical fields a mapping can fill in each shape, with their pt-BR labels.
export {
  findMappableField,
  listMappableFieldsOfShape,
  type MappableField,
  type MappableFieldLevel,
} from './mappableFields.js';
// Maps the responses of one poll into the canonical shapes, or lists the problems.
export { applyFlexMapping, type FlexMappingResult } from './applyFlexMapping.js';
// The cap on problem lines a failed mapping lists (20).
export { mostProblemLinesListed } from './flexMappingProblems.js';
