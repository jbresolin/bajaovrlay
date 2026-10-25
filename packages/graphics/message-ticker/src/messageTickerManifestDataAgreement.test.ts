// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/message-ticker)
 *
 * What this module is for:
 *   message-ticker.ograf.json describes the ticker's data as JSON Schema, for renderers and
 *   for the item form (which checks a message's length with it before sending);
 *   messageTickerModel.ts checks the same data with Zod. If the two disagreed, the form
 *   could let through a message the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: three messages; one; nine; a message of
 *     exactly 50 characters (accents included); and no message, ten messages, an empty
 *     message, a message of spaces, one of 51 characters, a label of 11, and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; messageTickerManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import messageTickerManifest from '../message-ticker.ograf.json';
import { parseCompleteMessageTickerData } from './messageTickerModel.js';
import { createEnduroTickerData } from './messageTickerOnThePage.testSupport.js';

/** A message of exactly `length` characters, accented like Portuguese: "ÀÉÍ…". */
function writeMessageOfLength(length: number): string {
  return 'PREMIAÇÃO NO PALCO PRINCIPAL ÀS 16H, ATENÇÃO EQUIPES E PÚBLICO GERAL'.slice(0, length);
}

const dataAgreementScenarios = [
  // The design's ticker.
  { name: 'both accept three messages', data: createEnduroTickerData(), isValid: true },
  // One message: a ticker that never turns.
  {
    name: 'both accept one message',
    data: { ...createEnduroTickerData(), messages: ['Box aberto para abastecimento'] },
    isValid: true,
  },
  // The most the page cell allows for.
  {
    name: 'both accept nine messages',
    data: {
      ...createEnduroTickerData(),
      messages: Array.from({ length: 9 }, (_u, i) => `Aviso ${i + 1}`),
    },
    isValid: true,
  },
  // The limit itself, with accented capitals counted once.
  {
    name: 'both accept a message of exactly 50 characters',
    data: { ...createEnduroTickerData(), messages: [writeMessageOfLength(50)] },
    isValid: true,
  },
  // At least one message.
  {
    name: 'both refuse a ticker with no message',
    data: { ...createEnduroTickerData(), messages: [] },
    isValid: false,
  },
  // A tenth page would widen the page cell.
  {
    name: 'both refuse ten messages',
    data: {
      ...createEnduroTickerData(),
      messages: Array.from({ length: 10 }, (_u, i) => `Aviso ${i + 1}`),
    },
    isValid: false,
  },
  // An empty line left in the list.
  {
    name: 'both refuse an empty message',
    data: { ...createEnduroTickerData(), messages: ['Largada do enduro às 10h00', ''] },
    isValid: false,
  },
  // A message of spaces, which a script might send: the pattern "\S" refuses it.
  {
    name: 'both refuse a message of spaces',
    data: { ...createEnduroTickerData(), messages: ['Largada do enduro às 10h00', '   '] },
    isValid: false,
  },
  // One character over the bar.
  {
    name: 'both refuse a message of 51 characters',
    data: { ...createEnduroTickerData(), messages: [`${writeMessageOfLength(50)}!`] },
    isValid: false,
  },
  // A label over its limit takes the message's room.
  {
    name: 'both refuse a label of 11 characters',
    data: { ...createEnduroTickerData(), label: 'ATENÇÃO JÁ!' },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createEnduroTickerData(), message: 'Largada do enduro às 10h00' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(messageTickerManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteMessageTickerData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
