/**
 * A team's logo cell (packages/graphics/kit)
 *
 * What this module is for:
 *   The team card and the podium both crown a team with its logo: the logo whole inside a
 *   box, on the panel as it is or on the small light plate when the team chose it in
 *   Cadastros. renderTeamLogoCell is that cell, written once for both (gate 2 of PR #27);
 *   each graphic gives it its own test ids and sizes the box with its own custom property.
 *
 * What these tests prove:
 *   - The cell holds one <img> with the logo's address and the pt-BR alternative text, and
 *     carries the graphic's test ids.
 *   - On the plate it carries `team-logo-cell--on-light-plate`; off the plate it does not.
 *
 * What these tests deliberately do not cover:
 *   - The look (the box, the plate's padding and colour): the team card's and the podium's
 *     screenshot tests, which stayed the same when the cell moved here.
 */
import { buildFakeMediaId } from '@bajaovrlay/shared/fakeMediaIds.testSupport';
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import { renderTeamLogoCell } from './teamLogoCell.js';

/** Draws the cell of Baja UFPR's logo into a fresh element and returns the element. */
function drawLogoCellOfBajaUfpr(isOnLightPlate: boolean): HTMLElement {
  const container = document.createElement('div');
  render(
    renderTeamLogoCell({
      logoUrl: `/media/${buildFakeMediaId(3)}`,
      alternativeText: 'Logo da equipe Baja UFPR',
      isOnLightPlate,
      cellTestId: 'podium-logo-cell',
      imageTestId: 'podium-logo',
    }),
    container,
  );
  return container;
}

describe('renderTeamLogoCell', () => {
  it('draws the logo as one image, with its address, its pt-BR text and the test ids', () => {
    // Arrange: nothing beyond the logo of Baja UFPR.

    // Act: draw the cell off the plate.
    const container = drawLogoCellOfBajaUfpr(false);

    // Assert: the cell and its one image, as the graphic named them.
    const cell = container.querySelector('[data-testid="podium-logo-cell"]');
    const image = cell?.querySelector('img');
    expect(cell?.querySelectorAll('img').length, 'one image, nothing that runs a script').toBe(1);
    expect(image?.getAttribute('data-testid'), 'the image carries its test id').toBe('podium-logo');
    expect(image?.getAttribute('src'), 'the logo’s /media address').toBe(
      `/media/${buildFakeMediaId(3)}`,
    );
    expect(image?.getAttribute('alt'), 'the pt-BR alternative text').toBe(
      'Logo da equipe Baja UFPR',
    );
  });

  it('puts the cell on the light plate only when asked', () => {
    // Arrange: nothing beyond the logo of Baja UFPR.

    // Act: draw the cell on the plate, then off it.
    const onThePlate = drawLogoCellOfBajaUfpr(true).querySelector('.team-logo-cell');
    const offThePlate = drawLogoCellOfBajaUfpr(false).querySelector('.team-logo-cell');

    // Assert: the plate's class on the first only.
    expect(
      onThePlate?.classList.contains('team-logo-cell--on-light-plate'),
      'a team that chose the plate gets it',
    ).toBe(true);
    expect(
      offThePlate?.classList.contains('team-logo-cell--on-light-plate'),
      'a team that did not stays on the panel',
    ).toBe(false);
  });
});
