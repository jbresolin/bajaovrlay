/**
 * Which field of the flex form a refusal is about (apps/control)
 *
 * What this module is for:
 *   The shared HttpJsonConfigSchema names a refusal by its place in the config
 *   ("mappings.0.lookups.1.listPath"); the flex form shows it under the control that holds
 *   that value ("mappings.0.lookups.1.listPath" too, or "…fieldRules.6.columnHeader" for a
 *   rule's column). findFormFieldPathOfIssue makes that translation, so each sentence lands
 *   beside what the operator must fix.
 *
 * What these tests prove, one row per kind of place (BAJAOVRLAY-53's additions first):
 *   - A request's refresh time lands under "Atualizar a cada (s)".
 *   - A lookup's field, a table path, the parts by column, the refusal's value and an
 *     incomplete-match condition land under their own controls.
 *   - Inside a rule: a lookup's name, a column's header, the path of a column, one
 *     alternative's field, and anything about the whole rule under its path or value.
 *   - A refusal about no one field (no shape mapped) has no field.
 *
 * What these tests deliberately do not cover:
 *   - Showing the sentence under the control: the DataSourcesPageFlex*.test.tsx files.
 */
import { describe, expect, it } from 'vitest';

import type { FormRowsOfRules } from './flexConfigFromFormValues';
import { findFormFieldPathOfIssue } from './flexFormFieldOfIssue';

/**
 * One positions mapping whose top-level rules came from rows 0 and 1 and whose item rules
 * came from rows 2 to 7, as if the form had built them in that order.
 */
const formRowsOfOnePositionsMapping: FormRowsOfRules = [
  { fields: [0, 1], entryFields: [2, 3, 4, 5, 6, 7] },
];

describe('findFormFieldPathOfIssue', () => {
  const issueScenarios: Array<{
    name: string;
    issuePath: PropertyKey[];
    expectedFieldPath: string | undefined;
  }> = [
    // The teams request refreshed every 30 s, under the shortest time.
    {
      name: 'puts a refresh time under "Atualizar a cada (s)"',
      issuePath: ['requests', 1, 'refreshEveryMs'],
      expectedFieldPath: 'requests.1.refreshEverySeconds',
    },
    // A lookup's list path that does not parse.
    {
      name: 'puts a lookup’s list path under that lookup’s field',
      issuePath: ['mappings', 0, 'lookups', 1, 'listPath'],
      expectedFieldPath: 'mappings.0.lookups.1.listPath',
    },
    // A lookup named twice: the refusal is at its name.
    {
      name: 'puts a lookup named twice under its name',
      issuePath: ['mappings', 0, 'lookups', 1, 'lookupName'],
      expectedFieldPath: 'mappings.0.lookups.1.lookupName',
    },
    // A cells path that does not parse.
    {
      name: 'puts a table path under its field',
      issuePath: ['mappings', 0, 'table', 'cellsPath'],
      expectedFieldPath: 'mappings.0.table.cellsPath',
    },
    // A header picked twice is at its place in the headers list, one textarea in the form.
    {
      name: 'puts a header picked twice under the headers box',
      issuePath: ['mappings', 0, 'scorePartsFromColumns', 'headers', 1],
      expectedFieldPath: 'mappings.0.scorePartHeadersText',
    },
    // Parts by column without a table: about the option as a whole.
    {
      name: 'puts parts by column without a table under the headers box',
      issuePath: ['mappings', 0, 'scorePartsFromColumns'],
      expectedFieldPath: 'mappings.0.scorePartHeadersText',
    },
    // The parts' value path that does not parse.
    {
      name: 'puts the parts’ value path under its field',
      issuePath: ['mappings', 0, 'scorePartsFromColumns', 'valuePath'],
      expectedFieldPath: 'mappings.0.scorePartValuePath',
    },
    // The refusal's value, typed as text in the form.
    {
      name: 'puts the refusal’s value under "Valor que recusa"',
      issuePath: ['mappings', 0, 'refuseWhen', 'equals'],
      expectedFieldPath: 'mappings.0.refuseWhen.equalsText',
    },
    // An incomplete-match condition with no values.
    {
      name: 'puts a condition’s values under that condition’s values box',
      issuePath: ['mappings', 0, 'entryIsIncompleteWhen', 1, 'isOneOf'],
      expectedFieldPath: 'mappings.0.incompleteConditions.1.valuesText',
    },
    // The fourth item rule came from row 5; its lookup is unknown.
    {
      name: 'puts an unknown lookup under the row’s "Consulta"',
      issuePath: ['mappings', 0, 'entryFields', 3, 'fromLookup', 'lookup'],
      expectedFieldPath: 'mappings.0.fieldRules.5.lookupName',
    },
    // A column read without a table: about the column, so under its header.
    {
      name: 'puts a column without a table under the row’s column header',
      issuePath: ['mappings', 0, 'entryFields', 3, 'fromColumn'],
      expectedFieldPath: 'mappings.0.fieldRules.5.columnHeader',
    },
    // The path inside the column's cell does not parse.
    {
      name: 'puts the path in a column’s cell under the row’s path',
      issuePath: ['mappings', 0, 'entryFields', 3, 'fromColumn', 'path'],
      expectedFieldPath: 'mappings.0.fieldRules.5.pathOrConstantText',
    },
    // A fixed value before the last alternative: under that alternative.
    {
      name: 'puts an alternative’s refusal under that alternative',
      issuePath: ['mappings', 0, 'entryFields', 3, 'firstOf', 0],
      expectedFieldPath: 'mappings.0.fieldRules.5.alternatives.0.pathOrConstantText',
    },
    // An alternative reading an unknown lookup: under that alternative's "Consulta".
    {
      name: 'puts an alternative’s unknown lookup under that alternative’s lookup',
      issuePath: ['mappings', 0, 'entryFields', 3, 'firstOf', 1, 'fromLookup', 'lookup'],
      expectedFieldPath: 'mappings.0.fieldRules.5.alternatives.1.lookupName',
    },
    // A single alternative: about the whole rule, under its path or value.
    {
      name: 'puts alternatives with one source under the row’s path',
      issuePath: ['mappings', 0, 'entryFields', 3, 'firstOf'],
      expectedFieldPath: 'mappings.0.fieldRules.5.pathOrConstantText',
    },
    // Nothing mapped at all: no one field to put it under.
    {
      name: 'has no field for an empty list of mappings',
      issuePath: ['mappings'],
      expectedFieldPath: undefined,
    },
  ];

  it.each(issueScenarios)('$name', ({ issuePath, expectedFieldPath }) => {
    // Arrange: the refusal's place of this row, in a config of one positions mapping.

    // Act: find the form field it is about.
    const fieldPath = findFormFieldPathOfIssue(issuePath, formRowsOfOnePositionsMapping);

    // Assert: the field this row names.
    expect(fieldPath, 'the refusal must land under this field').toBe(expectedFieldPath);
  });
});
