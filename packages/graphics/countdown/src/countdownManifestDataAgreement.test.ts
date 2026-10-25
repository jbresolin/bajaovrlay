// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/countdown)
 *
 * What this module is for:
 *   countdown.ograf.json describes the data as JSON Schema, for renderers and for the
 *   control page's form; countdownModel.ts checks the same data with Zod. If the two
 *   disagreed, the form could offer a value the graphic refuses, or refuse one it takes.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both: the card, the waiting board, the card without
 *     head lines; and a start as text, a negative start, an empty session, an unknown
 *     layout and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; countdownManifest.test.ts.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import countdownManifest from '../countdown.ograf.json';
import { type CountdownData, parseCompleteCountdownData } from './countdownModel.js';

/** The enduro's waiting board, as an item from the schedule gives it. */
function createEnduroWaitingBoardData(): CountdownData {
  return {
    layout: 'fullscreen',
    sessionName: 'Enduro de Resistência',
    startsAtMs: Date.parse('2025-03-30T10:00:00.000-03:00'),
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
  };
}

const dataAgreementScenarios = [
  // The everyday waiting board.
  { name: 'both accept the waiting board', data: createEnduroWaitingBoardData(), isValid: true },
  // The card on the clock layer.
  {
    name: 'both accept the card',
    data: { ...createEnduroWaitingBoardData(), layout: 'card' },
    isValid: true,
  },
  // The head lines are optional.
  {
    name: 'both accept the board without head lines',
    data: {
      layout: 'fullscreen',
      sessionName: 'Super Prime',
      startsAtMs: Date.parse('2025-03-30T14:30:00.000-03:00'),
    },
    isValid: true,
  },
  // The start is milliseconds, never the ISO text of a text field.
  {
    name: 'both refuse a start written as text',
    data: { ...createEnduroWaitingBoardData(), startsAtMs: '2025-03-30T13:00:00.000Z' },
    isValid: false,
  },
  // A moment before 1970 is a typing mistake.
  {
    name: 'both refuse a negative start',
    data: { ...createEnduroWaitingBoardData(), startsAtMs: -1 },
    isValid: false,
  },
  // A session must be named.
  {
    name: 'both refuse an empty session',
    data: { ...createEnduroWaitingBoardData(), sessionName: '' },
    isValid: false,
  },
  // Two layouts only.
  {
    name: 'both refuse an unknown layout',
    data: { ...createEnduroWaitingBoardData(), layout: 'faixa' },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createEnduroWaitingBoardData(), eventName: 'Enduro' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled; the payload as JSON sends it.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(countdownManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteCountdownData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
