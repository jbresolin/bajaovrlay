/**
 * The canonical fields a flex mapping can fill (packages/shared)
 *
 * What this module is for:
 *   The flex source form shows one row per field a mapping may fill, and the config schema
 *   refuses a rule whose target is not one of them. `listMappableFieldsOfShape` is that
 *   list, written by hand like bindablePaths.ts: each field with its pt-BR label, whether
 *   the shape requires it, and whether it belongs to the whole shape or to each entry.
 *
 * What these tests prove:
 *   - The session, positions, standings and incidents lists are fixed, field by field, required
 *     fields first; brackets (a draft shape) offer nothing to map in this PR.
 *   - Every listed field exists in its shape's Zod schema, and is required there exactly
 *     when the list says so.
 *   - Every field of the shapes' schemas is listed, except standings' pointsByEvent,
 *     which is left out on purpose (see the README).
 *
 * What these tests deliberately do not cover:
 *   - Using the list to refuse a rule; flexMappingConfig.test.ts covers that.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { IncidentEntrySchema, IncidentsShapeSchema } from '../dataShapes/incidentsShape.js';
import { PositionEntrySchema, PositionsShapeSchema } from '../dataShapes/positionsShape.js';
import { SessionShapeSchema } from '../dataShapes/sessionShape.js';
import { StandingsEntrySchema, StandingsShapeSchema } from '../dataShapes/standingsShape.js';
import { listMappableFieldsOfShape, type MappableField } from './mappableFields.js';

/**
 * Finds the Zod schema of a field by its target name, walking into nested objects for a
 * dotted name such as "clock.running". Undefined when the schema has no such field.
 */
function findFieldSchema(objectSchema: z.ZodObject, targetField: string): z.ZodType | undefined {
  const [firstName, ...restOfNames] = targetField.split('.');
  if (firstName === undefined) {
    return undefined;
  }
  const fieldSchema = objectSchema.shape[firstName];
  if (restOfNames.length === 0) {
    return fieldSchema;
  }
  if (!(fieldSchema instanceof z.ZodObject)) {
    return undefined;
  }
  return findFieldSchema(fieldSchema, restOfNames.join('.'));
}

/** Lists a schema's field names, nested objects as dotted names ("clock.running"). */
function listFieldNamesOfSchema(objectSchema: z.ZodObject): string[] {
  const fieldNames: string[] = [];
  for (const [fieldName, fieldSchema] of Object.entries(objectSchema.shape)) {
    if (fieldSchema instanceof z.ZodObject) {
      for (const nestedName of listFieldNamesOfSchema(fieldSchema)) {
        fieldNames.push(`${fieldName}.${nestedName}`);
      }
    } else {
      fieldNames.push(fieldName);
    }
  }
  return fieldNames;
}

