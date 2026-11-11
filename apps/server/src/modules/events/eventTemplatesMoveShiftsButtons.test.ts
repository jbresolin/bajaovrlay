/**
 * The buttons a boot's template move shifts, logged for the operator (apps/server)
 *
 * What this module is for:
 *   The one-time move of an older database's event templates off the quick-fire panels
 *   (BAJAOVRLAY-67) closes each panel up: a button that sat after a template moves one
 *   place earlier. A pad finds a button by its place (`fire-shortcut/atalhos/2`, the D200's
 *   state routes), so after the update the same key may fire a different item. The move
 *   cannot fix the pads, so it says which buttons moved: one pt-BR warning per button, with
 *   its panel and its old and new place, telling João to check his Companion and D200 pages
 *   (gate 2 of PR #58).
 *
 * What these tests prove, calling the boot's loader on the rows of an older database:
 *   - Every button after a template on its panel is logged with its panel, its label, its
 *     old place and its new one, counted from 1 as fire-shortcut counts, in panel order.
 *   - A button before every template, and the templates themselves, are not logged.
 *   - A database whose panels hold no template logs no shifted button.
 *
 * What these tests deliberately do not cover:
 *   - Where the templates go and when "Avisos" is deleted;
 *     eventTemplatesLeaveQuickFireAtBoot.test.ts.
 */
import type { Item, ItemFields, QuickFirePanel } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  createRecordingLogger,
  type RecordedLogLine,
} from '../../core/logger/recordingLogger.testSupport.js';
import { loadOrSeedEventInboxSlices, superChatItemSeedName } from './loadEventInboxSlices.js';
import { seededEventRules } from './seedEventRules.js';

/** The panels of an older database: "Atalhos", "Avisos" and "Logo". */
function buildPanelsOfAnOlderDatabase(): QuickFirePanel[] {
  return [
    { id: 'atalhos', name: 'Atalhos', order: 0 },
    { id: 'avisos', name: 'Avisos', order: 1 },
    { id: 'logo', name: 'Logo', order: 2 },
  ];
}

/** A typed race clock: an ordinary button. */
function buildTypedClockFields(sessionName: string): ItemFields {
  return {
    sessionName: { kind: 'literal', value: sessionName },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'remaining' },
    referenceTimeMs: { kind: 'literal', value: 4_560_000 },
    referenceWallClockMs: { kind: 'literal', value: Date.parse('2027-08-14T14:00:00.000Z') },
    running: { kind: 'literal', value: true },
  };
}

/** An ordinary race clock button at this place of a panel. */
function buildClockButton(id: string, label: string, panelId: string, order: number): Item {
  return {
    id,
    home: { kind: 'quickFire', panelId },
    order,
    graphicId: 'race-clock',
    layerId: 'clock',
    label,
    color: 'neutral',
    notes: '',
    fields: buildTypedClockFields(label),
  };
}

/** A notice template (car and reason read from the event) at this place of a panel. */
function buildNoticeTemplate(id: string, label: string, panelId: string, order: number): Item {
  return {
    id,
    home: { kind: 'quickFire', panelId },
    order,
    graphicId: 'notice',
    layerId: 'notice',
    label,
    color: 'danger',
    notes: '',
    fields: {
      variant: { kind: 'literal', value: 'penalty' },
      carNumber: { kind: 'eventField', path: 'carNumber' },
      reason: { kind: 'eventField', path: 'reason' },
    },
  };
}

/** Boots the loader on these panels and items, and returns the log lines it wrote. */
function bootAndReadTheLogLines(
  quickFirePanels: QuickFirePanel[],
  items: Item[],
): RecordedLogLine[] {
  const { logger, readRecordedLines } = createRecordingLogger();
  loadOrSeedEventInboxSlices(
    [{ name: 'eventRules', json: seededEventRules, updatedAt: '2027-08-14T13:00:00.000Z' }],
    { quickFirePanels, items },
    // The Super Chat seed already ran on this database, so only the move applies.
    [superChatItemSeedName],
    '2027-08-14T13:00:00.000Z',
    logger,
  );
  return readRecordedLines();
}

/** The warnings about a shifted button, as the boot logged them. */
function readShiftedButtonWarnings(logLines: RecordedLogLine[]): RecordedLogLine[] {
  return logLines.filter((line) => line.level === 'warn' && 'shifted_button' in line);
}

describe('the buttons shifted by the template move, at boot', () => {
  it('logs every button after a template, with its panel and its old and new place', () => {
    // Arrange: "Atalhos" holds "Largada", a copy of "Penalidade", then "Bandeira amarela"
    // and "Relógio da prova"; "Avisos" holds "Penalidade" then "Bandeira vermelha".
    const items = [
      buildClockButton('largada', 'Largada', 'atalhos', 0),
      buildNoticeTemplate('penalidade-copia', 'Penalidade (cópia)', 'atalhos', 1),
      buildClockButton('bandeira-amarela', 'Bandeira amarela', 'atalhos', 2),
      buildClockButton('relogio-da-prova', 'Relógio da prova', 'atalhos', 3),
      buildNoticeTemplate('penalidade', 'Penalidade', 'avisos', 0),
      buildClockButton('bandeira-vermelha', 'Bandeira vermelha', 'avisos', 1),
    ];

    // Act: boot on it.
    const logLines = bootAndReadTheLogLines(buildPanelsOfAnOlderDatabase(), items);

    // Assert: the three buttons after a template, each a pt-BR warning naming its panel and
    // both places counted from 1; "Largada", before the copy, stayed put and is not named.
    expect(
      readShiftedButtonWarnings(logLines).map((line) => ({
        shiftedButton: line.shifted_button,
        message: line.message,
      })),
      'every shifted button must be logged once, in panel order',
    ).toEqual([
      {
        shiftedButton: {
          panel_id: 'atalhos',
          item_id: 'bandeira-amarela',
          place_before: 3,
          place_after: 2,
        },
        message:
          'Botão de atalho mudou de lugar: no painel "Atalhos", "Bandeira amarela" era o botão 3 e agora é o 2. Confira as páginas do Companion e do D200 que disparam este painel.',
      },
      {
        shiftedButton: {
          panel_id: 'atalhos',
          item_id: 'relogio-da-prova',
          place_before: 4,
          place_after: 3,
        },
        message:
          'Botão de atalho mudou de lugar: no painel "Atalhos", "Relógio da prova" era o botão 4 e agora é o 3. Confira as páginas do Companion e do D200 que disparam este painel.',
      },
      {
        shiftedButton: {
          panel_id: 'avisos',
          item_id: 'bandeira-vermelha',
          place_before: 2,
          place_after: 1,
        },
        message:
          'Botão de atalho mudou de lugar: no painel "Avisos", "Bandeira vermelha" era o botão 2 e agora é o 1. Confira as páginas do Companion e do D200 que disparam este painel.',
      },
    ]);
  });

  it('logs no shifted button when no panel holds a template', () => {
    // Arrange: an older database whose panels hold only ordinary buttons.
    const items = [
      buildClockButton('largada', 'Largada', 'atalhos', 0),
      buildClockButton('bandeira-amarela', 'Bandeira amarela', 'atalhos', 1),
    ];

    // Act: boot on it.
    const logLines = bootAndReadTheLogLines(buildPanelsOfAnOlderDatabase(), items);

    // Assert: nothing moved, so nothing to check on the pads.
    expect(readShiftedButtonWarnings(logLines), 'no button moved, none is logged').toEqual([]);
  });
});
