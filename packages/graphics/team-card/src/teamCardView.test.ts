/**
 * The team card's DOM (packages/graphics/team-card)
 *
 * What this module is for:
 *   teamCardView.ts is the card's markup, drawn by Lit from the data: the big chip, the
 *   team's name, the school and the place line, with the photo cell at the left and the
 *   logo cell at the right. A cell the team has no media for is not drawn at all, so the
 *   card is shorter or narrower and never shows an empty frame. Images are `<img src>`
 *   only (packages/graphics/README.md: an `<img>` runs no script, even an SVG's).
 *
 * What these tests prove:
 *   - The chip, the name, the school and "Rio de Janeiro · RJ" are written as sent (the
 *     styles set them in caps).
 *   - The photo and the logo are `<img>` elements with the addresses sent and pt-BR
 *     alternative texts; a missing photo, logo or place line is absent from the DOM, not an
 *     empty box, and so is the dot that would have led into the place line.
 *   - The light plate is drawn (a class on the logo cell) only with `logoOnLightPlate`.
 *   - Lit redraws in place: the card stays the same element when a logo comes or goes, so
 *     the animations' inline styles on it survive an update on air.
 *
 * What these tests deliberately do not cover:
 *   - How the card looks; jsdom draws nothing. e2e/teamCardScreenshots.e2e.ts pins all
 *     eight combinations against their baselines on the grey and the black stage.
 *   - Which cells a combination has as a rule; teamCardModel.test.ts lists them.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { TeamCardData } from './teamCardModel.js';
import { renderTeamCardTemplate } from './teamCardView.js';

/** Builds car 7 with everything the Cadastros hold: Reptiles Baja PUC-Rio, Rio de Janeiro. */
function createReptilesTeamCardData(): TeamCardData {
  return {
    carNumber: 7,
    teamName: 'Reptiles Baja PUC-Rio',
    schoolName: 'PUC-Rio',
    city: 'Rio de Janeiro',
    state: 'RJ',
    carPhotoUrl: '/media/0b6f3c2a-photo-car-7',
    logoUrl: '/media/5d1e9a40-logo-reptiles',
    logoOnLightPlate: true,
  };
}

/** Draws the card for the data into a fresh container, as the component's render does. */
function drawTeamCard(data: TeamCardData): HTMLElement {
  const container = document.createElement('div');
  render(renderTeamCardTemplate(data), container);
  return container;
}

