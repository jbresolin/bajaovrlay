// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/standings)
 *
 * What this module is for:
 *   standings.ograf.json describes the data as JSON Schema, for renderers and the control
 *   page's form; standingsModel.ts checks the same data with Zod in `load` and
 *   `updateAction`. If they disagreed, the form could offer a value the graphic refuses,
 *   or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the real overall standings with parts,
 *     title and event line; the entries alone; the enduro table with no parts; an entry
 *     carrying a field the graphic does not draw (passes); an entry without points, with
 *     points as text, a part worth text, a score part without a label, a rank of 0, a
 *     top-level field the graphic does not know, and data without entries (fail).
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; standingsManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import standingsManifest from '../standings.ograf.json';
import {
  createEnduroStandings,
  createOverallStandingsEntries,
  createOverallStandingsWithParts,
} from './previewData.js';
import { parseCompleteStandingsData } from './standingsModel.js';

/** The overall entries with one field of one entry changed (removed when the value is undefined). */
function createEntriesWithOneFieldChanged(
  entryIndex: number,
  fieldName: string,
  value: unknown,
): Record<string, unknown>[] {
  return createOverallStandingsEntries().map((entry, index) =>
    index === entryIndex ? { ...entry, [fieldName]: value } : { ...entry },
  );
}

const dataAgreementScenarios = [
  // The everyday payload: the overall table with every field written out.
  {
    name: 'both accept the real overall standings with parts, title and event line',
    data: createOverallStandingsWithParts(),
    isValid: true,
  },
  // An item that binds the list and types nothing else.
  {
    name: 'both accept the entries alone',
    data: { entries: createOverallStandingsEntries() },
    isValid: true,
  },
  // A per-event table: no parts at all.
  {
    name: 'both accept the enduro table with an empty list of parts',
    data: createEnduroStandings(),
    isValid: true,
  },
  // A field the canonical shape gains later must not break the binding.
  {
    name: 'both accept an entry carrying a field the graphic does not draw',
    data: { entries: createEntriesWithOneFieldChanged(0, 'logoUrl', '/media/logo-baja-ufmg') },
    isValid: true,
  },
  // A team without its total cannot be drawn.
  {
    name: 'both refuse an entry without its points',
    data: { entries: createEntriesWithOneFieldChanged(1, 'points', undefined) },
    isValid: false,
  },
  // Points typed with a comma are text, not a number.
  {
    name: 'both refuse points written as text',
    data: { entries: createEntriesWithOneFieldChanged(1, 'points', '903,48') },
    isValid: false,
  },
  // A part's value must be a number too.
  {
    name: 'both refuse a part worth text',
    data: { entries: createEntriesWithOneFieldChanged(0, 'pointsByPart', { projeto: 'alto' }) },
    isValid: false,
  },
  // Ranks start at 1.
  {
    name: 'both refuse a rank of 0',
    data: { entries: createEntriesWithOneFieldChanged(0, 'rank', 0) },
    isValid: false,
  },
  // A column needs its heading.
  {
    name: 'both refuse a score part without its label',
    data: { entries: createOverallStandingsEntries(), scoreParts: [{ partId: 'projeto' }] },
    isValid: false,
  },
  // A typo'd top-level field must fail both.
  {
    name: 'both refuse a top-level field the graphic does not know',
    data: { entries: createOverallStandingsEntries(), titulo: 'CLASSIFICAÇÃO GERAL' },
    isValid: false,
  },
  // The one required field left out.
  {
    name: 'both refuse data without the entries',
    data: { title: 'CLASSIFICAÇÃO GERAL' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled; JSON drops undefined fields, as the
    // wire does.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(standingsManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteStandingsData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
