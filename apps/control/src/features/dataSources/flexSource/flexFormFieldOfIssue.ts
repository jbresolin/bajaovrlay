import type { FormRowsOfRules } from './flexConfigFromFormValues';

/**
 * Which field of the flex form a refusal of the shared HttpJsonConfigSchema is about, so
 * flexSourceFormReading.ts can put its sentence under that control: "requests.0.url" for
 * a request's address, "mappings.1.fieldRules.6.pathOrConstantText" for a rule's path,
 * "mappings.0.lookups.0.listPath" for a lookup's list. Undefined when the refusal is about
 * no one field (no shape mapped at all), which the form lists above its buttons. Split
 * from flexSourceFormReading.ts by BAJAOVRLAY-53, which added the mapping's options.
 */
export function findFormFieldPathOfIssue(
  issuePath: PropertyKey[],
  formRowsOfRules: FormRowsOfRules,
): string | undefined {
  const [part, ...restOfPath] = issuePath;
  if (part === 'requests') {
    return findFormFieldPathInRequests(restOfPath);
  }
  if (part === 'mappings') {
    return findFormFieldPathInMappings(restOfPath, formRowsOfRules);
  }
  return undefined;
}

/**
 * The field of a request's refusal: its name, address, refresh time, or a header or
 * parameter row.
 */
function findFormFieldPathInRequests(issuePath: PropertyKey[]): string | undefined {
  const [requestIndex, requestKey, rowIndex, rowKey] = issuePath;
  if (typeof requestIndex !== 'number') {
    return undefined;
  }
  const requestPath = `requests.${requestIndex}`;
  if (requestKey === 'requestId' || requestKey === 'url') {
    return `${requestPath}.${requestKey}`;
  }
  if (requestKey === 'refreshEveryMs') {
    return `${requestPath}.refreshEverySeconds`;
  }
  const isARowOfTheRequest = requestKey === 'headers' || requestKey === 'queryParameters';
  if (!isARowOfTheRequest || typeof rowIndex !== 'number') {
    return undefined;
  }
  // A bad name goes under the name; "exactly one value" and a bad value or variable
  // go under the value.
  const rowField = rowKey === 'name' ? 'name' : 'valueText';
  return `${requestPath}.${requestKey}.${rowIndex}.${rowField}`;
}

/**
 * The field of a mapping's refusal: its request, its list paths, one of its options, or
 * one field's row.
 */
function findFormFieldPathInMappings(
  issuePath: PropertyKey[],
  formRowsOfRules: FormRowsOfRules,
): string | undefined {
  const [mappingIndex, mappingKey, ...restOfPath] = issuePath;
  if (typeof mappingIndex !== 'number') {
    return undefined;
  }
  const mappingPath = `mappings.${mappingIndex}`;
  const isAPlainField =
    mappingKey === 'requestId' ||
    mappingKey === 'entriesPath' ||
    mappingKey === 'nestedEntriesPath' ||
    mappingKey === 'workOutGapsFromLaps';
  if (isAPlainField) {
    return `${mappingPath}.${mappingKey}`;
  }
  if (mappingKey === 'fields' || mappingKey === 'entryFields') {
    return findFormFieldPathInRules(mappingIndex, mappingKey, restOfPath, formRowsOfRules);
  }
  const optionFieldPath = findFormFieldPathOfOption(mappingKey, restOfPath);
  return optionFieldPath === undefined ? undefined : `${mappingPath}.${optionFieldPath}`;
}

/**
 * The field of an option's refusal, inside its mapping block: a lookup's field, a table
 * path, the parts by column, the refusal flag's field, or an incomplete-match row.
 */
function findFormFieldPathOfOption(
  mappingKey: PropertyKey | undefined,
  restOfPath: PropertyKey[],
): string | undefined {
  const [firstKey, secondKey] = restOfPath;
  if (mappingKey === 'lookups' && typeof firstKey === 'number') {
    const lookupField = typeof secondKey === 'string' ? secondKey : 'lookupName';
    return `lookups.${firstKey}.${lookupField}`;
  }
  if (mappingKey === 'table') {
    const tableField = typeof firstKey === 'string' ? firstKey : 'columnsPath';
    return `table.${tableField}`;
  }
  if (mappingKey === 'scorePartsFromColumns') {
    return firstKey === 'valuePath' ? 'scorePartValuePath' : 'scorePartHeadersText';
  }
  if (mappingKey === 'refuseWhen') {
    if (firstKey === 'equals') {
      return 'refuseWhen.equalsText';
    }
    return firstKey === 'message' ? 'refuseWhen.message' : 'refuseWhen.path';
  }
  if (mappingKey === 'entryIsIncompleteWhen') {
    const conditionIndex = typeof firstKey === 'number' ? firstKey : 0;
    const conditionField = secondKey === 'isOneOf' ? 'valuesText' : 'path';
    return `incompleteConditions.${conditionIndex}.${conditionField}`;
  }
  return undefined;
}

/**
 * The field of a rule's refusal: the row it came from (formRowsOfRules), then within the
 * row the transform, the lookup's name, the column's header, one alternative's field, or
 * the path or value, which also takes what is about the whole rule.
 */
function findFormFieldPathInRules(
  mappingIndex: number,
  mappingKey: 'fields' | 'entryFields',
  restOfPath: PropertyKey[],
  formRowsOfRules: FormRowsOfRules,
): string | undefined {
  const [ruleIndex, ruleKey, ...insideTheKey] = restOfPath;
  if (typeof ruleIndex !== 'number') {
    return undefined;
  }
  const rowIndex = formRowsOfRules[mappingIndex]?.[mappingKey][ruleIndex];
  if (rowIndex === undefined) {
    return undefined;
  }
  const rowPath = `mappings.${mappingIndex}.fieldRules.${rowIndex}`;
  const [alternativeIndex, ...insideTheAlternative] = insideTheKey;
  if (ruleKey === 'firstOf' && typeof alternativeIndex === 'number') {
    const readingField = findReadingField(insideTheAlternative[0], insideTheAlternative[1]);
    return `${rowPath}.alternatives.${alternativeIndex}.${readingField}`;
  }
  const isAboutTheTransform = ruleKey === 'transformId' || ruleKey === 'transformParameters';
  if (isAboutTheTransform) {
    return `${rowPath}.transformId`;
  }
  return `${rowPath}.${findReadingField(ruleKey, insideTheKey[0])}`;
}

/**
 * Within a reading (a rule's or an alternative's): the lookup's name, the column's header,
 * or else the path or value.
 */
function findReadingField(readingKey: PropertyKey | undefined, innerKey: PropertyKey | undefined) {
  if (readingKey === 'fromLookup' && innerKey !== 'path') {
    return 'lookupName';
  }
  if (readingKey === 'fromColumn' && innerKey !== 'path') {
    return 'columnHeader';
  }
  return 'pathOrConstantText';
}
