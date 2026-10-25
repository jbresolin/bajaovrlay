// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/podium)
 *
 * What this module is for:
 *   podium.ograf.json describes the data as JSON Schema, for renderers and the control
 *   page's form; podiumModel.ts checks the same data with Zod in `load` and `updateAction`.
 *   If they disagreed, the form could offer a value the graphic refuses, or refuse one it
 *   would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the enduro's podium with logos, title and
 *     event line; the entries alone; the overall standings with a tie (ranks, points); an
 *     entry carrying fields the podium does not draw (laps, status: passes); a list of one;
 *     and refused: no entries, an empty list, an entry without its team, a car number of 0,
 *     a logo plate written as text, a top-level field the podium does not know.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; podiumManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import podiumManifest from '../podium.ograf.json';
import { parseCompletePodiumData } from './podiumModel.js';
import {
  createEnduroPodium,
  createEnduroPodiumEntries,
  createOverallPodiumWithATieForFirst,
} from './previewData.js';

/** The enduro's three with one field of one entry changed (removed when the value is undefined). */
function createEntriesWithOneFieldChanged(
  entryIndex: number,
  fieldName: string,
  value: unknown,
): Record<string, unknown>[] {
  return createEnduroPodiumEntries(true).map((entry, index) =>
    index === entryIndex ? { ...entry, [fieldName]: value } : { ...entry },
  );
}

const dataAgreementScenarios = [
  // The everyday payload: the enduro's three with logos, title and event line.
  {
    name: 'both accept the enduro’s podium with logos, title and event line',
    data: createEnduroPodium(true),
    isValid: true,
  },
  // An item that binds the list and types nothing else.
  {
    name: 'both accept the entries alone',
    data: { entries: createEnduroPodiumEntries(false) },
    isValid: true,
  },
  // The overall podium from the standings: ranks (tied) and points instead of positions.
  {
    name: 'both accept the overall standings with a tie for first',
    data: createOverallPodiumWithATieForFirst(),
    isValid: true,
  },
  // A session with one car classified still makes a podium.
  {
    name: 'both accept a list of one',
    data: { entries: createEnduroPodiumEntries(false).slice(0, 1) },
    isValid: true,
  },
  // The one required field left out.
  { name: 'both refuse data without entries', data: { title: 'PÓDIO' }, isValid: false },
  // A podium of nobody.
  { name: 'both refuse an empty list', data: { entries: [] }, isValid: false },
  // A card without its team cannot be drawn.
  {
    name: 'both refuse an entry without its team',
    data: { entries: createEntriesWithOneFieldChanged(1, 'teamName', undefined) },
    isValid: false,
  },
  // Car numbers start at 1.
  {
    name: 'both refuse a car number of 0',
    data: { entries: createEntriesWithOneFieldChanged(0, 'carNumber', 0) },
    isValid: false,
  },
  // The plate is a yes or no, not a word.
  {
    name: 'both refuse a logo plate written as text',
    data: { entries: createEntriesWithOneFieldChanged(2, 'logoOnLightPlate', 'sim') },
    isValid: false,
  },
  // A typo'd top-level field must fail both.
  {
    name: 'both refuse a top-level field the podium does not know',
    data: { entries: createEnduroPodiumEntries(false), titulo: 'PÓDIO' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled; JSON drops undefined fields, as the
    // wire does.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(podiumManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompletePodiumData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
