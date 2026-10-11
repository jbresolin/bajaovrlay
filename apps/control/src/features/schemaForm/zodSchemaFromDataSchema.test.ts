/**
 * The form's rules, built from a graphic's JSON Schema (apps/control)
 *
 * What this module is for:
 *   The operator should read "O campo "Nome" é obrigatório." under the field, in
 *   Portuguese, before anything is sent. buildZodSchemaFromDataSchema builds those rules
 *   from the same JSON Schema the server checks, as one Zod schema of the graphic's
 *   data. The server's own check stays the authority; this one is a courtesy.
 *
 * What these tests prove:
 *   - Data that respects the manifest passes, with and without its optional fields.
 *   - Each kind of mistake (missing, wrong type, too short or long, not an option, not a
 *     date, not a whole number, under the minimum, over the maximum) is refused with a
 *     pt-BR message that names the field by its label; a time limit is written as mm:ss.
 *   - Keys the schema does not name, and properties the form cannot edit, are let
 *     through unchecked, although the fixture says `additionalProperties: false`.
 *   - A missing schema and an unsupported one accept any object.
 *
 * What these tests deliberately do not cover:
 *   - Text typed in a control ("12:3", "quarenta"): that is read, and refused, before
 *     these rules run (checkSchemaFormValues.test.ts).
 *   - Agreement with the server's Ajv check on every keyword. Where they differ this
 *     schema is the more lenient one and the server refuses the command.
 */
import { describe, expect, it } from 'vitest';

import {
  buildLowerThirdDataForCar42,
  buildLowerThirdFixtureDataSchema,
} from './lowerThirdFixtureSchema.testSupport';
import { buildZodSchemaFromDataSchema } from './zodSchemaFromDataSchema';

describe('buildZodSchemaFromDataSchema, on data the manifest accepts', () => {
  it('accepts the lower third of car 42 with every field filled', () => {
    // Arrange: the rules of the lower third, and complete data for car 42.
    const rules = buildZodSchemaFromDataSchema(buildLowerThirdFixtureDataSchema());
    const data = buildLowerThirdDataForCar42();

    // Act: check the data.
    const check = rules.safeParse(data);

    // Assert: it passes, and comes back unchanged.
    expect(check.success, 'complete, correct data must pass').toBe(true);
    expect(check.data, 'the rules must not change the data').toEqual(data);
  });

  it('accepts the lower third with only its required fields', () => {
    // Arrange: the five required fields and nothing else.
    const rules = buildZodSchemaFromDataSchema(buildLowerThirdFixtureDataSchema());
    const data = {
      nome: 'Ana Souza',
      equipe: 'baja-ufpr',
      duracaoMs: 8_000,
      destaque: false,
      numeroDoCarro: 42,
    };

    // Act: check the data.
    const check = rules.safeParse(data);

    // Assert: optional fields may be absent.
    expect(check.success, 'optional fields must be allowed to be missing').toBe(true);
  });

  it('lets through a key the schema does not name and a property the form cannot edit', () => {
    // Arrange: correct data plus an unknown key, and a list of the wrong content.
    const rules = buildZodSchemaFromDataSchema(buildLowerThirdFixtureDataSchema());
    const data = {
      ...buildLowerThirdDataForCar42(),
      corDaTarja: 'azul',
      patrocinadores: 'não é uma lista',
    };

    // Act: check the data.
    const check = rules.safeParse(data);

    // Assert: both are left for the server to judge.
    expect(check.success, 'what the form cannot edit is the server’s to refuse').toBe(true);
  });

  const schemasWithNoRules = [
    // A graphic that takes no data has nothing to check.
    { name: 'a missing schema', dataSchema: undefined },
    // A schema the form cannot read field by field.
    { name: 'a schema that is not an object with properties', dataSchema: { type: 'array' } },
  ];

  it.each(schemasWithNoRules)('accepts any object for $name', ({ dataSchema }) => {
    // Arrange: the rules built from the schema of this scenario.
    const rules = buildZodSchemaFromDataSchema(dataSchema);

    // Act: check some data.
    const check = rules.safeParse({ texto: 'Largada às 10h' });

    // Assert: nothing is refused here; the server decides.
    expect(check.success, 'there is no rule to break').toBe(true);
  });
});

