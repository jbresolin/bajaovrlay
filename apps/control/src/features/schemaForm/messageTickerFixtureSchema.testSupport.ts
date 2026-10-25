// Test support: the data schema of a message ticker, as packages/graphics/message-ticker's
// manifest writes it (the label, the messages as a list of texts, the clock block's switch),
// for the tests of the generated form's list of texts (BAJAOVRLAY-23). A stand-in with only
// the fields these tests read, so the form's tests do not depend on the real package.
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormDescription } from './schemaFormDescription';

/** The longest message these tests allow, the ticker's limit for its bar. */
export const longestMessageInTheFixture = 50;

/**
 * The ticker's data schema: the label (a text, default "AVISO"), the messages (required,
 * at least one, each 1 to 50 characters, a line called "Mensagem") and the clock switch.
 */
export function buildMessageTickerFixtureDataSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      label: { type: 'string', title: 'Rótulo do aviso', default: 'AVISO' },
      messages: {
        type: 'array',
        title: 'Mensagens',
        description: 'Uma mensagem por página; a faixa troca de página a cada 7 s.',
        minItems: 1,
        items: {
          type: 'string',
          title: 'Mensagem',
          minLength: 1,
          maxLength: longestMessageInTheFixture,
        },
      },
      showClockBlock: { type: 'boolean', title: 'Mostrar o relógio', default: true },
    },
    required: ['label', 'messages'],
    additionalProperties: false,
  };
}

/** The ticker's form description. */
export function describeMessageTickerFixtureForm(): SchemaFormDescription {
  return describeSchemaFormFromDataSchema(buildMessageTickerFixtureDataSchema());
}

/** The two announcements of the enduro's morning, as the operator typed them. */
export function buildTwoEnduroMorningMessages(): string[] {
  return ['Largada do enduro às 10h00', 'Briefing dos pilotos na tenda central'];
}
