// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/qr-card)
 *
 * What this module is for:
 *   qr-card.ograf.json describes the QR card's data as JSON Schema, for renderers, for the
 *   server's check and for the control page's generated form; qrCardModel.ts checks the same
 *   data with Zod and the address's own rules when `load` and `updateAction` receive it. If
 *   the two disagreed, the form could offer an address the graphic refuses.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the design's card; the longest address;
 *     and an empty address, a space, an accent, one character past the longest length, a
 *     missing address, a call to action that is not text, and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest (settings, titles, durations, the OGraf schema itself);
 *     qrCardManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import qrCardManifest from '../qr-card.ograf.json';
import { buildLongestSampleAddress, createResultsSample } from './previewData.js';
import { parseCompleteQrCardData } from './qrCardModel.js';

const dataAgreementScenarios = [
  // The everyday card must pass both checks.
  { name: 'both accept the design’s card', data: createResultsSample(), isValid: true },
  // The limit itself is allowed in both.
  {
    name: 'both accept an address of exactly the longest length',
    data: { ...createResultsSample(), address: buildLongestSampleAddress() },
    isValid: true,
  },
  // An empty address is no code.
  {
    name: 'both refuse an empty address',
    data: { ...createResultsSample(), address: '' },
    isValid: false,
  },
  // The manifest's pattern and the model's rule refuse a space alike.
  {
    name: 'both refuse an address with a space',
    data: { ...createResultsSample(), address: 'resultados bajasaebrasil.net' },
    isValid: false,
  },
  // And an accent, which the encoder would cut to the wrong byte.
  {
    name: 'both refuse an address with an accent',
    data: { ...createResultsSample(), address: 'bajasaebrasil.net/competição' },
    isValid: false,
  },
  // maxLength in the manifest, the longest length in the model.
  {
    name: 'both refuse an address one character past the longest length',
    data: { ...createResultsSample(), address: `${buildLongestSampleAddress()}x` },
    isValid: false,
  },
  // Both fields are required.
  {
    name: 'both refuse data without the address',
    data: { callToAction: 'Acompanhe os resultados' },
    isValid: false,
  },
  // The call to action is text in both.
  {
    name: 'both refuse a call to action that is not text',
    data: { ...createResultsSample(), callToAction: 30 },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createResultsSample(), url: 'resultados.bajasaebrasil.net' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(qrCardManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteQrCardData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
