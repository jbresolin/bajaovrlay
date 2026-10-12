/**
 * Reading a manifest's data schema for the generated form (apps/control)
 *
 * What this module is for:
 *   Every graphic describes its data once, as a JSON Schema in its OGraf manifest.
 *   describeSchemaFormFromDataSchema reads that schema into one description per
 *   property: which control edits it, its label and help text, whether it is required,
 *   its options and limits. The whole generated form is drawn and checked from these
 *   descriptions, so a new graphic costs the control page no code.
 *
 * What these tests prove:
 *   - Each shape the form supports gets the right control, label, help and "required".
 *   - Dropdown options take their words from the manifest, or show the value itself.
 *   - Limits, lengths, the default and "may be filled by the server at the take" are read.
 *   - A property's `v_baja.role` is handed on as the manifest wrote it, for a panel that
 *     looks a field up by its role; a role that is missing or is not text reads as none.
 *   - A list and a nested object become the read-only unsupported control.
 *   - The real race clock manifest reads as its seven fields.
 *
 * What these tests deliberately do not cover:
 *   - Missing titles and labels, every shape and key the form cannot edit, and schemas
 *     that are not a list of properties: describeSchemaFormUnsupportedShapes.test.ts.
 *   - Drawing the controls (SchemaFormFields.test.tsx) and checking what is typed
 *     (checkSchemaFormValues.test.ts, zodSchemaFromDataSchema.test.ts).
 *   - JSON Schema keywords the form does not read (`pattern`, `const`, `multipleOf`);
 *     the server's own check of the data covers those.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { describe, expect, it } from 'vitest';

import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { buildLowerThirdFixtureDataSchema } from './lowerThirdFixtureSchema.testSupport';

describe('describeSchemaFormFromDataSchema, on the lower third fixture', () => {
  const propertiesOfTheLowerThird = [
    // Plain text, required: the commonest field there is.
    {
      name: 'reads nome as a required text field',
      key: 'nome',
      control: 'text',
      label: 'Nome',
      help: 'Nome de quem aparece na tela.',
      isRequired: true,
    },
    // The same shape left out of `required`: the form must offer to clear it.
    {
      name: 'reads cargo as an optional text field',
      key: 'cargo',
      control: 'text',
      label: 'Cargo',
      help: 'Função na equipe. Opcional.',
      isRequired: false,
    },
    // A text with `enum` is a choice, not something to type.
    {
      name: 'reads equipe as a required dropdown',
      key: 'equipe',
      control: 'select',
      label: 'Equipe',
      help: undefined,
      isRequired: true,
    },
    // `format: date-time` gets the browser's date and time input.
    {
      name: 'reads horario as an optional date and time',
      key: 'horario',
      control: 'dateTime',
      label: 'Horário da entrevista',
      help: undefined,
      isRequired: false,
    },
    // Milliseconds are for the graphic; `v_baja.unit: ms` lets the operator type mm:ss.
    {
      name: 'reads duracaoMs as a required mm:ss duration',
      key: 'duracaoMs',
      control: 'duration',
      label: 'Tempo no ar',
      help: 'Quanto tempo a tarja fica na tela.',
      isRequired: true,
    },
    // True or false is a switch.
    {
      name: 'reads destaque as a required switch',
      key: 'destaque',
      control: 'switch',
      label: 'Destaque',
      help: 'Liga a moldura de destaque.',
      isRequired: true,
    },
    // A whole number with no unit is typed as a number.
    {
      name: 'reads numeroDoCarro as a required number',
      key: 'numeroDoCarro',
      control: 'number',
      label: 'Número do carro',
      help: undefined,
      isRequired: true,
    },
    // A decimal number is the same control; only the rule differs.
    {
      name: 'reads pesoDoCarroKg as an optional number',
      key: 'pesoDoCarroKg',
      control: 'number',
      label: 'Peso do carro (kg)',
      help: undefined,
      isRequired: false,
    },
    // A list cannot be edited before M3: read-only.
    {
      name: 'reads patrocinadores, a list, as unsupported',
      key: 'patrocinadores',
      control: 'unsupported',
      label: 'Patrocinadores',
      help: undefined,
      isRequired: false,
    },
    // Neither can an object inside the object.
    {
      name: 'reads redesSociais, a nested object, as unsupported',
      key: 'redesSociais',
      control: 'unsupported',
      label: 'Redes sociais',
      help: undefined,
      isRequired: false,
    },
  ];

  it.each(propertiesOfTheLowerThird)('$name', ({ key, control, label, help, isRequired }) => {
    // Arrange: the lower third's schema, as its manifest would carry it.
    const dataSchema = buildLowerThirdFixtureDataSchema();

    // Act: read it and pick out the property of this scenario.
    const description = describeSchemaFormFromDataSchema(dataSchema);
    const field = description.fields.find((candidate) => candidate.key === key);

    // Assert: the control, the words and the "required" mark are the manifest's.
    expect(field?.control, `${key} must be drawn with the ${control} control`).toBe(control);
    expect(field?.label, `${key} must be labelled with the manifest's title`).toBe(label);
    expect(field?.help, `${key} must show the manifest's description as help`).toBe(help);
    expect(field?.isRequired, `${key} must be required exactly when the manifest says so`).toBe(
      isRequired,
    );
  });

  it('keeps the fields in the order the manifest lists them', () => {
    // Arrange: the lower third's schema.
    const dataSchema = buildLowerThirdFixtureDataSchema();

    // Act: read it.
    const description = describeSchemaFormFromDataSchema(dataSchema);

    // Assert: the operator fills the form top to bottom in the manifest's order.
    expect(
      description.fields.map((field) => field.key),
      'the form must follow the order of the manifest',
    ).toEqual([
      'nome',
      'cargo',
      'equipe',
      'horario',
      'duracaoMs',
      'destaque',
      'numeroDoCarro',
      'pesoDoCarroKg',
      'patrocinadores',
      'redesSociais',
    ]);
    expect(
      description.isWholeDataSchemaUnsupported,
      'a schema with properties can be drawn field by field',
    ).toBe(false);
  });

  it('reads the options, limits, lengths and defaults the controls need', () => {
    // Arrange: the lower third's schema.
    const dataSchema = buildLowerThirdFixtureDataSchema();

    // Act: read it and pick out three fields.
    const description = describeSchemaFormFromDataSchema(dataSchema);
    const nome = description.fields.find((field) => field.key === 'nome');
    const equipe = description.fields.find((field) => field.key === 'equipe');
    const duracaoMs = description.fields.find((field) => field.key === 'duracaoMs');

    // Assert: each carries what its control and its rule are built from.
    expect(equipe?.selectOptions, 'the dropdown must offer the three teams by name').toEqual([
      { value: 'baja-ufpr', label: 'Baja UFPR' },
      { value: 'poli-usp', label: 'Poli USP' },
      { value: 'fei-baja', label: 'FEI Baja' },
    ]);
    expect(equipe?.defaultDataValue, 'the default team must be read').toBe('baja-ufpr');
    expect(nome?.minimumLength, 'the shortest name allowed must be read').toBe(2);
    expect(nome?.maximumLength, 'the longest name allowed must be read').toBe(40);
    expect(duracaoMs?.minimum, 'the shortest time on air must be read').toBe(3_000);
    expect(duracaoMs?.maximum, 'the longest time on air must be read').toBe(60_000);
    expect(duracaoMs?.isWholeNumber, 'an integer must be marked as a whole number').toBe(true);
    expect(duracaoMs?.offersTakeTime, 'a duration is never filled by the server').toBe(false);
  });
});

describe('describeSchemaFormFromDataSchema, on the real race clock manifest', () => {
  it('reads the six operator fields and the wall-clock reference', () => {
    // Arrange: the manifest exactly as it is in packages/graphics.
    const dataSchema = raceClockManifest.schema;

    // Act: read it.
    const description = describeSchemaFormFromDataSchema(dataSchema);
    const controlByKey = description.fields.map((field) => [field.key, field.control]);
    const keysThatOfferTakeTime = description.fields
      .filter((field) => field.offersTakeTime)
      .map((field) => field.key);

    // Assert: the same fields the hand-written form had, each with its control.
    expect(controlByKey, 'the race clock must read as its seven fields').toEqual([
      ['sessionName', 'text'],
      ['state', 'select'],
      ['clockMode', 'select'],
      ['referenceTimeMs', 'duration'],
      ['referenceWallClockMs', 'number'],
      ['running', 'switch'],
      ['lapsCompletedByLeader', 'number'],
    ]);
    expect(
      keysThatOfferTakeTime,
      'only the wall-clock reference may be filled at the take',
    ).toEqual(['referenceWallClockMs']);
    expect(
      description.fields.filter((field) => !field.isRequired).map((field) => field.key),
      'only the laps are optional',
    ).toEqual(['lapsCompletedByLeader']);
  });
});

describe('describeSchemaFormFromDataSchema, on the role a manifest gives a property', () => {
  const rolesAsManifestsWriteThem = [
    // The role the server already reads: the moment a clock's time belongs to.
    {
      name: 'hands on the role of a wall-clock moment',
      propertySchema: {
        type: 'integer',
        title: 'Horário da referência',
        v_baja: { role: 'wallClock' },
      },
      expectedRole: 'wallClock',
    },
    // A role next to a unit: the mm:ss time of a clock carries both keywords.
    {
      name: 'hands on a role written next to a unit',
      propertySchema: {
        type: 'integer',
        title: 'Tempo de referência',
        v_baja: { unit: 'ms', role: 'clockTime' },
      },
      expectedRole: 'clockTime',
    },
    // The form does not judge the word: a role it never heard of is handed on all the same.
    {
      name: 'hands on a role the form itself has no use for',
      propertySchema: {
        type: 'boolean',
        title: 'Relógio correndo',
        v_baja: { role: 'clockRunning' },
      },
      expectedRole: 'clockRunning',
    },
    // Most properties have no role at all.
    {
      name: 'reads no role when the property has no v_baja keyword',
      propertySchema: { type: 'string', title: 'Nome da sessão' },
      expectedRole: undefined,
    },
    // A manifest is written by hand; a number where the word belongs is not a role.
    {
      name: 'reads no role when the manifest wrote a number in its place',
      propertySchema: { type: 'integer', title: 'Voltas', v_baja: { role: 7 } },
      expectedRole: undefined,
    },
  ];

  it.each(rolesAsManifestsWriteThem)('$name', ({ propertySchema, expectedRole }) => {
    // Arrange: a data schema with that one property.
    const dataSchema = { type: 'object', properties: { campoDoRelogio: propertySchema } };

    // Act: read it.
    const description = describeSchemaFormFromDataSchema(dataSchema);

    // Assert: the field's role is the manifest's word, or none.
    expect(
      description.fields[0]?.role,
      'the role must be the text the manifest wrote under v_baja.role, or undefined',
    ).toBe(expectedRole);
  });
});
