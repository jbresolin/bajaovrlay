// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   sessions-board.ograf.json describes the data as JSON Schema; sessionsBoardModel.ts
 *   checks the same data with Zod. If they disagreed, the take could pass the server's
 *   check and be refused by the graphic, or the other way round.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both: Sunday's board; a board whose slots carry every
 *     key the schedule's entity list gives (kind, end, place); and no slot, a slot with no
 *     start, a start as text, a slot with a status of its own and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; sessionsBoardManifest.test.ts.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import sessionsBoardManifest from '../sessions-board.ograf.json';
import { parseCompleteSessionsBoardData, type SessionsBoardData } from './sessionsBoardModel.js';

/** Sunday's briefing and enduro, as the schedule's entity list gives them. */
function createSundayBoardData(): SessionsBoardData {
  return {
    title: 'PROGRAMAÇÃO DO DIA',
    eventLine: '30ª Competição Baja SAE Brasil',
    slots: [
      {
        slotId: 'briefing',
        sessionName: 'Briefing das equipes',
        sessionKind: 'other',
        startsAtMs: Date.parse('2025-03-30T08:30:00.000-03:00'),
      },
      {
        slotId: 'enduro',
        sessionName: 'Enduro de Resistência',
        sessionKind: 'enduro',
        startsAtMs: Date.parse('2025-03-30T10:00:00.000-03:00'),
        endsAtMs: Date.parse('2025-03-30T14:00:00.000-03:00'),
        place: 'Pista principal',
      },
    ],
  };
}

/** Sunday's board with its first slot changed. */
function withTheFirstSlot(change: Record<string, unknown>): unknown {
  const data = createSundayBoardData();
  return { ...data, slots: [{ ...data.slots[0], ...change }, data.slots[1]] };
}

const dataAgreementScenarios = [
  // The everyday board, with an end and a place where the slot has them.
  { name: 'both accept Sunday’s board', data: createSundayBoardData(), isValid: true },
  // A board needs at least one slot.
  {
    name: 'both refuse no slot at all',
    data: { ...createSundayBoardData(), slots: [] },
    isValid: false,
  },
  // A slot with no start cannot be placed or given a state.
  {
    name: 'both refuse a slot with no start',
    data: withTheFirstSlot({ startsAtMs: undefined }),
    isValid: false,
  },
  // The start is milliseconds.
  {
    name: 'both refuse a start as text',
    data: withTheFirstSlot({ startsAtMs: '08:30' }),
    isValid: false,
  },
  // The state is never data: the board works it out from the clock.
  {
    name: 'both refuse a slot with a status of its own',
    data: withTheFirstSlot({ status: 'done' }),
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createSundayBoardData(), dateText: 'domingo' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled; the payload as JSON sends it.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(sessionsBoardManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteSessionsBoardData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
