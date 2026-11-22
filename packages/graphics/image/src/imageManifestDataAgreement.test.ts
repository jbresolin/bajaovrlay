// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/image)
 *
 * What this module is for:
 *   image.ograf.json describes the image graphic's data as JSON Schema, for renderers and
 *   for the control page's generated form; imageModel.ts checks the same data with Zod when
 *   `load` and `updateAction` receive it. If the two disagreed, the form could offer a
 *   value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the image alone; every field at a limit;
 *     negative offsets; a background colour and a margin; a colour in capitals; no image; an
 *     empty image address; a tenth position; a size, an offset, an opacity and a margin
 *     past their limits; a fractional width; a background that is not "#rrggbb"; an
 *     unknown entrance; and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; imageManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import imageManifest from '../image.ograf.json';
import { type ImageData, parseCompleteImageData } from './imageModel.js';

/** Builds an item with only the image chosen: the event's poster. */
function createEventPosterData(): ImageData {
  return { imageUrl: '/media/4e2a91c7-cartaz-enduro-piracicaba' };
}

const dataAgreementScenarios = [
  // An item with only the file picked, everything else at its default.
  { name: 'both accept the image alone', data: createEventPosterData(), isValid: true },
  // Every field at its smallest edge.
  {
    name: 'both accept every field at its smallest',
    data: {
      ...createEventPosterData(),
      widthPx: 16,
      heightPx: 16,
      position: 'top-left',
      offsetXPx: -1920,
      offsetYPx: -1080,
      opacityPercent: 10,
      entrance: 'none',
      marginPx: 0,
    },
    isValid: true,
  },
  // Every field at its largest edge.
  {
    name: 'both accept every field at its largest',
    data: {
      ...createEventPosterData(),
      widthPx: 3840,
      heightPx: 2160,
      position: 'bottom-right',
      offsetXPx: 1920,
      offsetYPx: 1080,
      opacityPercent: 100,
      entrance: 'fade',
      marginPx: 200,
    },
    isValid: true,
  },
  // João's background: a dark plate around a sponsor's logo.
  {
    name: 'both accept the background #0a0a0a with a 12 px margin',
    data: { ...createEventPosterData(), backgroundColor: '#0a0a0a', marginPx: 12 },
    isValid: true,
  },
  // Capitals: the OGraf GDD fixes "color-rrggbb" to lower case, so both refuse them.
  {
    name: 'both refuse the background #0A0A0A in capitals',
    data: { ...createEventPosterData(), backgroundColor: '#0A0A0A' },
    isValid: false,
  },
  // An item saved before a file was picked.
  { name: 'both refuse data without the image', data: {}, isValid: false },
  // A field cleared to nothing.
  { name: 'both refuse an empty image address', data: { imageUrl: '' }, isValid: false },
  // A tenth position.
  {
    name: 'both refuse the position "center"',
    data: { ...createEventPosterData(), position: 'center' },
    isValid: false,
  },
  // Past the width limit.
  {
    name: 'both refuse a width of 3841 px',
    data: { ...createEventPosterData(), widthPx: 3841 },
    isValid: false,
  },
  // Whole pixels only.
  {
    name: 'both refuse a width of 480.5 px',
    data: { ...createEventPosterData(), widthPx: 480.5 },
    isValid: false,
  },
  // Under the height limit.
  {
    name: 'both refuse a height of 15 px',
    data: { ...createEventPosterData(), heightPx: 15 },
    isValid: false,
  },
  // More than a whole canvas to the left.
  {
    name: 'both refuse an X offset of -1921 px',
    data: { ...createEventPosterData(), offsetXPx: -1921 },
    isValid: false,
  },
  // More than a whole canvas down.
  {
    name: 'both refuse a Y offset of 1081 px',
    data: { ...createEventPosterData(), offsetYPx: 1081 },
    isValid: false,
  },
  // Under the opacity limit.
  {
    name: 'both refuse an opacity of 9%',
    data: { ...createEventPosterData(), opacityPercent: 9 },
    isValid: false,
  },
  // Past the margin limit.
  {
    name: 'both refuse a margin of 201 px',
    data: { ...createEventPosterData(), marginPx: 201 },
    isValid: false,
  },
  // CSS shorthand is not "#RRGGBB".
  {
    name: 'both refuse the background #000',
    data: { ...createEventPosterData(), backgroundColor: '#000' },
    isValid: false,
  },
  // Without the hash.
  {
    name: 'both refuse the background 0a0a0a',
    data: { ...createEventPosterData(), backgroundColor: '0a0a0a' },
    isValid: false,
  },
  // A ninth digit of alpha is not part of the brief.
  {
    name: 'both refuse the background #0a0a0a80',
    data: { ...createEventPosterData(), backgroundColor: '#0a0a0a80' },
    isValid: false,
  },
  // A third entrance.
  {
    name: 'both refuse the entrance "slide"',
    data: { ...createEventPosterData(), entrance: 'slide' },
    isValid: false,
  },
  // The logo bug's field name, by mistake.
  {
    name: 'both refuse an unknown field',
    data: { ...createEventPosterData(), logoUrl: '/media/3b8f0c2e-logo-baja-sae-brasil' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator, and the payload as it
    // travels on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(imageManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteImageData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
