/**
 * What the sponsor roll shows in each layout (packages/graphics/sponsor-roll)
 *
 * What this module is for:
 *   sponsorRollView.ts draws the full screen (the head "PATROCINADORES" with the page's
 *   level and "1/5", up to six tiles) and the corner (the bug's card: the mark, the event
 *   word, the level's heading over one logo).
 *
 * What these tests prove:
 *   - The full screen's head and the logos of page 1, each on the light plate or not as
 *     the sponsor says (Vetore's light logo straight on the card).
 *   - The corner's mark, word, heading and first sponsor; without the word, no word box.
 *
 * What these tests deliberately do not cover:
 *   - The turns; sponsor-roll.test.ts. The look; the screenshots.
 */
import { describe, expect, it } from 'vitest';

import {
  createSponsorRollOnThePage,
  createThe30thCompetitionRoll,
  createThe30thCompetitionSponsors,
  loadSponsorRollWithData,
  readShownText,
} from './sponsorRollOnThePage.testSupport.js';

describe('the full screen', () => {
  it('heads page 1 with the title, its level and its number, over its logos', async () => {
    // Arrange: a roll on the page.
    const roll = createSponsorRollOnThePage();

    // Act: load the 17.
    await loadSponsorRollWithData(roll, createThe30thCompetitionRoll('fullscreen'));

    // Assert: the head and the two Diamante logos by name.
    expect(
      [
        readShownText(roll, 'sponsor-roll-title'),
        readShownText(roll, 'sponsor-roll-subtitle'),
        readShownText(roll, 'sponsor-roll-aside'),
      ],
      'the head of page 1',
    ).toEqual(['PATROCINADORES', 'PATROCÍNIO DIAMANTE', '1/5']);
    const logoNames = [
      ...(roll.shadowRoot?.querySelectorAll('[data-testid="sponsor-roll-tile-logo"]') ?? []),
    ].map((logo) => logo.getAttribute('alt'));
    expect(logoNames, 'the Diamante logos').toEqual(['Bosch', 'Renault']);
  });

  it('puts a logo on the light plate only when its sponsor says so', async () => {
    // Arrange: a roll on the page with Certi (on the plate) and Vetore (light, on the card).
    const roll = createSponsorRollOnThePage();
    const sponsors = createThe30thCompetitionSponsors().filter((sponsor) =>
      ['Certi', 'Vetore'].includes(sponsor.name),
    );

    // Act: load them.
    await loadSponsorRollWithData(roll, { layout: 'fullscreen', sponsors });

    // Assert: the plate on Certi's box only.
    const boxes = [...(roll.shadowRoot?.querySelectorAll('.tile-logo') ?? [])];
    expect(
      boxes.map((box) => box.classList.contains('on-light-plate')),
      'the plate follows each sponsor’s choice',
    ).toEqual([true, false]);
  });
});

describe('the corner', () => {
  it('shows the mark, the event word, and the first sponsor under its level’s heading', async () => {
    // Arrange: a roll on the page.
    const roll = createSponsorRollOnThePage();

    // Act: load the 17 in the corner.
    await loadSponsorRollWithData(roll, createThe30thCompetitionRoll('corner'));

    // Assert: the design's corner card.
    expect(roll.shadowRoot?.querySelector('.mark')?.getAttribute('alt'), 'the mark').toBe(
      'Baja SAE Brasil',
    );
    expect(readShownText(roll, 'sponsor-roll-event-word'), 'the word').toBe('ENDURO');
    expect(readShownText(roll, 'sponsor-roll-cell-heading'), 'the heading').toBe(
      'PATROCÍNIO DIAMANTE',
    );
    expect(
      roll.shadowRoot?.querySelector('[data-testid="sponsor-roll-cell-logo"]')?.getAttribute('alt'),
      'Bosch first',
    ).toBe('Bosch');
  });

  it('has no word box without the event word', async () => {
    // Arrange: a roll on the page, the corner without its word.
    const roll = createSponsorRollOnThePage();
    const data = { layout: 'corner', sponsors: createThe30thCompetitionSponsors() };

    // Act: load it.
    await loadSponsorRollWithData(roll, data);

    // Assert: no word.
    expect(
      roll.shadowRoot?.querySelector('[data-testid="sponsor-roll-event-word"]'),
      'no empty word box',
    ).toBeNull();
  });
});
