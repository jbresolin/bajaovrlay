// Test support: the data schema of a lower third (the name band under a person on
// screen), written the way a graphic's manifest would write it. No such graphic exists
// yet; the schema is here because it has one property of every shape the generated form
// can edit, and two it cannot. Each function builds new objects on every call, so no
// test can change what another test sees.
import { buildSchemaFormValuesFromDataOnAir } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

/**
 * The lower third's data schema. Required: nome, equipe, duracaoMs, destaque and
 * numeroDoCarro. Optional: cargo, horario, pesoDoCarroKg, and the two the form cannot
 * edit (patrocinadores is a list, redesSociais a nested object).
 */
export function buildLowerThirdFixtureDataSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      nome: {
        type: 'string',
        title: 'Nome',
        description: 'Nome de quem aparece na tela.',
        minLength: 2,
        maxLength: 40,
      },
      cargo: {
        type: 'string',
        title: 'Cargo',
        description: 'Função na equipe. Opcional.',
      },
      equipe: {
        type: 'string',
        title: 'Equipe',
        enum: ['baja-ufpr', 'poli-usp', 'fei-baja'],
        gddOptions: {
          labels: { 'baja-ufpr': 'Baja UFPR', 'poli-usp': 'Poli USP', 'fei-baja': 'FEI Baja' },
        },
        default: 'baja-ufpr',
      },
      horario: {
        type: 'string',
        format: 'date-time',
        title: 'Horário da entrevista',
      },
      duracaoMs: {
        type: 'integer',
        title: 'Tempo no ar',
        description: 'Quanto tempo a tarja fica na tela.',
        v_baja: { unit: 'ms' },
        minimum: 3_000,
        maximum: 60_000,
        default: 8_000,
      },
      destaque: {
        type: 'boolean',
        title: 'Destaque',
        description: 'Liga a moldura de destaque.',
        default: false,
      },
      numeroDoCarro: {
        type: 'integer',
        title: 'Número do carro',
        minimum: 1,
        maximum: 999,
      },
      pesoDoCarroKg: {
        type: 'number',
        title: 'Peso do carro (kg)',
        minimum: 100,
        maximum: 300,
      },
      patrocinadores: {
        type: 'array',
        title: 'Patrocinadores',
        items: { type: 'string' },
      },
      redesSociais: {
        type: 'object',
        title: 'Redes sociais',
        properties: { instagram: { type: 'string' } },
      },
    },
    required: ['nome', 'equipe', 'duracaoMs', 'destaque', 'numeroDoCarro'],
    additionalProperties: false,
  };
}

/** The lower third's schema as the form reads it. */
export function describeLowerThirdFixtureForm(): SchemaFormDescription {
  return describeSchemaFormFromDataSchema(buildLowerThirdFixtureDataSchema());
}

/**
 * The lower third's data for car 42 of Baja UFPR, as it would be on air: every property
 * has a value, the two the form cannot edit included.
 */
export function buildLowerThirdDataForCar42(): Record<string, unknown> {
  return {
    nome: 'Ana Souza',
    cargo: 'Capitã',
    equipe: 'baja-ufpr',
    horario: '2026-10-10T12:45:00.000Z',
    duracaoMs: 8_000,
    destaque: true,
    numeroDoCarro: 42,
    pesoDoCarroKg: 182.5,
    patrocinadores: ['Oficina do Zé', 'Autopeças Curitiba'],
    redesSociais: { instagram: '@bajaufpr' },
  };
}

/**
 * The lower third's form as it stands right after it was filled from car 42's data on
 * air: every control holds the on-air value and nothing has been changed yet.
 */
export function buildLowerThirdFormValuesForCar42(): SchemaFormValues {
  return buildSchemaFormValuesFromDataOnAir(
    describeLowerThirdFixtureForm(),
    buildLowerThirdDataForCar42(),
  ).formValues;
}
