/**
 * The podium's DOM (packages/graphics/podium)
 *
 * What this module is for:
 *   podiumView.ts draws the board with Lit from the data: the kit's head card and three
 *   cards, left to right the 2nd, the 1st and the 3rd, each with its logo row when the team
 *   has a logo. The lifecycle reveals and hides those card elements; the view decides what
 *   is in them.
 *
 * What these tests prove:
 *   - Three cards in the order 2nd, 1st, 3rd, each marked with its slot and the step that
 *     reveals it, writing the place, the car, the team and the school of its entry.
 *   - With a logo: a logo cell holding an `<img>` of the address, named for the team, on the
 *     light plate when the switch says so; without a logo: no logo cell at all.
 *   - The 1st place's "1º" is marked for the green chip; in a tie, both "1º" are.
 *   - A list of two keeps the third card element, empty, so its room stays (never removed).
 *   - Drawing new data keeps the same three card elements, so the inline styles the
 *     animations put on them (a revealed card's) survive an update.
 *   - findPodiumParts finds the head's parts under the podium's own test ids.
 *
 * What these tests deliberately do not cover:
 *   - Where the cards stand on the stage and that a revealed card never moves (jsdom lays
 *     nothing out); e2e/podiumLifecycle.e2e.ts and podiumScreenshots.e2e.ts measure the boxes
 *     in Chromium.
 *   - Revealing and hiding; podium.test.ts and podiumAnimations.test.ts cover them.
 */
import { render } from 'lit';
import { describe, expect, it, onTestFinished } from 'vitest';

import type { PodiumData } from './podiumModel.js';
import { findPodiumParts, renderPodiumTemplate } from './podiumView.js';
import { createEnduroPodium, createOverallPodiumWithATieForFirst } from './previewData.js';

/** Draws the template for the data into a container on the page, removed when the test ends. */
function drawPodiumOnThePage(data: PodiumData): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  onTestFinished(() => container.remove());
  render(renderPodiumTemplate(data), container);
  return container;
}

/** The three cards left to right. */
function listCards(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="podium-card"]')];
}

/** The text of one part of a card, by its test id; undefined when the card has no such part. */
function readCardPart(card: HTMLElement | undefined, testId: string): string | undefined {
  return card?.querySelector(`[data-testid="${testId}"]`)?.textContent ?? undefined;
}

