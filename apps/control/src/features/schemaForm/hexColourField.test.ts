/**
 * A colour field (`gddType: "color-rrggbb"`) in the generated form (apps/control)
 *
 * What this module is for:
 *   The image graphic's "Fundo" (BAJAOVRLAY-84) is a text marked with the OGraf GDD's
 *   `color-rrggbb`, whose pattern the GDD fixes as "#" and six lower-case hex digits. The
 *   item editor has no colour picker, so it stays a text field: the form reads what was
 *   typed in lower case (fieldValueConversion.ts) and checks the colour itself
 *   (describeSchemaFormFromDataSchema.ts marks the field, zodSchemaFromDataSchema.ts adds
 *   the rule), so the operator reads why under the field instead of a refusal from the
 *   server.
 *
 * What these tests prove:
 *   - Only a text with `gddType: "color-rrggbb"` is read as a colour; a plain text with a
 *     pattern of its own (the lower third's "\S") is not.
 *   - "#0a0a0a" passes as typed, and "#0A0A0A" passes and is saved as "#0a0a0a"; three
 *     digits, no "#" and a colour name are refused with one pt-BR message naming the
 *     field and showing an example.
 *   - Left out, the optional colour passes: no background.
 *
 * What these tests deliberately do not cover:
 *   - Other `pattern`s, which the form still leaves to the server (the file's header).
 *   - The whole editor; ItemEditorPanelImage.test.tsx opens it on a real image item.
 */
import { describe, expect, it } from 'vitest';

import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { readDataValueFromFormValue } from './fieldValueConversion';
import { buildZodSchemaFromDataSchema } from './zodSchemaFromDataSchema';

/** The data schema of an image item's two text fields, as image.ograf.json writes them. */
function buildBackgroundFieldDataSchema() {
  return {
    type: 'object',
    properties: {
      imageUrl: { type: 'string', title: 'Imagem', minLength: 1 },
      backgroundColor: {
        type: 'string',
        title: 'Fundo',
        pattern: '^#[0-9a-f]{6}$',
        gddType: 'color-rrggbb',
      },
      legenda: { type: 'string', title: 'Legenda', pattern: '\\S' },
    },
    required: ['imageUrl'],
  };
}

const theColourMessage =
  'Use uma cor no formato #rrggbb em "Fundo", por exemplo #0a0a0a; deixe vazio para não ter cor.';

describe('reading a colour field', () => {
  it('marks only the color-rrggbb text as a colour', () => {
    // Arrange: the schema with a colour, the image address and a patterned caption.
    const dataSchema = buildBackgroundFieldDataSchema();

    // Act: describe the form.
    const description = describeSchemaFormFromDataSchema(dataSchema);

    // Assert: the background is a colour text; the other two are plain texts.
    expect(
      description.fields.map((field) => [field.key, field.control, field.isHexColour]),
      'only the GDD colour field must be read as a colour',
    ).toEqual([
      ['imageUrl', 'text', false],
      ['backgroundColor', 'text', true],
      ['legenda', 'text', false],
    ]);
  });
});

const colourScenarios = [
  // A dark plate, as the GDD writes it: saved as typed.
  { name: 'accepts #0a0a0a', typed: '#0a0a0a', saved: '#0a0a0a' },
  // Capitals, as a design tool copies a colour: lowered, so the GDD's pattern takes it.
  { name: 'accepts #0A0A0A and saves it as #0a0a0a', typed: '#0A0A0A', saved: '#0a0a0a' },
  // CSS shorthand.
  { name: 'refuses the three-digit #000', typed: '#000', saved: undefined },
  // The hash forgotten.
  { name: 'refuses 0a0a0a without the #', typed: '0a0a0a', saved: undefined },
  // A colour's name.
  { name: 'refuses the word "preto"', typed: 'preto', saved: undefined },
];

describe('checking a colour field', () => {
  it.each(colourScenarios)('$name', ({ typed, saved }) => {
    // Arrange: the form's rules and its reading of the "Fundo" field.
    const description = describeSchemaFormFromDataSchema(buildBackgroundFieldDataSchema());
    const backgroundField = description.fields.find((field) => field.key === 'backgroundColor');
    const rules = buildZodSchemaFromDataSchema(buildBackgroundFieldDataSchema());
    if (backgroundField === undefined) {
      throw new Error('the schema above has a backgroundColor field; this test is broken');
    }

    // Act: read what was typed, as the form does before checking, then check the data.
    const readValue = readDataValueFromFormValue(backgroundField, typed);
    const valueToSave = readValue.status === 'value' ? readValue.value : undefined;
    const check = rules.safeParse({
      imageUrl: '/media/4e2a91c7-cartaz-enduro-piracicaba',
      backgroundColor: valueToSave,
    });

    // Assert: saved as the row says, or refused with the one pt-BR message.
    const messages = check.success ? [] : check.error.issues.map((issue) => issue.message);
    const isAccepted = saved !== undefined;
    expect(messages, 'the colour must be accepted or refused as the row says').toEqual(
      isAccepted ? [] : [theColourMessage],
    );
    if (isAccepted) {
      expect(valueToSave, 'the colour must be saved in lower case').toBe(saved);
    }
  });

  it('accepts an item with no background at all', () => {
    // Arrange: the form's rules, and an image item that leaves the background out.
    const rules = buildZodSchemaFromDataSchema(buildBackgroundFieldDataSchema());
    const data = { imageUrl: '/media/4e2a91c7-cartaz-enduro-piracicaba' };

    // Act: check the data.
    const check = rules.safeParse(data);

    // Assert: it passes: no colour means no background.
    expect(check.success, 'the colour is optional').toBe(true);
  });
});
