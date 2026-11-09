/**
 * The logo bug's data: what it accepts, its defaults and its limits
 * (packages/graphics/logo-bug)
 *
 * What this module is for:
 *   logoBugModel.ts is the boundary check for the data `load` and `updateAction` receive
 *   (Zod), the merge of a partial update, and the look the data asks for once the defaults
 *   are filled in: which corner, how tall, how opaque. The channel's logo is the one field
 *   the operator must give; the rest start from the brief's defaults.
 *
 * What these tests prove:
 *   - The logo alone is complete data, and reads as the bottom-right corner, 80 px high
 *     and fully opaque.
 *   - The limits the brief fixes: the height from 32 to 200 px in whole pixels, the
 *     opacity from 30% to 100% in whole percent; each edge is taken and one step past it
 *     is refused with a pt-BR message naming the field.
 *   - Data without the logo, with an empty logo address, with a corner that is not one of
 *     the four, or with a field the graphic does not know, is refused, naming the field.
 *   - An update merges into the current data: one that changes the corner keeps the logo
 *     and the height; a refused one leaves the current data untouched.
 *
 * What these tests deliberately do not cover:
 *   - The JSON Schema in the manifest; logoBugManifestDataAgreement.test.ts runs the same
 *     payloads through both.
 *   - Where a corner lands on screen; the kit's screenCornerPosition tests and the
 *     screenshots cover it.
 */
import { describe, expect, it } from 'vitest';

import {
  type LogoBugData,
  mergePartialUpdateIntoLogoBugData,
  parseCompleteLogoBugData,
  readLogoBugLook,
} from './logoBugModel.js';

/** Builds the channel's logo as an item with only the image chosen gives it. */
function createChannelLogoData(): LogoBugData {
  return { logoUrl: '/media/3b8f0c2e-logo-baja-sae-brasil' };
}

describe('the defaults', () => {
  it('reads the logo alone as the bottom-right corner, 80 px high and fully opaque', () => {
    // Arrange: the logo and nothing else.
    const data = createChannelLogoData();

    // Act: check it and read the look it asks for.
    const check = parseCompleteLogoBugData(data);
    const look = check.isValid ? readLogoBugLook(check.data) : undefined;

    // Assert: complete data, and the brief's defaults.
    expect(check.isValid, 'the logo alone is complete data').toBe(true);
    expect(look, 'the defaults must fill in the corner, the height and the opacity').toEqual({
      logoUrl: '/media/3b8f0c2e-logo-baja-sae-brasil',
      corner: 'bottom-right',
      heightPx: 80,
      opacity: 1,
    });
  });

  it('reads what the item chose over the defaults, the opacity as a fraction', () => {
    // Arrange: a small, half-transparent logo top-left.
    const data: LogoBugData = {
      ...createChannelLogoData(),
      corner: 'top-left',
      heightPx: 48,
      opacityPercent: 50,
    };

    // Act: read the look.
    const look = readLogoBugLook(data);

    // Assert: the item's choices, 50% written as 0.5 for CSS.
    expect(look, 'the item’s choices must win over the defaults').toEqual({
      logoUrl: '/media/3b8f0c2e-logo-baja-sae-brasil',
      corner: 'top-left',
      heightPx: 48,
      opacity: 0.5,
    });
  });
});

