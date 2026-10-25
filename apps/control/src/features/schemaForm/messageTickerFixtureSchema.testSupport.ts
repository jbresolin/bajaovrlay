// Test support: the data schema of a message ticker, as packages/graphics/message-ticker's
// manifest writes it (the label, the messages as a list of texts, the clock block's switch),
// for the tests of the generated form's list of texts (BAJAOVRLAY-23). Written out here so a
// reader sees the schema the tests run against; messageTickerFixtureSchema.test.ts fails if
// the label or the messages drift from the real manifest.
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormDescription } from './schemaFormDescription';

/** The longest message these tests allow, the ticker's limit for its bar. */
export const longestMessageInTheFixture = 50;

/**
 * The ticker's data schema: the label and the messages exactly as the real manifest
 * declares them (messageTickerFixtureSchema.test.ts keeps them equal), and the clock switch.
 */
export function buildMessageTickerFixtureDataSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        title: 'Rótulo do aviso',
        description: 'A pílula antes da mensagem; até 10 caracteres. Ex.: AVISO, ATENÇÃO.',
        gddType: 'single-line',
        minLength: 1,
        maxLength: 10,
        default: 'AVISO',
      },
      messages: {
        type: 'array',
        title: 'Mensagens',
        description:
          'Uma mensagem por página, de 1 a 9; a faixa troca de página a cada 7 s e nunca rola o texto. Cada mensagem tem até 50 caracteres, o que cabe na faixa.',
        minItems: 1,
        maxItems: 9,
        items: {
          type: 'string',
          title: 'Mensagem',
          minLength: 1,
          maxLength: longestMessageInTheFixture,
          pattern: '\\S',
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
