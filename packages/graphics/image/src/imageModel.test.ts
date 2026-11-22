/**
 * The image graphic's data: what it accepts, its defaults and its limits
 * (packages/graphics/image)
 *
 * What this module is for:
 *   imageModel.ts is the boundary check for the data `load` and `updateAction` receive
 *   (Zod), the merge of a partial update, and the look the data asks for once the defaults
 *   are filled in: how wide, how tall, where, how opaque, which entrance, which background.
 *   The image is the one field the operator must give; the rest start from the brief's
 *   defaults.
 *
 * What these tests prove:
 *   - The image alone is complete data, and reads as 480 px wide with the height left to
 *     the file, centred with no offset, fully opaque, faded in, with no background and no
 *     margin.
 *   - What the item chose wins over each default; the opacity is read as a fraction.
 *   - The limits: each edge is taken and one step past it is refused, naming the field;
 *     offsets may be negative; a background is "#rrggbb" in lower case and nothing else.
 *   - Data without the image, with an unknown position or with a field the graphic does
 *     not know is refused, naming the field.
 *   - An update merges into the current data: one that moves the image keeps its width;
 *     one that clears the height (sends it as undefined) gives the height back to the file;
 *     a refused one leaves the current data untouched.
 *
 * What these tests deliberately do not cover:
 *   - The JSON Schema in the manifest; imageManifestDataAgreement.test.ts runs the same
 *     payloads through both.
 *   - Where a position lands on screen; imageBoxPosition.test.ts and the e2e tests.
 */
import { describe, expect, it } from 'vitest';

import {
  type ImageData,
  mergePartialUpdateIntoImageData,
  parseCompleteImageData,
  readImageLook,
} from './imageModel.js';

/** Builds an item with only the image chosen: the event's poster. */
function createEventPosterData(): ImageData {
  return { imageUrl: '/media/4e2a91c7-cartaz-enduro-piracicaba' };
}

describe('the defaults', () => {
  it('reads the image alone as 480 px wide, centred, opaque, faded in, with no background', () => {
    // Arrange: the image and nothing else.
    const data = createEventPosterData();

    // Act: check it and read the look it asks for.
    const check = parseCompleteImageData(data);
    const look = check.isValid ? readImageLook(check.data) : undefined;

    // Assert: complete data, and the brief's defaults for every other field.
    expect(check.isValid, 'the image alone is complete data').toBe(true);
    expect(look, 'the defaults must fill in every field but the image').toEqual({
      imageUrl: '/media/4e2a91c7-cartaz-enduro-piracicaba',
      widthPx: 480,
      heightPx: undefined,
      position: 'middle-center',
      offsetXPx: 0,
      offsetYPx: 0,
      opacity: 1,
      entrance: 'fade',
      backgroundColor: undefined,
      marginPx: 0,
    });
  });

  it('reads what the item chose over the defaults, the opacity as a fraction', () => {
    // Arrange: a sponsor's banner in a 600x200 box at the bottom, on a dark plate.
    const data: ImageData = {
      ...createEventPosterData(),
      widthPx: 600,
      heightPx: 200,
      position: 'bottom-center',
      offsetXPx: -40,
      offsetYPx: -80,
      opacityPercent: 85,
      entrance: 'none',
      backgroundColor: '#0a0a0a',
      marginPx: 12,
    };

    // Act: read the look.
    const look = readImageLook(data);

    // Assert: the item's choices, 85% written as 0.85 for CSS.
    expect(look, 'the item’s choices must win over the defaults').toEqual({
      imageUrl: '/media/4e2a91c7-cartaz-enduro-piracicaba',
      widthPx: 600,
      heightPx: 200,
      position: 'bottom-center',
      offsetXPx: -40,
      offsetYPx: -80,
      opacity: 0.85,
      entrance: 'none',
      backgroundColor: '#0a0a0a',
      marginPx: 12,
    });
  });
});