describe('buildZodSchemaFromDataSchema, on data the manifest refuses', () => {
  const mistakesAndTheirMessages = [
    // Required and missing: the commonest mistake.
    {
      name: 'a missing required name',
      change: { nome: undefined },
      message: 'O campo "Nome" é obrigatório.',
    },
    // A number where text belongs.
    {
      name: 'a number as the name',
      change: { nome: 42 },
      message: 'O campo "Nome" precisa ser um texto.',
    },
    // minLength 2.
    {
      name: 'a one-letter name',
      change: { nome: 'A' },
      message: 'O campo "Nome" precisa ter pelo menos 2 caracteres.',
    },
    // maxLength 40.
    {
      name: 'a name of 41 letters',
      change: { nome: 'A'.repeat(41) },
      message: 'O campo "Nome" pode ter no máximo 40 caracteres.',
    },
    // Not one of the enum's values.
    {
      name: 'a team that is not an option',
      change: { equipe: 'equipe-desconhecida' },
      message: 'Escolha uma das opções de "Equipe".',
    },
    // A required dropdown with nothing chosen reads as "required", not "not an option".
    {
      name: 'a missing required team',
      change: { equipe: undefined },
      message: 'O campo "Equipe" é obrigatório.',
    },
    // format: date-time.
    {
      name: 'a date written for people',
      change: { horario: '10/10/2026 09:45' },
      message: 'O campo "Horário da entrevista" precisa de uma data e hora válidas.',
    },
    // type: integer refuses a decimal.
    {
      name: 'a decimal car number',
      change: { numeroDoCarro: 42.5 },
      message: 'O campo "Número do carro" precisa ser um número inteiro.',
    },
    // Text where a number belongs.
    {
      name: 'a car number written as text',
      change: { numeroDoCarro: '42' },
      message: 'O campo "Número do carro" precisa ser um número.',
    },
    // minimum 1.
    {
      name: 'car number zero',
      change: { numeroDoCarro: 0 },
      message: 'O campo "Número do carro" não pode ser menor que 1.',
    },
    // maximum 999.
    {
      name: 'car number 1000',
      change: { numeroDoCarro: 1000 },
      message: 'O campo "Número do carro" não pode ser maior que 999.',
    },
    // A decimal limit on a `number`: 99.5 is under the minimum of 100 kg.
    {
      name: 'a car lighter than the minimum',
      change: { pesoDoCarroKg: 99.5 },
      message: 'O campo "Peso do carro (kg)" não pode ser menor que 100.',
    },
    // A time limit is written the way the operator types the field: 3 000 ms is 0:03.
    {
      name: 'a time on air under three seconds',
      change: { duracaoMs: 2_000 },
      message: 'O campo "Tempo no ar" não pode ser menor que 0:03.',
    },
    // 60 000 ms is 1:00.
    {
      name: 'a time on air over one minute',
      change: { duracaoMs: 61_000 },
      message: 'O campo "Tempo no ar" não pode ser maior que 1:00.',
    },
    // Text where true or false belongs.
    {
      name: 'a highlight written as text',
      change: { destaque: 'sim' },
      message: 'O campo "Destaque" precisa estar ligado ou desligado.',
    },
  ];

  it.each(mistakesAndTheirMessages)('refuses $name, naming the field', ({ change, message }) => {
    // Arrange: car 42's correct data with the one mistake of this scenario.
    const rules = buildZodSchemaFromDataSchema(buildLowerThirdFixtureDataSchema());
    const data = { ...buildLowerThirdDataForCar42(), ...change };

    // Act: check the data.
    const check = rules.safeParse(data);

    // Assert: exactly one message, in pt-BR, naming the field by its label.
    const messages = check.success ? [] : check.error.issues.map((issue) => issue.message);
    expect(check.success, 'the mistake must be refused').toBe(false);
    expect(messages, 'the operator must read which field is wrong and why').toEqual([message]);
  });

  it('says "1 caractere" in the singular', () => {
    // Arrange: a car's two-letter class code that needs at least one character.
    const rules = buildZodSchemaFromDataSchema({
      type: 'object',
      properties: { categoria: { type: 'string', title: 'Categoria', minLength: 1 } },
      required: ['categoria'],
    });

    // Act: check an empty text.
    const check = rules.safeParse({ categoria: '' });

    // Assert: the message is good Portuguese.
    const messages = check.success ? [] : check.error.issues.map((issue) => issue.message);
    expect(messages, 'one character is singular').toEqual([
      'O campo "Categoria" precisa ter pelo menos 1 caractere.',
    ]);
  });

  it('reports every wrong field at once, each under its own key', () => {
    // Arrange: car 42's data with a missing name and a car number of zero.
    const rules = buildZodSchemaFromDataSchema(buildLowerThirdFixtureDataSchema());
    const data = { ...buildLowerThirdDataForCar42(), nome: undefined, numeroDoCarro: 0 };

    // Act: check the data.
    const check = rules.safeParse(data);

    // Assert: two problems, each pointing at its field.
    const keysWithProblems = check.success ? [] : check.error.issues.map((issue) => issue.path[0]);
    expect(keysWithProblems, 'both wrong fields must be reported').toEqual([
      'nome',
      'numeroDoCarro',
    ]);
  });
});