/** Finds one part by its test id; undefined when it is not in the DOM. */
function findPart(container: HTMLElement, testId: string): HTMLElement | undefined {
  return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** Reads what a viewer reads: the text of each text part that is in the DOM, by name. */
function readShownTexts(container: HTMLElement): Record<string, string> {
  const shownTexts: Record<string, string> = {};
  const textParts = [
    ['carNumber', 'team-card-car-number'],
    ['teamName', 'team-card-team-name'],
    ['schoolName', 'team-card-school-name'],
    ['detailsSeparator', 'team-card-details-separator'],
    ['placeLine', 'team-card-place-line'],
  ];
  for (const [partName, testId] of textParts) {
    const part = findPart(container, testId ?? '');
    if (part !== undefined && partName !== undefined) {
      shownTexts[partName] = part.textContent ?? '';
    }
  }
  return shownTexts;
}

describe('a team card with everything', () => {
  it('shows the chip, the team, the school and the place line in pt-BR', () => {
    // Arrange: car 7 with its city and state.
    const data = createReptilesTeamCardData();

    // Act: draw the card.
    const container = drawTeamCard(data);

    // Assert: each text is written as sent, the place line joined with a middle dot.
    expect(readShownTexts(container), 'the card must show its texts as sent').toEqual({
      carNumber: '7',
      teamName: 'Reptiles Baja PUC-Rio',
      schoolName: 'PUC-Rio',
      detailsSeparator: '·',
      placeLine: 'Rio de Janeiro · RJ',
    });
  });

  it('draws the photo and the logo as <img> elements with pt-BR alternative texts', () => {
    // Arrange: car 7 with its photo and its logo.
    const data = createReptilesTeamCardData();

    // Act: draw the card.
    const container = drawTeamCard(data);
    const photo = findPart(container, 'team-card-photo');
    const logo = findPart(container, 'team-card-logo');

    // Assert: both are plain images, pointing at the media addresses sent.
    expect(photo?.tagName, 'the photo must be an <img>, never an object or a frame').toBe('IMG');
    expect(logo?.tagName, 'the logo must be an <img>, never an object or a frame').toBe('IMG');
    expect(photo?.getAttribute('src'), 'the photo must load the address sent').toBe(
      '/media/0b6f3c2a-photo-car-7',
    );
    expect(logo?.getAttribute('src'), 'the logo must load the address sent').toBe(
      '/media/5d1e9a40-logo-reptiles',
    );
    expect(photo?.getAttribute('alt'), 'the photo must be named in pt-BR').toBe('Foto do carro 7');
    expect(logo?.getAttribute('alt'), 'the logo must be named in pt-BR').toBe(
      'Logo da equipe Reptiles Baja PUC-Rio',
    );
  });

  it('puts the photo before the text and the logo after it', () => {
    // Arrange: car 7 with both media.
    const data = createReptilesTeamCardData();

    // Act: draw the card and read the order of its cells.
    const container = drawTeamCard(data);
    const card = findPart(container, 'team-card-panel');
    const cellOrder = [...(card?.children ?? [])].map((cell) => cell.getAttribute('data-testid'));

    // Assert: photo at the left, the text block, the logo at the right.
    expect(cellOrder, 'the cells must run photo, text, logo, as the design draws them').toEqual([
      'team-card-photo',
      'team-card-identity',
      'team-card-logo-cell',
    ]);
  });
});

describe('parts the team does not have', () => {
  const missingPartScenarios = [
    {
      // No photo handed over: the photo cell is not drawn at all.
      name: 'leaves out the photo cell without a photo',
      data: { ...createReptilesTeamCardData(), carPhotoUrl: undefined },
      absentTestIds: ['team-card-photo'],
    },
    {
      // No logo uploaded: neither the logo nor the cell (or plate) that would hold it.
      name: 'leaves out the logo cell and its plate without a logo',
      data: { ...createReptilesTeamCardData(), logoUrl: undefined },
      absentTestIds: ['team-card-logo-cell', 'team-card-logo'],
    },
    {
      // No city or state: no place line, and no dot leading into it.
      name: 'leaves out the place line and its dot without a city or a state',
      data: { ...createReptilesTeamCardData(), city: undefined, state: undefined },
      absentTestIds: ['team-card-place-line', 'team-card-details-separator'],
    },
    {
      // An image address cleared to blanks upstream is no image.
      name: 'leaves out a media cell whose address is blank',
      data: { ...createReptilesTeamCardData(), carPhotoUrl: ' ', logoUrl: '' },
      absentTestIds: ['team-card-photo', 'team-card-logo-cell', 'team-card-logo'],
    },
  ];

  it.each(missingPartScenarios)('$name', ({ data, absentTestIds }) => {
    // Arrange: the data comes from the scenario row above.

    // Act: draw the card and look for each part that should be gone.
    const container = drawTeamCard(data);
    const presentButShouldBeAbsent = absentTestIds.filter(
      (testId) => findPart(container, testId) !== undefined,
    );

    // Assert: none of them is in the DOM, not even as an empty box.
    expect(presentButShouldBeAbsent, 'a part the team lacks must not be in the DOM').toEqual([]);
  });

  it('shows the chip, the name and the school alone when the team has nothing else', () => {
    // Arrange: car 47 with only the fields the card needs.
    const data = { carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB' };

    // Act: draw the card and list its cells.
    const container = drawTeamCard(data);
    const card = findPart(container, 'team-card-panel');
    const cellOrder = [...(card?.children ?? [])].map((cell) => cell.getAttribute('data-testid'));

    // Assert: one cell, the text block, with the three texts.
    expect(cellOrder, 'a card without media must be the text block alone').toEqual([
      'team-card-identity',
    ]);
    expect(
      readShownTexts(container),
      'the bare card must show the car, the team and the school',
    ).toEqual({
      carNumber: '47',
      teamName: 'Pato Baja',
      schoolName: 'UTFPR-PB',
    });
  });
});

describe('the logo’s light plate', () => {
  const plateScenarios = [
    // A dark logo, or one on its own white box: drawn on the plate.
    {
      name: 'draws the plate when logoOnLightPlate is true',
      logoOnLightPlate: true,
      expected: true,
    },
    // A light logo: straight on the panel.
    {
      name: 'draws no plate when logoOnLightPlate is false',
      logoOnLightPlate: false,
      expected: false,
    },
    // Never set: the default, on the panel.
    {
      name: 'draws no plate when logoOnLightPlate is left out',
      logoOnLightPlate: undefined,
      expected: false,
    },
  ];

  it.each(plateScenarios)('$name', ({ logoOnLightPlate, expected }) => {
    // Arrange: car 7 with its logo and the scenario's plate switch.
    const data = { ...createReptilesTeamCardData(), logoOnLightPlate };

    // Act: draw the card and read the logo cell's classes.
    const container = drawTeamCard(data);
    const logoCell = findPart(container, 'team-card-logo-cell');

    // Assert: the plate class is there exactly when asked for.
    expect(
      logoCell?.classList.contains('on-light-plate'),
      'the logo cell must carry the plate class only with logoOnLightPlate',
    ).toBe(expected);
  });
});

describe('redrawing in place', () => {
  it('keeps the same card element when the logo is taken away and given back', () => {
    // Arrange: car 7 drawn with its logo, the card element noted.
    const container = document.createElement('div');
    render(renderTeamCardTemplate(createReptilesTeamCardData()), container);
    const cardBefore = findPart(container, 'team-card-panel');

    // Act: redraw without the logo, then with it again.
    render(
      renderTeamCardTemplate({ ...createReptilesTeamCardData(), logoUrl: undefined }),
      container,
    );
    const logoWhileAbsent = findPart(container, 'team-card-logo-cell');
    render(renderTeamCardTemplate(createReptilesTeamCardData()), container);

    // Assert: the same card element throughout; the logo went and came back.
    expect(findPart(container, 'team-card-panel'), 'the card must never be rebuilt').toBe(
      cardBefore,
    );
    expect(logoWhileAbsent, 'the logo cell must be gone while there is no logo').toBeUndefined();
    expect(findPart(container, 'team-card-logo'), 'the logo must be back').toBeDefined();
  });
});
