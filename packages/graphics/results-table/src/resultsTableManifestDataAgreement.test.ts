// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/results-table)
 *
 * What this module is for:
 *   results-table.ograf.json describes the data as JSON Schema, for renderers and the
 *   control page's form; resultsTableModel.ts checks the same data with Zod in `load` and
 *   `updateAction`. If they disagreed, the form could offer a value the graphic refuses,
 *   or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the overall page during spoilers, the
 *     qualifying page with every setting typed, the rows and heads alone, a row carrying a
 *     field the graphic does not draw (pass); a row without cells, a cell that is a number,
 *     a rank of 0, a direction that is neither, a top-level field the graphic does not
 *     know, and data without the heads (fail).
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; resultsTableManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import resultsTableManifest from '../results-table.ograf.json';
import { createOverallPageDuringSpoilers, createQualifyingPage } from './previewData.js';
import { parseCompleteResultsTableData } from './resultsTableModel.js';

/** The qualifying page with one field of its first row changed (removed when undefined). */
function createQualifyingPageWithTheFirstRowChanged(fieldName: string, value: unknown) {
  const qualifyingPage = createQualifyingPage();
  const entries = qualifyingPage.entries.map((entry, index) =>
    index === 0 ? { ...entry, [fieldName]: value } : entry,
  );
  return { ...qualifyingPage, entries };
}

const dataAgreementScenarios = [
  // João's first screenshot: no rank anywhere, "SPOILERS" in two columns.
  {
    name: 'both accept the overall page during spoilers',
    data: createOverallPageDuringSpoilers(),
    isValid: true,
  },
  // Every setting an item may type.
  {
    name: 'both accept the qualifying page with every setting typed',
    data: {
      ...createQualifyingPage(),
      title: 'CLASSIFICATÓRIA',
      columnsShown: 'Melhor volta, Larga em',
      sortByColumn: 'Melhor volta',
      sortDirection: 'descending',
    },
    isValid: true,
  },
  // An item that binds the two lists and types nothing else.
  {
    name: 'both accept the rows and heads alone',
    data: {
      entries: createQualifyingPage().entries,
      columnHeads: createQualifyingPage().columnHeads,
    },
    isValid: true,
  },
  // A field the shape gains later must not break the binding.
  {
    name: 'both accept a row carrying a field the graphic does not draw',
    data: createQualifyingPageWithTheFirstRowChanged('state', 'PR'),
    isValid: true,
  },
  // A row without its cells cannot be drawn under the heads.
  {
    name: 'both refuse a row without its cells',
    data: createQualifyingPageWithTheFirstRowChanged('cells', undefined),
    isValid: false,
  },
  // Cells are text, as the site writes them; a number means a source not mapped as text.
  {
    name: 'both refuse a cell that is a number',
    data: createQualifyingPageWithTheFirstRowChanged('cells', [51.9]),
    isValid: false,
  },
  // The site's ranks start at 1.
  {
    name: 'both refuse a rank of 0',
    data: createQualifyingPageWithTheFirstRowChanged('rank', 0),
    isValid: false,
  },
  // "Sentido" has two values only.
  {
    name: 'both refuse a direction that is neither',
    data: { ...createQualifyingPage(), sortDirection: 'crescente' },
    isValid: false,
  },
  // A typo'd top-level field must fail both.
  {
    name: 'both refuse a top-level field the graphic does not know',
    data: { ...createQualifyingPage(), titulo: 'CLASSIFICATÓRIA' },
    isValid: false,
  },
  // One of the two required fields left out.
  {
    name: 'both refuse data without the heads',
    data: { entries: createQualifyingPage().entries },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled; JSON drops undefined fields, as the
    // wire does.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(resultsTableManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteResultsTableData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