describe('listMappableFieldsOfShape', () => {
  it('lists the session fields, required ones first, all for the whole shape', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the session's fields.
    const sessionFields = listMappableFieldsOfShape('session');

    // Assert: exactly these, in this order.
    expect(sessionFields, 'the session fields must be this fixed list').toEqual([
      {
        targetField: 'sessionId',
        label: 'Identificador da sessão',
        isRequired: true,
        level: 'topLevel',
      },
      { targetField: 'eventName', label: 'Evento', isRequired: true, level: 'topLevel' },
      { targetField: 'sessionName', label: 'Nome da sessão', isRequired: true, level: 'topLevel' },
      { targetField: 'sessionKind', label: 'Prova', isRequired: true, level: 'topLevel' },
      { targetField: 'state', label: 'Bandeira', isRequired: true, level: 'topLevel' },
      {
        targetField: 'clock.clockMode',
        label: 'Relógio › Modo',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'clock.referenceTimeMs',
        label: 'Relógio › Tempo de referência',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'clock.referenceWallClockMs',
        label: 'Relógio › Horário da referência',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'clock.running',
        label: 'Relógio › Correndo',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'updatedAtMs',
        label: 'Momento da atualização',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'scheduledDurationMs',
        label: 'Duração prevista',
        isRequired: false,
        level: 'topLevel',
      },
      {
        targetField: 'lapsCompletedByLeader',
        label: 'Voltas do líder',
        isRequired: false,
        level: 'topLevel',
      },
    ]);
  });

  it('lists the positions fields, the whole shape first, then each car, required first', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the positions fields.
    const positionsFields = listMappableFieldsOfShape('positions');

    // Assert: exactly these, in this order.
    expect(positionsFields, 'the positions fields must be this fixed list').toEqual([
      {
        targetField: 'sessionId',
        label: 'Identificador da sessão',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'updatedAtMs',
        label: 'Momento da atualização',
        isRequired: true,
        level: 'topLevel',
      },
      { targetField: 'position', label: 'Posição', isRequired: true, level: 'entry' },
      { targetField: 'carNumber', label: 'Carro', isRequired: true, level: 'entry' },
      { targetField: 'teamName', label: 'Equipe', isRequired: true, level: 'entry' },
      { targetField: 'schoolName', label: 'Escola', isRequired: true, level: 'entry' },
      { targetField: 'laps', label: 'Voltas', isRequired: true, level: 'entry' },
      { targetField: 'status', label: 'Situação', isRequired: true, level: 'entry' },
      { targetField: 'lastLapMs', label: 'Última volta', isRequired: false, level: 'entry' },
      { targetField: 'bestLapMs', label: 'Melhor volta', isRequired: false, level: 'entry' },
      {
        targetField: 'bestLapNumber',
        label: 'Volta da melhor volta',
        isRequired: false,
        level: 'entry',
      },
      {
        targetField: 'gapToLeaderMs',
        label: 'Diferença para o líder (tempo)',
        isRequired: false,
        level: 'entry',
      },
      {
        targetField: 'gapToLeaderLaps',
        label: 'Diferença para o líder (voltas)',
        isRequired: false,
        level: 'entry',
      },
      {
        targetField: 'intervalMs',
        label: 'Intervalo para o carro à frente',
        isRequired: false,
        level: 'entry',
      },
      { targetField: 'pitStops', label: 'Paradas nos boxes', isRequired: false, level: 'entry' },
      { targetField: 'fuelStops', label: 'Abastecimentos', isRequired: false, level: 'entry' },
    ]);
  });

  it('lists the standings fields, the whole shape first, then each team', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the standings fields.
    const standingsFields = listMappableFieldsOfShape('standings');

    // Assert: exactly these, in this order, every one required.
    expect(standingsFields, 'the standings fields must be this fixed list').toEqual([
      { targetField: 'scope', label: 'Abrangência', isRequired: true, level: 'topLevel' },
      {
        targetField: 'updatedAtMs',
        label: 'Momento da atualização',
        isRequired: true,
        level: 'topLevel',
      },
      { targetField: 'rank', label: 'Classificação', isRequired: true, level: 'entry' },
      { targetField: 'carNumber', label: 'Carro', isRequired: true, level: 'entry' },
      { targetField: 'teamName', label: 'Equipe', isRequired: true, level: 'entry' },
      { targetField: 'schoolName', label: 'Escola', isRequired: true, level: 'entry' },
      { targetField: 'points', label: 'Pontos', isRequired: true, level: 'entry' },
    ]);
  });

  it('lists the incidents fields, the whole shape first, then each incident, required first', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the incidents fields.
    const incidentsFields = listMappableFieldsOfShape('incidents');

    // Assert: exactly these, in this order: what the Baja app (BAJAOVRLAY-18) must send
    // for a penalty to reach the inbox, then what makes the notice richer.
    expect(incidentsFields, 'the incidents fields must be this fixed list').toEqual([
      {
        targetField: 'sessionId',
        label: 'Identificador da sessão',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'updatedAtMs',
        label: 'Momento da atualização',
        isRequired: true,
        level: 'topLevel',
      },
      {
        targetField: 'incidentId',
        label: 'Identificador do incidente',
        isRequired: true,
        level: 'entry',
      },
      { targetField: 'carNumber', label: 'Carro', isRequired: true, level: 'entry' },
      { targetField: 'teamName', label: 'Equipe', isRequired: true, level: 'entry' },
      { targetField: 'schoolName', label: 'Escola', isRequired: true, level: 'entry' },
      { targetField: 'kind', label: 'Tipo', isRequired: true, level: 'entry' },
      { targetField: 'reason', label: 'Motivo', isRequired: true, level: 'entry' },
      { targetField: 'penaltyText', label: 'Punição', isRequired: false, level: 'entry' },
      { targetField: 'lap', label: 'Volta', isRequired: false, level: 'entry' },
      { targetField: 'atMs', label: 'Momento', isRequired: false, level: 'entry' },
    ]);
  });

  it('offers nothing to map in the draft brackets shape', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the brackets fields.
    const bracketsFields = listMappableFieldsOfShape('brackets');

    // Assert: none, until BAJAOVRLAY-25 settles the shape.
    expect(bracketsFields, 'brackets must offer no field to map in this PR').toEqual([]);
  });
});

