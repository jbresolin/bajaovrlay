// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   lower-strip.ograf.json describes the strip's data as JSON Schema, for renderers and
 *   for the control page's generated form; lowerStripModel.ts checks the same data with
 *   Zod. If the two disagreed, the form could offer a value the graphic refuses, or refuse
 *   one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the real 34-car strip; an empty field
 *     before the start; the block switched off; a positions entry with every field; and a
 *     car without its school, a position of 0, a negative clock time, an unknown flag, a
 *     missing clock field and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; lowerStripManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import lowerStripManifest from '../lower-strip.ograf.json';
import { parseCompleteLowerStripData } from './lowerStripModel.js';
import { createRealEnduroStripData } from './lowerStripOnThePage.testSupport.js';

const dataAgreementScenarios = [
  // The everyday strip must pass both checks.
  { name: 'both accept the real 34-car strip', data: createRealEnduroStripData(), isValid: true },
  // Before the start the positions may list no car yet.
  {
    name: 'both accept an empty running order',
    data: { ...createRealEnduroStripData(), entries: [] },
    isValid: true,
  },
  // The race clock card is up, so the block is off.
  {
    name: 'both accept the block switched off',
    data: { ...createRealEnduroStripData(), showClockBlock: false },
    isValid: true,
  },
  // A whole positions entry, with fields the strip never draws, fits as it comes.
  {
    name: 'both accept a positions entry with every field',
    data: {
      ...createRealEnduroStripData(),
      entries: [
        {
          position: 1,
          carNumber: 51,
          schoolName: 'FAHOR',
          laps: 43,
          status: 'running',
          pitStops: 3,
        },
      ],
    },
    isValid: true,
  },
  // The school is what the pill names: required in both.
  {
    name: 'both refuse a car without its school',
    data: { ...createRealEnduroStripData(), entries: [{ position: 1, carNumber: 51 }] },
    isValid: false,
  },
  // Positions start at 1 in both.
  {
    name: 'both refuse a position of 0',
    data: {
      ...createRealEnduroStripData(),
      entries: [{ position: 0, carNumber: 51, schoolName: 'FAHOR' }],
    },
    isValid: false,
  },
  // The clock's reference time is never negative.
  {
    name: 'both refuse a negative clock time',
    data: { ...createRealEnduroStripData(), referenceTimeMs: -1 },
    isValid: false,
  },
  // A flag the session does not know.
  {
    name: 'both refuse an unknown flag',
    data: { ...createRealEnduroStripData(), state: 'azul' },
    isValid: false,
  },
  // The clock fields are required, as the race clock's are.
  {
    name: 'both refuse a strip without the running switch',
    data: { ...createRealEnduroStripData(), running: undefined },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createRealEnduroStripData(), showClock: true },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(lowerStripManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteLowerStripData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
