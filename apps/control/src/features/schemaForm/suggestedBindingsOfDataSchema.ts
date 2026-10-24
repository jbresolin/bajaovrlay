/**
 * The bindings a manifest suggests for a new item: a property may carry
 * `v_baja.suggestedBinding: { shapeKey, path, isLive }` (packages/graphics/README.md),
 * and the editor pre-fills that field's "Fonte" when exactly one enabled source has the
 * shape in its last good data. A manifest convention, so no code here belongs to one
 * graphic. Pure: it reads the schema and the two slices it is given, and never throws.
 */
import {
  type BindingFieldValue,
  type DataShapeKey,
  DataShapeKeySchema,
  type DataSnapshot,
  type DataSource,
  findProblemInBindingForDataSchemaField,
} from '@bajaovrlay/shared';

import { isPlainRecord, readOwnValueOfRecord } from './plainRecord';

/** The slices a suggestion is judged against: the sources and their last good data. */
export type SourcesForSuggestedBindings = {
  dataSources: DataSource[];
  dataSnapshots: DataSnapshot[];
};

/** A `v_baja.suggestedBinding` as written, once its three parts have the right types. */
type SuggestedBindingHint = {
  shapeKey: DataShapeKey;
  path: string;
  isLive: boolean;
};

/**
 * Reads the hint one property carries, or undefined when there is none or it is not an
 * object with a known shape key, a path text and a yes/no for live. Whether the path is
 * offered and fits the field is judged later, with the shared rules.
 */
function readSuggestedBindingHintOfProperty(
  propertySchema: unknown,
): SuggestedBindingHint | undefined {
  if (!isPlainRecord(propertySchema)) {
    return undefined;
  }
  const vendorKeywords = readOwnValueOfRecord(propertySchema, 'v_baja');
  const hint = isPlainRecord(vendorKeywords)
    ? readOwnValueOfRecord(vendorKeywords, 'suggestedBinding')
    : undefined;
  if (!isPlainRecord(hint)) {
    return undefined;
  }
  const shapeKey = DataShapeKeySchema.safeParse(readOwnValueOfRecord(hint, 'shapeKey'));
  const path = readOwnValueOfRecord(hint, 'path');
  const isLive = readOwnValueOfRecord(hint, 'isLive');
  if (!shapeKey.success || typeof path !== 'string' || typeof isLive !== 'boolean') {
    return undefined;
  }
  return { shapeKey: shapeKey.data, path, isLive };
}

/**
 * The id of the one enabled source whose last good data holds the shape, or undefined
 * when no source does or more than one does. Two sources with the same shape (the
 * simulator and a replay, say) are a choice for the operator, never a guess.
 */
export function findOnlySourceProducingShape(
  shapeKey: DataShapeKey,
  sources: SourcesForSuggestedBindings,
): string | undefined {
  const idsOfEnabledSourcesWithTheShape: string[] = [];
  for (const dataSource of sources.dataSources) {
    if (!dataSource.isEnabled) {
      continue;
    }
    const hasTheShapeInItsLastData = sources.dataSnapshots.some(
      (snapshot) => snapshot.sourceId === dataSource.id && snapshot.shapes[shapeKey] !== undefined,
    );
    if (hasTheShapeInItsLastData) {
      idsOfEnabledSourcesWithTheShape.push(dataSource.id);
    }
  }
  return idsOfEnabledSourcesWithTheShape.length === 1
    ? idsOfEnabledSourcesWithTheShape[0]
    : undefined;
}

/**
 * The bindings a new item of this data schema opens with, by field key: for each property
 * carrying a hint, a live-or-frozen binding (as the hint says, with no transform) to the
 * one enabled source producing the shape. A property gets nothing when no source or
 * several sources produce the shape, or when the hint would be refused at the save
 * (a path not offered, one that needs a car number, a value the field does not take):
 * a manifest's mistake is ignored rather than shown, so the editor always opens.
 */
export function buildSuggestedBindingsForNewItem(
  dataSchema: unknown,
  sources: SourcesForSuggestedBindings,
): Record<string, BindingFieldValue> {
  const properties = isPlainRecord(dataSchema)
    ? readOwnValueOfRecord(dataSchema, 'properties')
    : undefined;
  if (!isPlainRecord(properties)) {
    return {};
  }

  const bindingPairs: Array<[string, BindingFieldValue]> = [];
  for (const [fieldKey, propertySchema] of Object.entries(properties)) {
    const hint = readSuggestedBindingHintOfProperty(propertySchema);
    if (hint === undefined) {
      continue;
    }
    const sourceId = findOnlySourceProducingShape(hint.shapeKey, sources);
    if (sourceId === undefined) {
      continue;
    }
    const binding: BindingFieldValue = {
      kind: 'binding',
      sourceId,
      shapeKey: hint.shapeKey,
      path: hint.path,
      isLive: hint.isLive,
    };
    const problem = findProblemInBindingForDataSchemaField(binding, dataSchema, fieldKey);
    if (problem !== undefined) {
      continue;
    }
    bindingPairs.push([fieldKey, binding]);
  }
  return Object.fromEntries(bindingPairs);
}
