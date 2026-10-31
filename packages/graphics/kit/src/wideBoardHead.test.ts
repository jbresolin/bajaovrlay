/**
 * The head card of a wide board (packages/graphics/kit)
 *
 * What this module is for:
 *   The standings and the podium open with the same head card: the organiser's logo, the
 *   title, the event line and a line at the right (the standings' page, the podium's
 *   step). wideBoardHead.ts is its markup, the lookup of its parts and the writer of its texts,
 *   written once for both; each graphic names the test ids with its own prefix.
 *
 * What these tests prove:
 *   - The markup carries the graphic's prefix on every part and the logo's pt-BR text.
 *   - findWideBoardHeadParts finds the four parts, and refuses a template missing one.
 *   - writeWideBoardHead writes the three texts, and hides the event line when it is empty, so
 *     the line at the right keeps its place; a later text shows it again.
 *
 * What these tests deliberately do not cover:
 *   - The look of the head: the standings' and the podium's screenshot tests.
 */
import { html, render } from 'lit';
import { describe, expect, it } from 'vitest';

import {
  findWideBoardHeadParts,
  renderWideBoardHeadTemplate,
  writeWideBoardHead,
} from './wideBoardHead.js';

/** Draws the podium's head into a fresh element and returns the element. */
function drawThePodiumHead(): HTMLElement {
  const container = document.createElement('div');
  render(renderWideBoardHeadTemplate('podium', 'Baja SAE Brasil'), container);
  return container;
}

describe('the board head', () => {
  it('names every part with the graphic’s prefix and gives the logo its pt-BR text', () => {
    // Arrange: nothing beyond the podium's prefix.

    // Act: draw the head.
    const container = drawThePodiumHead();

    // Assert: the four test ids under the prefix, and the logo's alternative text.
    const testIds = [...container.querySelectorAll('[data-testid]')].map((element) =>
      element.getAttribute('data-testid'),
    );
    expect(testIds, 'each part carries the podium’s prefix').toEqual([
      'podium-head',
      'podium-title',
      'podium-event-line',
      'podium-page-line',
    ]);
    expect(container.querySelector('img')?.getAttribute('alt'), 'the logo’s text').toBe(
      'Baja SAE Brasil',
    );
  });

  it('finds its four parts, and refuses a template missing one', () => {
    // Arrange: the podium's head, and a template that drew only a title.
    const container = drawThePodiumHead();
    const brokenContainer = document.createElement('div');
    render(html`<h1 data-testid="podium-title"></h1>`, brokenContainer);

    // Act: look for the parts in both.
    const parts = findWideBoardHeadParts(container, 'podium');
    const lookInTheBrokenOne = () => findWideBoardHeadParts(brokenContainer, 'podium');

    // Assert: the four parts of the real head; a bug named for the broken one.
    expect(parts.head.dataset.testid, 'the head card').toBe('podium-head');
    expect(parts.pageLine.dataset.testid, 'the line at the right').toBe('podium-page-line');
    expect(lookInTheBrokenOne, 'a missing part is a bug in the template').toThrow(
      'board head part "podium-head" is missing from the template; this is a bug',
    );
  });

  it('writes the texts, hiding an empty event line and showing it again later', () => {
    // Arrange: the podium's head and its parts.
    const parts = findWideBoardHeadParts(drawThePodiumHead(), 'podium');

    // Act: write a head with no event, then one with the enduro's.
    writeWideBoardHead(parts, { title: 'PÓDIO', eventLine: '', pageLine: '' });
    const isEventLineHiddenWhenEmpty = parts.eventLine.hidden;
    writeWideBoardHead(parts, {
      title: 'PÓDIO',
      eventLine: 'ENDURO DE RESISTÊNCIA',
      pageLine: '2/3',
    });

    // Assert: hidden while empty; then the three texts, the event line shown.
    expect(isEventLineHiddenWhenEmpty, 'an empty event line is hidden').toBe(true);
    expect(
      [parts.title.textContent, parts.eventLine.textContent, parts.pageLine.textContent],
      'the three texts as written',
    ).toEqual(['PÓDIO', 'ENDURO DE RESISTÊNCIA', '2/3']);
    expect(parts.eventLine.hidden, 'an event line with text is shown').toBe(false);
  });

  it('writes the event line inside a scrolling box, so a long event scrolls, never ellipsed', () => {
    // Arrange: the standings' head and its parts.
    const parts = findWideBoardHeadParts(drawThePodiumHead(), 'podium');

    // Act: write the long name of the event.
    writeWideBoardHead(parts, {
      title: 'CLASSIFICAÇÃO GERAL',
      eventLine: '30ª COMPETIÇÃO BAJA SAE BRASIL - ETAPA NACIONAL - PIRACICABA',
      pageLine: '1/3',
    });

    // Assert: the event line is a scrolling box holding the text in its one text element.
    const textElement = parts.eventLine.querySelector(':scope > .scrolling-text');
    expect(parts.eventLine.classList.contains('scrolling-text-box'), 'a scrolling box').toBe(true);
    expect(textElement?.textContent, 'the text inside its text element').toBe(
      '30ª COMPETIÇÃO BAJA SAE BRASIL - ETAPA NACIONAL - PIRACICABA',
    );
  });
});
