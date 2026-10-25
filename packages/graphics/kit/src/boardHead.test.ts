/**
 * The narrow boards' head card (packages/graphics/kit)
 *
 * What this module is for:
 *   The four narrow boards (the waiting screen, the sessions board, the intermission and
 *   the sponsor roll; BAJAOVRLAY-46) open with the same head card as the standings: the
 *   white Baja SAE Brasil logo, the title ("PROGRAMAÇÃO DO DIA"), a subtitle (the event, or
 *   the sponsor level of the page) and a line at the right (the date, or "1/5"). The head
 *   is one Lit template here, drawn by each board from its data.
 *
 * What these tests prove:
 *   - The head draws the logo, the title, the subtitle and the line, each found by its
 *     test id under the board's prefix.
 *   - A subtitle or a line left out is not in the head at all, never an empty box.
 *   - Drawn again with another subtitle, the head keeps its elements and changes the text
 *     in place (the sponsor roll's level changes with the page, on air).
 *
 * What these tests deliberately do not cover:
 *   - The look; each board's screenshots.
 */
import { render } from 'lit';
import { describe, expect, it, onTestFinished } from 'vitest';

import { type BoardHeadContent, renderBoardHead } from './boardHead.js';

/** A container on the page to draw the head into, removed when the test ends. */
function createContainerOnThePage(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  onTestFinished(() => container.remove());
  return container;
}

/** The sessions board's head on Sunday of the 30ª Competição. */
function buildSessionsBoardHead(): BoardHeadContent {
  return {
    testIdPrefix: 'sessions-board',
    logoAlternativeText: 'Baja SAE Brasil',
    title: 'PROGRAMAÇÃO DO DIA',
    subtitle: '30ª Competição Baja SAE Brasil',
    aside: 'domingo, 30 de março de 2025',
  };
}

/** Reads the text of one part of the head by its test id; undefined when absent. */
function readPartText(container: HTMLElement, testId: string): string | undefined {
  return container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? undefined;
}

describe('renderBoardHead', () => {
  it('draws the logo, the title, the subtitle and the line at the right', () => {
    // Arrange: a container and the sessions board's head.
    const container = createContainerOnThePage();

    // Act: draw the head.
    render(renderBoardHead(buildSessionsBoardHead()), container);

    // Assert: every part under the board's prefix.
    expect(
      container.querySelector('[data-testid="sessions-board-logo"]')?.getAttribute('alt'),
      'the logo with its alternative text',
    ).toBe('Baja SAE Brasil');
    expect(readPartText(container, 'sessions-board-title'), 'the title').toBe('PROGRAMAÇÃO DO DIA');
    expect(readPartText(container, 'sessions-board-subtitle'), 'the event').toBe(
      '30ª Competição Baja SAE Brasil',
    );
    expect(readPartText(container, 'sessions-board-aside'), 'the date').toBe(
      'domingo, 30 de março de 2025',
    );
  });

  it('leaves out a subtitle and a line that are not given', () => {
    // Arrange: a container and a head with the title alone.
    const container = createContainerOnThePage();
    const headWithTheTitleAlone: BoardHeadContent = {
      testIdPrefix: 'sessions-board',
      logoAlternativeText: 'Baja SAE Brasil',
      title: 'PROGRAMAÇÃO DO DIA',
    };

    // Act: draw it.
    render(renderBoardHead(headWithTheTitleAlone), container);

    // Assert: no empty subtitle and no empty line.
    expect(readPartText(container, 'sessions-board-subtitle'), 'no subtitle').toBeUndefined();
    expect(readPartText(container, 'sessions-board-aside'), 'no line').toBeUndefined();
  });

  it('changes the subtitle in place when drawn again', () => {
    // Arrange: the sponsor roll's head on its Diamante page.
    const container = createContainerOnThePage();
    const rollHead: BoardHeadContent = {
      testIdPrefix: 'sponsor-roll',
      logoAlternativeText: 'Baja SAE Brasil',
      title: 'PATROCINADORES',
      subtitle: 'PATROCÍNIO DIAMANTE',
      aside: '1/5',
    };
    render(renderBoardHead(rollHead), container);
    const headBefore = container.querySelector('[data-testid="sponsor-roll-head"]');

    // Act: draw it again on the Ouro page.
    render(renderBoardHead({ ...rollHead, subtitle: 'PATROCÍNIO OURO', aside: '2/5' }), container);

    // Assert: the same head element, the new words.
    expect(container.querySelector('[data-testid="sponsor-roll-head"]'), 'the head is kept').toBe(
      headBefore,
    );
    expect(readPartText(container, 'sponsor-roll-subtitle'), 'the new level').toBe(
      'PATROCÍNIO OURO',
    );
    expect(readPartText(container, 'sponsor-roll-aside'), 'the new page').toBe('2/5');
  });
});
