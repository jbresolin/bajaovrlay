/**
 * The sponsor bug's DOM (packages/graphics/sponsor-bug)
 *
 * What this module is for:
 *   sponsorBugView.ts draws the bug from its data with Lit: the Baja SAE Brasil mark, then
 *   the event word over the sponsor cell (the caption over the sponsor's logo). A part with
 *   nothing to show is not in the DOM at all, so the card never has an empty cell.
 *
 * What these tests prove:
 *   - The design's bug: the mark (named "Baja SAE Brasil"), "ENDURO", "Apresentado por"
 *     and the sponsor's logo from its /media address, on the light plate.
 *   - Without a sponsor logo there is no sponsor cell and no caption, only the mark and
 *     the word; without the event word there is no word.
 *   - A logo whose plate is off sits straight on the card.
 *   - The sponsor's logo is an <img> and nothing else.
 *
 * What these tests deliberately do not cover:
 *   - How the card looks; jsdom draws nothing. e2e/sponsorBugScreenshots.e2e.ts pins the
 *     bug with and without a sponsor against its baselines on the grey and black stages.
 *   - Which cells a combination has as a rule; sponsorBugModel.test.ts lists them.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { SponsorBugData } from './sponsorBugModel.js';
import { renderSponsorBugTemplate } from './sponsorBugView.js';

/** The enduro's bug presented by the master sponsor, its logo on the light plate. */
function createEnduroBugWithSponsor(): SponsorBugData {
  return {
    eventWord: 'ENDURO',
    caption: 'Apresentado por',
    sponsorLogoUrl: '/media/7d1e3a5c-logo-serra-azul',
    sponsorLogoOnLightPlate: true,
  };
}

/** Draws the bug for the data into a fresh container, as the component's render does. */
function drawSponsorBug(data: SponsorBugData): HTMLElement {
  const container = document.createElement('div');
  render(renderSponsorBugTemplate(data), container);
  return container;
}

/** Finds one part by its test id; undefined when it is not in the DOM. */
function findPart(container: HTMLElement, testId: string): HTMLElement | undefined {
  return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

describe('renderSponsorBugTemplate', () => {
  it('draws the design’s bug: the mark, ENDURO, the caption and the logo on its plate', () => {
    // Arrange: the enduro's bug with its sponsor.
    const data = createEnduroBugWithSponsor();

    // Act: draw it.
    const container = drawSponsorBug(data);

    // Assert: every part, in pt-BR, with the logo from the media store on the plate.
    expect(
      findPart(container, 'sponsor-bug-mark')?.getAttribute('alt'),
      'the mark is named for those who cannot see it',
    ).toBe('Baja SAE Brasil');
    expect(findPart(container, 'sponsor-bug-event-word')?.textContent, 'the word').toBe('ENDURO');
    expect(findPart(container, 'sponsor-bug-caption')?.textContent, 'the caption').toBe(
      'Apresentado por',
    );
    expect(
      findPart(container, 'sponsor-bug-sponsor-logo')?.getAttribute('src'),
      'the sponsor’s logo comes from the media store',
    ).toBe('/media/7d1e3a5c-logo-serra-azul');
    expect(
      findPart(container, 'sponsor-bug-sponsor-logo-box')?.classList.contains('on-light-plate'),
      'the logo sits on the light plate',
    ).toBe(true);
  });

  it('draws the mark and the event word alone without a sponsor logo, never an empty cell', () => {
    // Arrange: the bug with no sponsor this morning, the caption still in the data.
    const data = { eventWord: 'ENDURO', caption: 'Apresentado por' };

    // Act: draw it.
    const container = drawSponsorBug(data);

    // Assert: no sponsor cell and no caption; the mark and the word are there.
    expect(findPart(container, 'sponsor-bug-sponsor-cell'), 'no sponsor cell').toBeUndefined();
    expect(findPart(container, 'sponsor-bug-caption'), 'no caption over nothing').toBeUndefined();
    expect(findPart(container, 'sponsor-bug-mark'), 'the mark').toBeDefined();
    expect(findPart(container, 'sponsor-bug-event-word')?.textContent, 'the word').toBe('ENDURO');
  });

  it('draws no event word when there is none, the sponsor cell beside the mark', () => {
    // Arrange: the bug of a session with no event word.
    const data = { ...createEnduroBugWithSponsor(), eventWord: undefined };

    // Act: draw it.
    const container = drawSponsorBug(data);

    // Assert: no word, the sponsor cell kept.
    expect(findPart(container, 'sponsor-bug-event-word'), 'no word').toBeUndefined();
    expect(findPart(container, 'sponsor-bug-sponsor-cell'), 'the sponsor cell').toBeDefined();
  });

  it('puts a logo whose plate is off straight on the card', () => {
    // Arrange: a light logo, the plate not ticked in Cadastros.
    const data = { ...createEnduroBugWithSponsor(), sponsorLogoOnLightPlate: false };

    // Act: draw it.
    const container = drawSponsorBug(data);

    // Assert: the logo's box has no plate.
    expect(
      findPart(container, 'sponsor-bug-sponsor-logo-box')?.classList.contains('on-light-plate'),
      'a logo off the plate sits on the slate',
    ).toBe(false);
  });

  it('draws the sponsor’s logo with an <img> and nothing else', () => {
    // Arrange: the enduro's bug with its sponsor (an uploaded SVG would be the same).
    const data = createEnduroBugWithSponsor();

    // Act: draw it.
    const container = drawSponsorBug(data);

    // Assert: an <img>, and no element that would run an SVG's script.
    expect(
      findPart(container, 'sponsor-bug-sponsor-logo')?.tagName,
      'the logo must be an image element',
    ).toBe('IMG');
    expect(
      container.querySelectorAll('object, embed, iframe').length,
      'no element that runs a file’s script',
    ).toBe(0);
  });
});
