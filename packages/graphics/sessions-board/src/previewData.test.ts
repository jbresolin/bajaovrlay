/**
 * What the sessions board's preview page loads (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   preview.html shows the design's Sunday: six slots placed around "now" so the third,
 *   "Alinhamento do enduro", is in progress whenever the page opens; `?data=<JSON>`
 *   replaces it with any data, which the graphic's own load then judges.
 *
 * What these tests prove:
 *   - The sample's six slots, with two done, the alignment in progress and three to come at
 *     "now", by shared's rule.
 *   - `?data=` is read as JSON as it is; text that is not JSON gives the pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - The page's buttons; the e2e tests drive the built preview.
 */
import { findStatusOfScheduleSlot } from '@bajaovrlay/shared/scheduleSlotStatus';
import { describe, expect, it } from 'vitest';

import { choosePreviewData } from './previewData.js';
import type { SessionsBoardData } from './sessionsBoardModel.js';

/** 09:20 on Sunday 30 March 2025 in Brasília: "now" for these tests. */
const nowMs = Date.parse('2025-03-30T09:20:00.000-03:00');

describe('choosePreviewData', () => {
  it('places Sunday’s six slots so the alignment is in progress now', () => {
    // Arrange: an address with no query.

    // Act: choose the data and work out each slot's state now.
    const choice = choosePreviewData('', nowMs);
    const data = choice.isReadable ? (choice.data as SessionsBoardData) : undefined;
    const statuses = (data?.slots ?? []).map((slot) => [
      slot.sessionName,
      findStatusOfScheduleSlot(slot, data?.slots ?? [], nowMs),
    ]);

    // Assert: two done, the alignment running, three to come.
    expect(statuses, 'the design’s moment, whenever the page opens').toEqual([
      ['Abertura do box', 'finished'],
      ['Briefing das equipes', 'finished'],
      ['Alinhamento do enduro', 'inProgress'],
      ['Enduro de Resistência', 'upcoming'],
      ['Intervalo', 'upcoming'],
      ['Cerimônia de premiação', 'upcoming'],
    ]);
  });

  it('reads ?data= as JSON, and says when it is not', () => {
    // Arrange: one address with JSON, one with a broken text.
    const goodAddress = `?data=${encodeURIComponent('{"title":"PROGRAMAÇÃO"}')}`;

    // Act: choose the data for both.
    const goodChoice = choosePreviewData(goodAddress, nowMs);
    const badChoice = choosePreviewData('?data=%7Bquebrado', nowMs);

    // Assert: the JSON as it is, and the pt-BR problem.
    expect(goodChoice, 'the JSON as it is').toEqual({
      isReadable: true,
      data: { title: 'PROGRAMAÇÃO' },
    });
    expect(badChoice, 'a broken text says why').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
