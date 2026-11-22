/**
 * A colour field (`gddType: "color-rrggbb"`) in the generated form (apps/control)
 *
 * What this module is for:
 *   The image graphic's "Fundo" (BAJAOVRLAY-84) is a text marked with the OGraf GDD's
 *   `color-rrggbb`, whose pattern the GDD fixes as "#" and six lower-case hex digits. The
 *   item editor has no colour picker, so it stays a text field, and the form checks the
 *   colour itself (describeSchemaFormFromDataSchema.ts marks the field, and
 *   zodSchemaFromDataSchema.ts adds the rule) so the operator reads why under the field
 *   instead of a refusal from the server.
 *
 * What these tests prove:
 *   - Only a text with `gddType: "color-rrggbb"` is read as a colour; a plain text with a
 *     pattern of its own (the lower third's "\S") is not.
 *   - "#0a0a0a" passes; capitals, three digits, no "#" and a colour name are refused with
 *     one pt-BR message naming the field and showing an example.
 *   - Left out, the optional colour passes: no background.
 *
 * What these tests deliberately do not cover:
 *   - Other `pattern`s, which the form still leaves to the server (the file's header).
 *   - The whole editor; ItemEditorPanelImage.test.tsx opens it on a real image item.
 */
import { describe, expect, it } from 'vitest';

import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
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
  'Use uma cor no formato #rrggbb, em minúsculas, em "Fundo", por exemplo #0a0a0a; deixe vazio para não ter cor.';

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
  // A dark plate, as the GDD writes it.
  { name: 'accepts #0a0a0a', colour: '#0a0a0a', isAccepted: true },
  // The GDD's pattern has no capitals, and the server would refuse them.
  { name: 'refuses #0A0A0A in capitals', colour: '#0A0A0A', isAccepted: false },
  // CSS shorthand.
  { name: 'refuses the three-digit #000', colour: '#000', isAccepted: false },
  // The hash forgotten.
  { name: 'refuses 0a0a0a without the #', colour: '0a0a0a', isAccepted: false },
  // A colour's name.
  { name: 'refuses the word "preto"', colour: 'preto', isAccepted: false },
];

describe('checking a colour field', () => {
  it.each(colourScenarios)('$name', ({ colour, isAccepted }) => {
    // Arrange: the form's rules, and an image item with this row's background.
    const rules = buildZodSchemaFromDataSchema(buildBackgroundFieldDataSchema());
    const data = { imageUrl: '/media/4e2a91c7-cartaz-enduro-piracicaba', backgroundColor: colour };

    // Act: check the data.
    const check = rules.safeParse(data);

    // Assert: accepted, or refused with the one pt-BR message.
    const messages = check.success ? [] : check.error.issues.map((issue) => issue.message);
    expect(messages, 'the colour must be accepted or refused as the row says').toEqual(
      isAccepted ? [] : [theColourMessage],
    );
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