describe('the cards', () => {
  it('stands the 2nd, the 1st and the 3rd left to right, each with its texts and step', () => {
    // Arrange: nothing beyond the enduro's podium without logos.

    // Act: draw it.
    const container = drawPodiumOnThePage(createEnduroPodium(false));

    // Assert: Komiketo, Sinuelo, Pato Baja, marked with their slots and reveal steps.
    expect(
      listCards(container).map((card) => ({
        slot: card.dataset.slot,
        revealedAtStep: card.dataset.revealedAtStep,
        place: readCardPart(card, 'podium-place'),
        car: readCardPart(card, 'podium-car-number'),
        team: readCardPart(card, 'podium-team-name'),
        school: readCardPart(card, 'podium-school-name'),
      })),
      'each card writes its entry, 2nd, 1st, 3rd from the left',
    ).toEqual([
      {
        slot: 'second',
        revealedAtStep: '2',
        place: '2º',
        car: '10',
        team: 'Equipe Komiketo Baja',
        school: 'UFSJ',
      },
      {
        slot: 'first',
        revealedAtStep: '3',
        place: '1º',
        car: '51',
        team: 'Sinuelo',
        school: 'FAHOR',
      },
      {
        slot: 'third',
        revealedAtStep: '1',
        place: '3º',
        car: '47',
        team: 'Pato Baja',
        school: 'UTFPR-PB',
      },
    ]);
  });

  it('draws the logo row with a logo, on the plate when asked, and none without', () => {
    // Arrange: nothing beyond the two samples.

    // Act: draw the podium with logos, then without.
    const withLogos = listCards(drawPodiumOnThePage(createEnduroPodium(true)));
    const withoutLogos = listCards(drawPodiumOnThePage(createEnduroPodium(false)));

    // Assert: Komiketo's logo on the plate, Sinuelo's on the panel, each an <img> named for
    // its team; without logos, no logo cell in any card.
    const komiketoLogoCell = withLogos[0]?.querySelector('[data-testid="podium-logo-cell"]');
    const sinueloLogoCell = withLogos[1]?.querySelector('[data-testid="podium-logo-cell"]');
    const sinueloLogo = withLogos[1]?.querySelector<HTMLImageElement>(
      '[data-testid="podium-logo"]',
    );
    expect(
      komiketoLogoCell?.classList.contains('team-logo-cell--on-light-plate'),
      "Komiketo's dark mark sits on the light plate",
    ).toBe(true);
    expect(
      sinueloLogoCell?.classList.contains('team-logo-cell--on-light-plate'),
      "Sinuelo's white mark stands on the panel",
    ).toBe(false);
    expect(sinueloLogo?.alt, 'the logo is named for its team').toBe('Logo da equipe Sinuelo');
    expect(sinueloLogo?.getAttribute('src'), 'the logo is the address given').toMatch(
      /sinuelo-logo/,
    );
    expect(
      withoutLogos.map((card) => card.querySelector('[data-testid="podium-logo-cell"]')),
      'a card without a logo has no logo row at all',
    ).toEqual([null, null, null]);
  });

  it('marks both places of a tie for first for the green chip', () => {
    // Arrange: nothing beyond the overall podium with Baja UFMG and FEI tied on rank 1.

    // Act: draw it.
    const cards = listCards(drawPodiumOnThePage(createOverallPodiumWithATieForFirst()));

    // Assert: "1º", "1º", "3º"; the two on the green chip.
    const places = cards.map((card) =>
      card.querySelector<HTMLElement>('[data-testid="podium-place"]'),
    );
    expect(
      places.map((place) => place?.textContent),
      'the shared rank shows on both cards',
    ).toEqual(['1º', '1º', '3º']);
    expect(
      places.map((place) => place?.hasAttribute('data-leader')),
      'both teams tied for first are on the green chip',
    ).toEqual([true, true, false]);
  });

  it('keeps the third card element, empty, for a list of two', () => {
    // Arrange: a session with two cars classified.
    const twoCars: PodiumData = { entries: createEnduroPodium(false).entries.slice(0, 2) };

    // Act: draw it.
    const cards = listCards(drawPodiumOnThePage(twoCars));
    const thirdCard = cards[2];

    // Assert: still three cards; the third marked empty with nothing inside.
    expect(cards.length, 'the three cards are always there, so the room never changes').toBe(3);
    expect(thirdCard?.hasAttribute('data-empty'), 'the 3rd card is marked empty').toBe(true);
    expect(thirdCard?.children.length, 'an empty card holds nothing').toBe(0);
  });

  it('keeps the same three card elements when new data is drawn', () => {
    // Arrange: the podium drawn without logos, its cards noted, one given an inline style
    // as a reveal would.
    const container = drawPodiumOnThePage(createEnduroPodium(false));
    const cardsBefore = listCards(container);
    cardsBefore[2]?.style.setProperty('opacity', '1');

    // Act: draw the podium with logos into the same container.
    render(renderPodiumTemplate(createEnduroPodium(true)), container);

    // Assert: the same elements, the inline style kept, the logo now inside.
    const cardsAfter = listCards(container);
    expect(cardsAfter, 'the card elements must be kept across redraws').toEqual(cardsBefore);
    expect(cardsAfter[2]?.style.opacity, 'a revealed card keeps its inline style').toBe('1');
    expect(
      cardsAfter[2]?.querySelector('[data-testid="podium-logo"]'),
      'the redraw put the logo in',
    ).not.toBeNull();
  });
});

describe('finding the parts', () => {
  it('finds the head under the podium’s own test ids, and the card of each slot', () => {
    // Arrange: the enduro's podium drawn.
    const container = drawPodiumOnThePage(createEnduroPodium(false));

    // Act: find the parts.
    const parts = findPodiumParts(container, container);

    // Assert: the head's parts and the three cards, by slot.
    expect(parts.head.dataset.testid, 'the head is the kit card, podium-named').toBe('podium-head');
    expect(parts.pageLine.dataset.testid, 'the step line too').toBe('podium-page-line');
    expect(parts.cardsBySlot.first.dataset.slot, 'the middle card is the 1st').toBe('first');
    expect(parts.cardsBySlot.third.dataset.carNumber, 'the right card is car 47').toBe('47');
  });
});