const limitScenarios = [
  // The smallest box there is.
  { name: 'takes a width of 16 px', field: { widthPx: 16 }, isValid: true },
  // One pixel under it.
  { name: 'refuses a width of 15 px', field: { widthPx: 15 }, isValid: false },
  // Twice the canvas: the most the operator can ask for.
  { name: 'takes a width of 3840 px', field: { widthPx: 3840 }, isValid: true },
  // Past it.
  { name: 'refuses a width of 3841 px', field: { widthPx: 3841 }, isValid: false },
  // Whole pixels only.
  { name: 'refuses a width of 480.5 px', field: { widthPx: 480.5 }, isValid: false },
  // The tallest box: twice the canvas.
  { name: 'takes a height of 2160 px', field: { heightPx: 2160 }, isValid: true },
  // Past it.
  { name: 'refuses a height of 2161 px', field: { heightPx: 2161 }, isValid: false },
  // An offset may be negative, as far as a whole canvas.
  { name: 'takes an X offset of -1920 px', field: { offsetXPx: -1920 }, isValid: true },
  // Past a whole canvas.
  { name: 'refuses an X offset of 1921 px', field: { offsetXPx: 1921 }, isValid: false },
  // A whole canvas up.
  { name: 'takes a Y offset of -1080 px', field: { offsetYPx: -1080 }, isValid: true },
  // Past it.
  { name: 'refuses a Y offset of -1081 px', field: { offsetYPx: -1081 }, isValid: false },
  // The faintest an image on air may be.
  { name: 'takes an opacity of 10%', field: { opacityPercent: 10 }, isValid: true },
  // So faint it would look missing.
  { name: 'refuses an opacity of 9%', field: { opacityPercent: 9 }, isValid: false },
  // A colour as the OGraf GDD writes it: "#rrggbb", lower case.
  { name: 'takes the background #1a2b3c', field: { backgroundColor: '#1a2b3c' }, isValid: true },
  // The GDD's "color-rrggbb" pattern has no capitals.
  { name: 'refuses the background #1A2B3C', field: { backgroundColor: '#1A2B3C' }, isValid: false },
  // Three digits is CSS shorthand, not "#rrggbb".
  { name: 'refuses the background #fff', field: { backgroundColor: '#fff' }, isValid: false },
  // A colour name is not "#rrggbb" either.
  { name: 'refuses the background "preto"', field: { backgroundColor: 'preto' }, isValid: false },
  // The widest margin.
  { name: 'takes a margin of 200 px', field: { marginPx: 200 }, isValid: true },
  // A margin cannot pull inwards.
  { name: 'refuses a margin of -1 px', field: { marginPx: -1 }, isValid: false },
];

describe('the limits', () => {
  it.each(limitScenarios)('$name', ({ field, isValid }) => {
    // Arrange: the event poster with the one field of this row.
    const data = { ...createEventPosterData(), ...field };

    // Act: check it.
    const check = parseCompleteImageData(data);

    // Assert: taken or refused as the row says.
    expect(check.isValid, 'the data must be taken or refused as the row says').toBe(isValid);
  });

  it('names the field in pt-BR when a value is refused', () => {
    // Arrange: a width past the limit.
    const data = { ...createEventPosterData(), widthPx: 5000 };

    // Act: check it.
    const check = parseCompleteImageData(data);

    // Assert: the problem names the width.
    expect(check, 'the refusal must name the field').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "widthPx".',
    });
  });
});

describe('data that is refused', () => {
  const refusedScenarios = [
    // An item saved before a file was picked.
    { name: 'no image', data: {}, problem: 'Falta o campo obrigatório "imageUrl".' },
    // A tenth position, from an old form or a typo.
    {
      name: 'an unknown position',
      data: { ...createEventPosterData(), position: 'center' },
      problem: 'Valor inválido no campo "position".',
    },
    // The logo bug's field name, by mistake.
    {
      name: 'an unknown field',
      data: { ...createEventPosterData(), corner: 'top-left' },
      problem: 'Campo desconhecido nos dados: "corner".',
    },
  ];

  it.each(refusedScenarios)('refuses $name, naming the field', ({ data, problem }) => {
    // Arrange: the data of this row.

    // Act: check it.
    const check = parseCompleteImageData(data);

    // Assert: refused with the row's pt-BR problem.
    expect(check, 'the data must be refused with the row’s problem').toEqual({
      isValid: false,
      problem,
    });
  });
});

describe('mergePartialUpdateIntoImageData', () => {
  it('moves the image and keeps its width', () => {
    // Arrange: the poster at 600 px, centred.
    const currentData: ImageData = { ...createEventPosterData(), widthPx: 600 };

    // Act: move it to the top-right corner, 40 px in.
    const check = mergePartialUpdateIntoImageData(currentData, {
      position: 'top-right',
      offsetXPx: -40,
    });

    // Assert: the new position and offset, the width kept.
    expect(check, 'the update must merge into the current data').toEqual({
      isValid: true,
      data: {
        ...createEventPosterData(),
        widthPx: 600,
        position: 'top-right',
        offsetXPx: -40,
      },
    });
  });

  it('gives the height back to the file when the update clears it', () => {
    // Arrange: the poster in a 600x200 box.
    const currentData: ImageData = { ...createEventPosterData(), widthPx: 600, heightPx: 200 };

    // Act: the renderer sends the cleared height as undefined, as it does for a cleared field.
    const check = mergePartialUpdateIntoImageData(currentData, { heightPx: undefined });
    const look = check.isValid ? readImageLook(check.data) : undefined;

    // Assert: no height any more, so the file's proportions decide it.
    expect(look?.heightPx, 'a cleared height must leave the height to the file').toBeUndefined();
    expect(look?.widthPx, 'the width must be kept').toBe(600);
  });

  it('refuses a bad update and leaves the current data untouched', () => {
    // Arrange: the poster at 600 px.
    const currentData: ImageData = { ...createEventPosterData(), widthPx: 600 };

    // Act: an update with a background that is not a colour.
    const check = mergePartialUpdateIntoImageData(currentData, { backgroundColor: 'azul' });

    // Assert: refused naming the field, and the current data as it was.
    expect(check, 'the bad update must be refused naming the field').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "backgroundColor".',
    });
    expect(currentData, 'the current data must not change').toEqual({
      ...createEventPosterData(),
      widthPx: 600,
    });
  });
});