describe('the mappable fields match the shape schemas', () => {
  const schemaScenarios: Array<{
    name: string;
    fields: MappableField[];
    topLevelSchema: z.ZodObject;
    entrySchema: z.ZodObject | undefined;
  }> = [
    // The session has no list, so every field is checked against the session schema.
    {
      name: 'every session field exists in SessionShapeSchema, required as listed',
      fields: listMappableFieldsOfShape('session'),
      topLevelSchema: SessionShapeSchema,
      entrySchema: undefined,
    },
    // Positions: top-level fields in the shape, entry fields in one car.
    {
      name: 'every positions field exists in its schema, required as listed',
      fields: listMappableFieldsOfShape('positions'),
      topLevelSchema: PositionsShapeSchema,
      entrySchema: PositionEntrySchema,
    },
    // Incidents: top-level fields in the shape, entry fields in one incident.
    {
      name: 'every incidents field exists in its schema, required as listed',
      fields: listMappableFieldsOfShape('incidents'),
      topLevelSchema: IncidentsShapeSchema,
      entrySchema: IncidentEntrySchema,
    },
    // Standings: top-level fields in the shape, entry fields in one team.
    {
      name: 'every standings field exists in its schema, required as listed',
      fields: listMappableFieldsOfShape('standings'),
      topLevelSchema: StandingsShapeSchema,
      entrySchema: StandingsEntrySchema,
    },
  ];

  it.each(schemaScenarios)('$name', ({ fields, topLevelSchema, entrySchema }) => {
    // Arrange: the row's fields and the schemas they must belong to.

    // Act: find each field's own schema, at its level.
    const fieldChecks = fields.map((field) => {
      const objectSchema = field.level === 'topLevel' ? topLevelSchema : entrySchema;
      const fieldSchema = objectSchema && findFieldSchema(objectSchema, field.targetField);
      return { field, fieldSchema };
    });

    // Assert: every field exists, and a missing value is refused exactly when it is required.
    for (const { field, fieldSchema } of fieldChecks) {
      expect(fieldSchema, `${field.targetField} must exist in its shape schema`).toBeDefined();
      const isRefusedWhenMissing = fieldSchema?.safeParse(undefined).success === false;
      expect(
        isRefusedWhenMissing,
        `${field.targetField} must be required in its schema exactly when the list says so`,
      ).toBe(field.isRequired);
    }
  });

  const completenessScenarios: Array<{
    name: string;
    fields: MappableField[];
    schemaFieldNames: string[];
  }> = [
    // A session field added to the schema later must be added to the list too.
    {
      name: 'every session schema field is mappable',
      fields: listMappableFieldsOfShape('session'),
      schemaFieldNames: listFieldNamesOfSchema(SessionShapeSchema),
    },
    // The incidents list is filled by entriesPath, so only the incident's fields count.
    {
      name: 'every incidents schema field is mappable',
      fields: listMappableFieldsOfShape('incidents'),
      schemaFieldNames: [
        ...listFieldNamesOfSchema(IncidentsShapeSchema).filter((name) => name !== 'entries'),
        ...listFieldNamesOfSchema(IncidentEntrySchema),
      ],
    },
    // The entries list itself is filled by entriesPath, so only the car's fields count.
    {
      name: 'every positions schema field is mappable',
      fields: listMappableFieldsOfShape('positions'),
      schemaFieldNames: [
        ...listFieldNamesOfSchema(PositionsShapeSchema).filter((name) => name !== 'entries'),
        ...listFieldNamesOfSchema(PositionEntrySchema),
      ],
    },
    // pointsByEvent is left out on purpose: a table of points per event is a second
    // mapping inside each entry, and no source sends it yet.
    {
      name: 'every standings schema field but pointsByEvent is mappable',
      fields: listMappableFieldsOfShape('standings'),
      schemaFieldNames: [
        ...listFieldNamesOfSchema(StandingsShapeSchema).filter((name) => name !== 'entries'),
        ...listFieldNamesOfSchema(StandingsEntrySchema).filter((name) => name !== 'pointsByEvent'),
      ],
    },
  ];

  it.each(completenessScenarios)('$name', ({ fields, schemaFieldNames }) => {
    // Arrange: the target names the list offers.
    const listedTargetFields = fields.map((field) => field.targetField);

    // Act: sort both, since the list has its own order.
    const sortedListed = [...listedTargetFields].sort();
    const sortedInSchema = [...schemaFieldNames].sort();

    // Assert: the same names on both sides.
    expect(sortedListed, 'the list must offer every field of the schema').toEqual(sortedInSchema);
  });
});
