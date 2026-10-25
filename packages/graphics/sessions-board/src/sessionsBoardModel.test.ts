/**
 * The sessions board's data (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   sessionsBoardModel.ts checks the data `load` and `updateAction` receive and merges a
 *   partial update (the live refresh sends every slot after an edit of the schedule) into
 *   what is on air, never half-applying one.
 *
 * What these tests prove:
 *   - A refresh with the whole new list of slots replaces the list and keeps the head.
 *   - A bad update is refused with a pt-BR sentence naming the field, and nothing changes.
 *   - The head's blank lines are left out.
 *
 * What these tests deliberately do not cover:
 *   - Which payloads pass; sessionsBoardManifestDataAgreement.test.ts runs them through
 *     both checks.
 */
import { describe, expect, it } from 'vitest';

import {
  listSessionsBoardHeadLines,
  mergePartialUpdateIntoSessionsBoardData,
  type SessionsBoardData,
} from './sessionsBoardModel.js';

/** Sunday's board with the briefing alone. */
function createSundayBoardWithTheBriefing(): SessionsBoardData {
  return {
    title: 'PROGRAMAÇÃO DO DIA',
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
    slots: [
      {
        slotId: 'briefing',
        sessionName: 'Briefing das equipes',
        startsAtMs: Date.parse('2025-03-30T08:30:00.000-03:00'),
      },
    ],
  };
}

describe('mergePartialUpdateIntoSessionsBoardData', () => {
  it('replaces the list of slots with the refreshed one and keeps the head', () => {
    // Arrange: the board on air, and the schedule's new list with the enduro added.
    const onAir = createSundayBoardWithTheBriefing();
    const refreshedSlots = [
      ...onAir.slots,
      {
        slotId: 'enduro',
        sessionName: 'Enduro de Resistência',
        startsAtMs: Date.parse('2025-03-30T10:00:00.000-03:00'),
      },
    ];

    // Act: merge the refresh.
    const check = mergePartialUpdateIntoSessionsBoardData(onAir, { slots: refreshedSlots });

    // Assert: the two slots, the head as it was.
    expect(check, 'the list follows Cadastros').toEqual({
      isValid: true,
      data: { ...onAir, slots: refreshedSlots },
    });
  });

  it('refuses a bad update in pt-BR and changes nothing', () => {
    // Arrange: the board on air.
    const onAir = createSundayBoardWithTheBriefing();

    // Act: an update with an empty title.
    const check = mergePartialUpdateIntoSessionsBoardData(onAir, { title: '' });

    // Assert: refused, naming the field; the board as it was.
    expect(check, 'refused').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "title".',
    });
    expect(onAir, 'nothing half-applied').toEqual(createSundayBoardWithTheBriefing());
  });
});

describe('listSessionsBoardHeadLines', () => {
  it('leaves blank lines out', () => {
    // Arrange: the board with a blank event line and no date line.
    const data = { ...createSundayBoardWithTheBriefing(), eventLine: ' ', dateLine: undefined };

    // Act: list the head's lines.
    const headLines = listSessionsBoardHeadLines(data);

    // Assert: neither drawn.
    expect(headLines, 'no empty line').toEqual({ eventLine: undefined, dateLine: undefined });
  });
});
