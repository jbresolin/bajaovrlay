/**
 * A list of texts in the generated form: reading, filling and checking (apps/control)
 *
 * What this module is for:
 *   The message ticker's messages are the first list the operator types (BAJAOVRLAY-23).
 *   A manifest property `type: array` whose `items` are plain `type: string` becomes a
 *   `textList` field: one line per text, each held as `{ text }` while the operator edits,
 *   sent to the graphic as the list of texts. The manifest's `minItems` and the items'
 *   `maxLength` are checked before anything is sent, with pt-BR messages that give the
 *   limit and name the line.
 *
 * What these tests prove:
 *   - The ticker's messages are described as a textList with the items' title as the
 *     line's name, the items' lengths and the list's minimum; a list without an items
 *     title calls a line "Linha".
 *   - A list of objects, and a list of texts from a fixed set, stay unsupported.
 *   - A new form starts the required list with one empty line; a form filled from the
 *     air shows each message as a line; the checked form sends the texts, trimmed.
 *   - A line over the limit is refused naming the line, the limit and its length; a line
 *     under the items' minLength gives the minimum; a list with no line is refused as
 *     required; ten lines are refused with the maximum of 9; a blank line (spaces, or
 *     empty) is refused by its number.
 *   - An optional list emptied of every line is cleared, not sent.
 *
 * What these tests deliberately do not cover:
 *   - The lines on screen (add, remove, reorder); SchemaFormFieldsTextList.test.tsx.
 *   - The item editor's commands; ItemEditorPanelTextList.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import {
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromDataOnAir,
} from './buildSchemaFormValues';
import { checkSchemaFormValues } from './checkSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  buildMessageTickerFixtureDataSchema,
  buildTwoEnduroMorningMessages,
  describeMessageTickerFixtureForm,
} from './messageTickerFixtureSchema.testSupport';
import type { SchemaFormValues } from './schemaFormValues';

/** The ticker's form filled from the air with these messages. */
function buildTickerFormValuesWithMessages(messages: unknown[]): SchemaFormValues {
  const filled = buildSchemaFormValuesFromDataOnAir(describeMessageTickerFixtureForm(), {
    label: 'AVISO',
    messages,
  });
  return filled.formValues;
}

describe('a list of texts, as the form reads the manifest', () => {
  it('describes the ticker’s messages as a list of texts named by its items', () => {
    // Arrange: the ticker's data schema.
    const dataSchema = buildMessageTickerFixtureDataSchema();

    // Act: read it.
    const messagesField = describeSchemaFormFromDataSchema(dataSchema).fields.find(
      (field) => field.key === 'messages',
    );

    // Assert: a textList, each line a "Mensagem" of 1 to 50 characters, 1 to 9 lines.
    expect(messagesField?.control, 'a list of plain texts is typed line by line').toBe('textList');
    expect(messagesField?.listItemLabel, 'a line is called by the items’ title').toBe('Mensagem');
    expect(messagesField?.minimumLength, 'each line’s shortest length').toBe(1);
    expect(messagesField?.maximumLength, 'each line’s longest length, the bar’s limit').toBe(50);
    expect(messagesField?.minimumItems, 'the list needs at least one line').toBe(1);
    expect(messagesField?.maximumItems, 'the list holds at most nine lines').toBe(9);
  });

  const listShapes = [
    // A list of texts with no title on its items: a line is a "Linha".
    {
      name: 'calls a line "Linha" when the items have no title',
      property: { type: 'array', items: { type: 'string' } },
      expectedControl: 'textList',
      expectedItemLabel: 'Linha',
    },
    // A list of objects (the tower's cars, sponsors with a name and a logo): read-only.
    {
      name: 'keeps a list of objects unsupported',
      property: { type: 'array', items: { type: 'object', properties: {} } },
      expectedControl: 'unsupported',
      expectedItemLabel: undefined,
    },
    // A list of texts from a fixed set would need a dropdown per line: not this control.
    {
      name: 'keeps a list of texts from a fixed set unsupported',
      property: { type: 'array', items: { type: 'string', enum: ['verde', 'amarela'] } },
      expectedControl: 'unsupported',
      expectedItemLabel: undefined,
    },
  ];

  it.each(listShapes)('$name', ({ property, expectedControl, expectedItemLabel }) => {
    // Arrange: a schema with that one list.
    const dataSchema = { type: 'object', properties: { lista: property } };

    // Act: read it.
    const [listField] = describeSchemaFormFromDataSchema(dataSchema).fields;

    // Assert: the control and the line's name of this row.
    expect(listField?.control, 'the control of this list shape').toBe(expectedControl);
    expect(listField?.listItemLabel, 'the name of one line').toBe(expectedItemLabel);
  });
});

describe('a list of texts, as the form is filled and sent', () => {
  it('starts a new ticker with one empty message to type in', () => {
    // Arrange: the ticker's description.
    const description = describeMessageTickerFixtureForm();

    // Act: build the empty form of a new item.
    const formValues = buildEmptySchemaFormValues(description);

    // Assert: one empty line, so the operator has a box for the first message.
    expect(formValues.values.messages, 'a required list starts with one empty line').toEqual([
      { text: '' },
    ]);
  });

  it('shows each message on air as a line and sends them back as texts, trimmed', () => {
    // Arrange: the ticker on air with the two morning messages, the second typed with a
    // space at its end.
    const [firstMessage, secondMessage] = buildTwoEnduroMorningMessages();
    const formValues = buildTickerFormValuesWithMessages([firstMessage, `${secondMessage} `]);

    // Act: check the form, as a press of "Atualizar no ar" does.
    const check = checkSchemaFormValues(describeMessageTickerFixtureForm(), formValues);

    // Assert: the lines as the form shows them, and the texts the graphic receives.
    expect(formValues.values.messages, 'each message is one line').toEqual([
      { text: firstMessage },
      { text: `${secondMessage} ` },
    ]);
    expect(check, 'the messages go to the graphic as texts without spaces around').toEqual({
      status: 'valid',
      checkedFields: [
        { key: 'label', outcome: 'value', value: 'AVISO' },
        { key: 'messages', outcome: 'value', value: buildTwoEnduroMorningMessages() },
        { key: 'showClockBlock', outcome: 'cleared' },
      ],
    });
  });
});

