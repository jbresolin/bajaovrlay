/**
 * What the sessions board shows (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   sessionsBoardView.ts draws the board: the kit's head ("PROGRAMAÇÃO DO DIA", the event,
 *   the date) and one pill per slot with its time, session and state ("CONCLUÍDA", "EM
 *   ANDAMENTO", "A SEGUIR"), each state a shape beside its word.
 *
 * What these tests prove (Brasília's clock):
 *   - The head's words, and no empty box when the event and date lines are left out.
 *   - Each row's three state words are there, in their layers, the shown one by opacity.
 *   - Each state's shape is a different SVG, hidden from assistive technology (the word
 *     says it).
 *
 * What these tests deliberately do not cover:
 *   - Which state a slot is in; sessionsBoardWindow.test.ts. The look; the screenshots.
 */
import { describe, expect, it } from 'vitest';

import {
  atSundayBrasiliaTime,
  createSessionsBoardOnThePage,
  createSundaySessionsBoardData,
  loadSessionsBoardWithData,
  takeControlOfTimeAndTimers,
} from './sessionsBoardOnThePage.testSupport.js';

describe('the head', () => {
  it('shows the title, the event and the date', async () => {
    // Arrange: 09:20 on Sunday, a board on the page.
    takeControlOfTimeAndTimers(atSundayBrasiliaTime('09:20'));
    const board = createSessionsBoardOnThePage();

    // Act: load Sunday's board.
    await loadSessionsBoardWithData(board, createSundaySessionsBoardData());

    // Assert: the design's head.
    const readPart = (testId: string) =>
      board.shadowRoot?.querySelector(`[data-testid="${testId}"]`)?.textContent;
    expect(
      [
        readPart('sessions-board-title'),
        readPart('sessions-board-subtitle'),
        readPart('sessions-board-aside'),
      ],
      'the head’s words',
    ).toEqual([
      'PROGRAMAÇÃO DO DIA',
      '30ª Competição Baja SAE Brasil',
      'domingo, 30 de março de 2025',
    ]);
  });

  it('has no empty box without the event and date lines', async () => {
    // Arrange: a board on the page, and the data with the title and slots alone.
    const board = createSessionsBoardOnThePage();
    const data = { title: 'PROGRAMAÇÃO DO DIA', slots: createSundaySessionsBoardData().slots };

    // Act: load it.
    await loadSessionsBoardWithData(board, data);

    // Assert: neither line is drawn.
    expect(
      board.shadowRoot?.querySelector('[data-testid="sessions-board-subtitle"]'),
      'no event box',
    ).toBeNull();
    expect(
      board.shadowRoot?.querySelector('[data-testid="sessions-board-aside"]'),
      'no date box',
    ).toBeNull();
  });
});

describe('a row', () => {
  it('holds the three state words, each with its own hidden shape', async () => {
    // Arrange: 09:20 on Sunday, a board on the page.
    takeControlOfTimeAndTimers(atSundayBrasiliaTime('09:20'));
    const board = createSessionsBoardOnThePage();

    // Act: load Sunday's board and read the first row's state layers.
    await loadSessionsBoardWithData(board, createSundaySessionsBoardData());
    const layers = [
      ...(board.shadowRoot
        ?.querySelector('[data-testid="sessions-board-row"]')
        ?.querySelectorAll('.status-layer') ?? []),
    ];

    // Assert: the three words, three different shapes, each hidden from screen readers.
    expect(
      layers.map((layer) => layer.textContent),
      'the three words',
    ).toEqual(['CONCLUÍDA', 'EM ANDAMENTO', 'A SEGUIR']);
    const shapes = layers.map((layer) => layer.querySelector('svg')?.innerHTML);
    expect(new Set(shapes).size, 'a different shape for each state').toBe(3);
    expect(
      layers.map((layer) => layer.querySelector('svg')?.getAttribute('aria-hidden')),
      'the word carries the meaning',
    ).toEqual(['true', 'true', 'true']);
  });
});