const limitScenarios = [
  // The smallest height the brief allows.
  { name: 'takes a height of 32 px', change: { heightPx: 32 }, problem: undefined },
  // The largest.
  { name: 'takes a height of 200 px', change: { heightPx: 200 }, problem: undefined },
  // One pixel under: a logo too small to read.
  {
    name: 'refuses a height of 31 px',
    change: { heightPx: 31 },
    problem: 'Valor inválido no campo "heightPx".',
  },
  // One pixel over: a logo that covers the picture.
  {
    name: 'refuses a height of 201 px',
    change: { heightPx: 201 },
    problem: 'Valor inválido no campo "heightPx".',
  },
  // The form writes whole pixels; a fraction would only blur the edge.
  {
    name: 'refuses a height of 80.5 px',
    change: { heightPx: 80.5 },
    problem: 'Valor inválido no campo "heightPx".',
  },
  // The faintest the brief allows.
  { name: 'takes an opacity of 30%', change: { opacityPercent: 30 }, problem: undefined },
  // Under it the logo would be a smudge on the picture.
  {
    name: 'refuses an opacity of 29%',
    change: { opacityPercent: 29 },
    problem: 'Valor inválido no campo "opacityPercent".',
  },
  // A fraction written by someone thinking 0..1 instead of percent.
  {
    name: 'refuses an opacity of 0.5, which is not a percent',
    change: { opacityPercent: 0.5 },
    problem: 'Valor inválido no campo "opacityPercent".',
  },
  // Past fully opaque there is nothing.
  {
    name: 'refuses an opacity of 101%',
    change: { opacityPercent: 101 },
    problem: 'Valor inválido no campo "opacityPercent".',
  },
];

describe('the limits', () => {
  it.each(limitScenarios)('$name', ({ change, problem }) => {
    // Arrange: the channel's logo with the row's height or opacity.
    const data = { ...createChannelLogoData(), ...change };

    // Act: check it.
    const check = parseCompleteLogoBugData(data);

    // Assert: taken, or refused with a message naming the field.
    const answer = check.isValid ? undefined : check.problem;
    expect(answer, 'the limit must be applied as the row says').toBe(problem);
  });
});

const refusedDataScenarios = [
  // The item seeded with no image: the take must be refused, never an empty logo on air.
  {
    name: 'refuses data without the logo',
    data: {},
    problem: 'Falta o campo obrigatório "logoUrl".',
  },
  // A field cleared in the form.
  {
    name: 'refuses an empty logo address',
    data: { logoUrl: '' },
    problem: 'Valor inválido no campo "logoUrl".',
  },
  // A centre position, which the brief leaves out.
  {
    name: 'refuses a corner that is not one of the four',
    data: { ...createChannelLogoData(), corner: 'bottom-center' },
    problem: 'Valor inválido no campo "corner".',
  },
  // The sponsor bug's field name, by mistake.
  {
    name: 'refuses a field it does not know',
    data: { ...createChannelLogoData(), sponsorLogoUrl: '/media/7d1e3a5c-logo-serra-azul' },
    problem: 'Campo desconhecido nos dados: "sponsorLogoUrl".',
  },
];

describe('refused data', () => {
  it.each(refusedDataScenarios)('$name', ({ data, problem }) => {
    // Arrange: the data comes from the scenario row above.

    // Act: check it.
    const check = parseCompleteLogoBugData(data);

    // Assert: refused, with a pt-BR message naming the field.
    expect(check, 'the data must be refused naming the field').toEqual({
      isValid: false,
      problem,
    });
  });
});

describe('mergePartialUpdateIntoLogoBugData', () => {
  it('moves the logo to another corner and keeps its image and height', () => {
    // Arrange: a 120 px logo in the bottom-right corner.
    const currentData: LogoBugData = { ...createChannelLogoData(), heightPx: 120 };

    // Act: the operator moves it top-left.
    const check = mergePartialUpdateIntoLogoBugData(currentData, { corner: 'top-left' });

    // Assert: the new corner, the same image and height.
    expect(check, 'only the corner must change').toEqual({
      isValid: true,
      data: { logoUrl: '/media/3b8f0c2e-logo-baja-sae-brasil', heightPx: 120, corner: 'top-left' },
    });
  });

  it('refuses a bad update and leaves the current data as it was', () => {
    // Arrange: the channel's logo.
    const currentData = createChannelLogoData();

    // Act: an update with a height past the limit.
    const check = mergePartialUpdateIntoLogoBugData(currentData, { heightPx: 400 });

    // Assert: refused naming the field, and the current data unchanged.
    expect(check, 'the update must be refused naming the field').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "heightPx".',
    });
    expect(currentData, 'a refused update must change nothing').toEqual(createChannelLogoData());
  });
});