describe('a list of texts, as the form checks it', () => {
  const refusedLists = [
    // A message that would not fit the bar: the reason names the line, the limit and
    // how long it is, so the operator knows how much to cut.
    {
      name: 'refuses a message over the limit, naming the line, the limit and its length',
      messages: [
        'Largada do enduro às 10h00',
        'Atenção equipes: o reabastecimento fecha às 13h30 e reabre após a bandeira verde',
      ],
      expectedMessage: 'Mensagem 2: no máximo 50 caracteres (tem 80).',
    },
    // A line of spaces, or one left empty by "Adicionar mensagem": refused by its number,
    // never dropped (the server's pattern "\S" would refuse it too).
    {
      name: 'refuses a blank line, naming it',
      messages: ['Largada do enduro às 10h00', '   '],
      expectedMessage: 'Mensagem 2: está em branco; escreva o texto ou remova a linha.',
    },
    // Ten messages: one more than the manifest's maxItems of 9, the most pages the
    // ticker's page cell is drawn for.
    {
      name: 'refuses more lines than the manifest allows, giving the maximum',
      messages: [
        'Largada do enduro às 10h00',
        'Briefing dos pilotos na tenda central',
        'Reabastecimento fecha às 13h30',
        'Equipe 42, Baja UFPR: compareça aos boxes',
        'Almoço das equipes a partir das 12h00',
        'Inspeção técnica na tenda 3',
        'Bandeira amarela na curva do lago',
        'Resultado parcial às 14h00',
        'Premiação no palco principal às 17h00',
        'Obrigado por acompanhar a Baja SAE Brasil',
      ],
      expectedMessage: 'O campo "Mensagens" pode ter no máximo 9 linhas.',
    },
    // Every line removed from a required list.
    {
      name: 'refuses a required list with no line',
      messages: [],
      expectedMessage: 'O campo "Mensagens" é obrigatório.',
    },
  ];

  it.each(refusedLists)('$name', ({ messages, expectedMessage }) => {
    // Arrange: the ticker's form with the messages of this row.
    const formValues = buildTickerFormValuesWithMessages(messages);

    // Act: check it.
    const check = checkSchemaFormValues(describeMessageTickerFixtureForm(), formValues);

    // Assert: refused, with this row's pt-BR reason on the messages field.
    expect(check, 'the list must be refused with its reason').toEqual({
      status: 'invalid',
      fieldMessages: [{ fieldKey: 'messages', message: expectedMessage }],
    });
  });

  it('refuses a line shorter than the items’ minLength, giving the minimum', () => {
    // Arrange: a schema whose lines need at least 5 characters, and a line of 3.
    const dataSchema = {
      type: 'object',
      properties: {
        avisos: { type: 'array', title: 'Avisos', items: { type: 'string', minLength: 5 } },
      },
    };
    const description = describeSchemaFormFromDataSchema(dataSchema);
    const formValues = buildSchemaFormValuesFromDataOnAir(description, {
      avisos: ['Box'],
    }).formValues;

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: refused, naming the line (a "Linha", the items have no title) and the minimum.
    expect(check, 'three characters are too few').toEqual({
      status: 'invalid',
      fieldMessages: [{ fieldKey: 'avisos', message: 'Linha 1: escreva pelo menos 5 caracteres.' }],
    });
  });

  it('refuses fewer lines than the manifest asks for, giving the minimum', () => {
    // Arrange: a schema asking for at least two lines, and a form with one.
    const dataSchema = {
      type: 'object',
      properties: {
        avisos: { type: 'array', title: 'Avisos', minItems: 2, items: { type: 'string' } },
      },
    };
    const description = describeSchemaFormFromDataSchema(dataSchema);
    const formValues = buildSchemaFormValuesFromDataOnAir(description, {
      avisos: ['Largada do enduro às 10h00'],
    }).formValues;

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: refused with the minimum in words.
    expect(check, 'one line is too few').toEqual({
      status: 'invalid',
      fieldMessages: [
        { fieldKey: 'avisos', message: 'O campo "Avisos" precisa de pelo menos 2 linhas.' },
      ],
    });
  });

  it('clears an optional list emptied of every line, so nothing is sent', () => {
    // Arrange: an optional list with no line left.
    const dataSchema = {
      type: 'object',
      properties: { avisos: { type: 'array', title: 'Avisos', items: { type: 'string' } } },
    };
    const description = describeSchemaFormFromDataSchema(dataSchema);
    const formValues = buildSchemaFormValuesFromDataOnAir(description, { avisos: [] }).formValues;

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: cleared, as an emptied optional text is.
    expect(formValues.values.avisos, 'the emptied optional list is held as cleared').toBeNull();
    expect(check, 'an emptied optional list is cleared').toEqual({
      status: 'valid',
      checkedFields: [{ key: 'avisos', outcome: 'cleared' }],
    });
  });
});
