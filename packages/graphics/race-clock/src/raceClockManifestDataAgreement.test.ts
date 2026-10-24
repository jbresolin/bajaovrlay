// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/race-clock)
 *
 * What this module is for:
 *   race-clock.ograf.json describes the race clock's data as JSON Schema, for renderers
 *   and for the control page's generated form; raceClockModel.ts checks the same data
 *   with Zod when `load` and `updateAction` receive it. If the two disagreed, the form
 *   could offer a value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the everyday data; each of the six
 *     flag states; data without the leader's laps; the flag band switch on, off, left
 *     out or not a boolean; an unknown state, an unknown field, a fractional reading, a
 *     negative lap count and a missing required field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest (settings, titles, durations, the OGraf schema itself);
 *     raceClockManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1) like its sibling;
 *     it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import raceClockManifest from '../race-clock.ograf.json';
import { parseCompleteRaceClockData, type RaceClockData } from './raceClockModel.js';

/** Builds the data the server sends when the enduro is under green flag, 1:05:00 in. */
function createGreenFlagEnduroData(): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: Date.parse('2026-05-16T14:30:00.000Z'),
    running: true,
    lapsCompletedByLeader: 12,
    showFlagBand: true,
  };
}

const dataAgreementScenarios = [
  // The everyday payload must pass both checks.
  { name: 'both accept complete enduro data', data: createGreenFlagEnduroData(), isValid: true },
  // The leader's laps really are optional in both.
  {
    name: 'both accept data without the leader lap count',
    data: { ...createGreenFlagEnduroData(), lapsCompletedByLeader: undefined },
    isValid: true,
  },
  // The band switch on: the everyday clock with its flag band.
  {
    name: 'both accept the flag band switched on',
    data: { ...createGreenFlagEnduroData(), showFlagBand: true },
    isValid: true,
  },
  // The band switch off: the lower card without a band.
  {
    name: 'both accept the flag band switched off',
    data: { ...createGreenFlagEnduroData(), showFlagBand: false },
    isValid: true,
  },
  // The band switch left out (an item saved before the field existed): still valid.
  {
    name: 'both accept data without the flag band switch',
    data: { ...createGreenFlagEnduroData(), showFlagBand: undefined },
    isValid: true,
  },
  // The band switch must be a real boolean; a word would be a form bug.
  {
    name: 'both refuse a flag band switch that is not a boolean',
    data: { ...createGreenFlagEnduroData(), showFlagBand: 'sim' },
    isValid: false,
  },
  // One row per flag state the graphic draws, so a value dropped or misspelled in the
  // manifest's enum (or in Zod) fails here.
  // Before the start: the state a session is created in.
  {
    name: 'both accept the pre-start state',
    data: { ...createGreenFlagEnduroData(), state: 'pre' },
    isValid: true,
  },
  // Racing: the most common state; listed again here so all six sit together.
  {
    name: 'both accept the green flag',
    data: { ...createGreenFlagEnduroData(), state: 'green' },
    isValid: true,
  },
  // Caution: thrown on track incidents.
  {
    name: 'both accept the yellow flag',
    data: { ...createGreenFlagEnduroData(), state: 'yellow' },
    isValid: true,
  },
  // Session stopped: the clock is usually held.
  {
    name: 'both accept the red flag',
    data: { ...createGreenFlagEnduroData(), state: 'red' },
    isValid: true,
  },
  // The leader has crossed the line.
  {
    name: 'both accept the checkered flag',
    data: { ...createGreenFlagEnduroData(), state: 'checkered' },
    isValid: true,
  },
  // After the session: results are final.
  {
    name: 'both accept the finished state',
    data: { ...createGreenFlagEnduroData(), state: 'finished' },
    isValid: true,
  },
  // A state outside the six must fail both, or the form would offer a value the graphic refuses.
  {
    name: 'both refuse an unknown flag state',
    data: { ...createGreenFlagEnduroData(), state: 'blue' },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createGreenFlagEnduroData(), laps: 12 },
    isValid: false,
  },
  // Milliseconds are whole numbers in both.
  {
    name: 'both refuse a fractional clock reading',
    data: { ...createGreenFlagEnduroData(), referenceTimeMs: 1.5 },
    isValid: false,
  },
  // A lap count below zero is meaningless in both.
  {
    name: 'both refuse a negative lap count',
    data: { ...createGreenFlagEnduroData(), lapsCompletedByLeader: -1 },
    isValid: false,
  },
  // A missing required field fails both.
  {
    name: 'both refuse data without the running flag',
    data: { ...createGreenFlagEnduroData(), running: undefined },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(raceClockManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteRaceClockData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
