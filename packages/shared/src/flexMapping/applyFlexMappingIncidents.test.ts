/**
 * Mapping a race direction's list of penalties into the incidents shape (packages/shared)
 *
 * What this module is for:
 *   Penalties reach BajaOvrLay through a source's incidents shape (BAJAOVRLAY-44). The
 *   Baja app (BAJAOVRLAY-18) will be a flex source, so the flex mapping must be able to
 *   build incidents the way it builds positions: a list in the response, one rule per
 *   canonical field, the source's own codes turned into the shape's kinds by mapValues.
 *
 * What these tests prove:
 *   - A response with two penalties and a warning, in an imaginary race direction's own
 *     words ("PEN", "ADV", "punicao"), maps into incidents that pass validateDataShape,
 *     with the kinds translated, the moments read, and a warning's missing penalty left
 *     out.
 *   - A kind code the table does not know fails the whole mapping, naming the incident's
 *     car and line, so an unknown code never reaches the inbox as a guessed kind.
 *
 * What these tests deliberately do not cover:
 *   - The general rules of a mapping (missing paths, problem lists, list order);
 *     applyFlexMapping.test.ts covers them with the positions.
 *   - Which fields may be mapped; mappableFields.test.ts lists them.
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from '../dataShapes/validateDataShape.js';
import { applyFlexMapping } from './applyFlexMapping.js';
import { type FlexMappingConfig, FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The moment of the poll in these tests: 14:24:01 in Brasília, 17:24:01 UTC. */
const pollMomentMs = Date.UTC(2027, 7, 14, 17, 24, 1);

/**
 * What an imaginary race direction's endpoint answers: its own keys and codes ("PEN" for
 * a penalty, "ADV" for a warning), moments as ISO text with their zone, and a penalty
 * only where one was given.
 */
function buildRaceDirectionResponse(): { ocorrencias: Array<Record<string, unknown>> } {
  return {
    ocorrencias: [
      {
        id: 'DP-0007',
        carro: 47,
        equipe: 'Carnaúba Baja',
        escola: 'UFERSA',
        tipo: 'PEN',
        motivo: 'Queima de largada',
        punicao: '+30 segundos',
        volta: 1,
        momento: '2027-08-14T09:06:01-03:00',
      },
      {
        id: 'DP-0012',
        carro: 81,
        equipe: 'Sucuri Racing',
        escola: 'UFMS',
        tipo: 'ADV',
        motivo: 'Bloqueio de ultrapassagem',
        punicao: null,
        volta: 9,
        momento: '2027-08-14T09:50:02-03:00',
      },
    ],
  };
}

/** The mapping written for that endpoint, checked as a saved config is checked. */
function buildRaceDirectionMapping(): FlexMappingConfig {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'incidents',
      requestId: 'direcao',
      entriesPath: 'ocorrencias',
      fields: [
        { targetField: 'sessionId', constantValue: 'enduro-2027-nacional' },
        { targetField: 'updatedAtMs', fromPollMoment: true },
      ],
      entryFields: [
        { targetField: 'incidentId', fromPath: 'id' },
        { targetField: 'carNumber', fromPath: 'carro' },
        { targetField: 'teamName', fromPath: 'equipe' },
        { targetField: 'schoolName', fromPath: 'escola' },
        {
          targetField: 'kind',
          fromPath: 'tipo',
          transformId: 'mapValues',
          transformParameters: { PEN: 'penalty', ADV: 'warning', OCO: 'incident' },
        },
        { targetField: 'reason', fromPath: 'motivo' },
        { targetField: 'penaltyText', fromPath: 'punicao' },
        { targetField: 'lap', fromPath: 'volta' },
        { targetField: 'atMs', fromPath: 'momento', transformId: 'isoDateTextToMs' },
      ],
    },
  ]);
}

describe('applyFlexMapping into incidents', () => {
  it('maps a penalty and a warning into incidents that pass the canonical shape', () => {
    // Arrange: the race direction's response and the mapping written for it.
    const response = buildRaceDirectionResponse();
    const mappings = buildRaceDirectionMapping();

    // Act: map it, then validate the incidents exactly as the store does.
    const result = applyFlexMapping(mappings, { direcao: response }, pollMomentMs);
    const incidents = result.ok ? result.shapes.incidents : undefined;
    const validation = validateDataShape('incidents', incidents);

    // Assert: valid, with the codes turned into kinds, the moments read in UTC, and the
    // warning's null penalty left out rather than sent as an empty cell.
    expect(result.ok, 'the mapping must work').toBe(true);
    expect(validation.isValid, 'the mapped incidents must pass the incidents shape').toBe(true);
    expect(incidents, 'both incidents must read as the race direction gave them').toEqual({
      sessionId: 'enduro-2027-nacional',
      updatedAtMs: pollMomentMs,
      entries: [
        {
          incidentId: 'DP-0007',
          carNumber: 47,
          teamName: 'Carnaúba Baja',
          schoolName: 'UFERSA',
          kind: 'penalty',
          reason: 'Queima de largada',
          penaltyText: '+30 segundos',
          lap: 1,
          atMs: Date.UTC(2027, 7, 14, 12, 6, 1),
        },
        {
          incidentId: 'DP-0012',
          carNumber: 81,
          teamName: 'Sucuri Racing',
          schoolName: 'UFMS',
          kind: 'warning',
          reason: 'Bloqueio de ultrapassagem',
          lap: 9,
          atMs: Date.UTC(2027, 7, 14, 12, 50, 2),
        },
      ],
    });
  });

  it('fails the whole mapping on a kind code the table does not know, naming the car', () => {
    // Arrange: the response with the warning sent as "DSQ", a code nobody put in the table.
    const response = buildRaceDirectionResponse();
    const warning = response.ocorrencias[1];
    if (warning !== undefined) {
      warning.tipo = 'DSQ';
    }
    const mappings = buildRaceDirectionMapping();

    // Act: map it.
    const result = applyFlexMapping(mappings, { direcao: response }, pollMomentMs);

    // Assert: a failure whose one problem names the incidents, car 81 on line 2 and the
    // kind; a guessed kind would put the wrong notice on air.
    expect(result.ok, 'an unknown kind code must fail the mapping').toBe(false);
    const problems = result.ok ? [] : result.problems;
    expect(problems, 'one problem, about the second incident').toHaveLength(1);
    expect(problems[0], 'the problem must name the shape, the car and the field').toMatch(
      /^Incidentes › carro 81 \(linha 2\) › Tipo: /,
    );
  });
});
