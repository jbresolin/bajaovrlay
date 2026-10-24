/**
 * Status icons (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   A car's status is drawn as a shape in the status lane, never as a colour alone (the
 *   design's sheet-status page): a P in a square for a car in the pit, a wrench for a
 *   broken car, a circle with a slash for a car out of the race. The three are inline
 *   SVG kept in the package, each with an accessible name from the pt-BR catalog
 *   (decision 14 of the context pack).
 *
 * What these tests prove:
 *   - inPit, stopped, retired and disqualified each draw an SVG named "No box",
 *     "Quebrado", "Abandonou" and "Desclassificado"; retired and disqualified share the
 *     slashed circle (both are out of the race).
 *   - running and notStarted draw nothing, so the lane stays empty.
 *   - The icons are shapes only (no <text>), so the glyph stays a glyph.
 *
 * What these tests deliberately do not cover:
 *   - How the icons look at 20 px on air; the Playwright screenshots show them.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { PositionStatus } from './positionsTowerModel.js';
import { renderStatusIcon } from './statusIcons.js';

/** Draws the icon of a status into a fresh cell and answers the cell. */
function drawStatusIconInACell(status: PositionStatus): HTMLElement {
  const cell = document.createElement('span');
  render(renderStatusIcon(status), cell);
  return cell;
}

describe('renderStatusIcon', () => {
  const iconScenarios = [
    // In the pit: the P in a square.
    { name: 'draws "No box" for a car in the pit', status: 'inPit', expectedName: 'No box' },
    // Broken down on track: the wrench (João's gate: "quebrado", not "parado").
    { name: 'draws "Quebrado" for a stopped car', status: 'stopped', expectedName: 'Quebrado' },
    // Out of the race: the slashed circle.
    { name: 'draws "Abandonou" for a retired car', status: 'retired', expectedName: 'Abandonou' },
    // Disqualified is out of the race too: the same shape, its own name.
    {
      name: 'draws "Desclassificado" for a disqualified car',
      status: 'disqualified',
      expectedName: 'Desclassificado',
    },
  ] as const;

  it.each(iconScenarios)('$name', ({ status, expectedName }) => {
    // Arrange: an empty status cell.

    // Act: draw the icon of this status into it.
    const cell = drawStatusIconInACell(status);
    const icon = cell.querySelector('svg');

    // Assert: one SVG, named for assistive technology, made of shapes and not text.
    expect(icon, 'the status must draw an inline SVG').not.toBeNull();
    expect(icon?.getAttribute('role'), 'the icon must be an image').toBe('img');
    expect(icon?.getAttribute('aria-label'), 'the icon must carry its pt-BR name').toBe(
      expectedName,
    );
    expect(icon?.querySelector('text'), 'the icon must be a shape, never text').toBeNull();
  });

  it('shares the slashed circle between a retired and a disqualified car', () => {
    // Arrange: the two statuses that mean "out of the race".

    // Act: draw both and read their shapes.
    const retiredShapes = drawStatusIconInACell('retired').querySelector('svg')?.innerHTML;
    const disqualifiedShapes =
      drawStatusIconInACell('disqualified').querySelector('svg')?.innerHTML;

    // Assert: the same drawing; only the name differs.
    expect(retiredShapes, 'retired and disqualified must share one shape').toBe(disqualifiedShapes);
  });

  const noIconScenarios = [
    // Racing: nothing to say.
    { name: 'draws nothing for a running car', status: 'running' },
    // Not started yet: nothing to say either, and the row is not dimmed.
    { name: 'draws nothing for a car not started', status: 'notStarted' },
  ] as const;

  it.each(noIconScenarios)('$name', ({ status }) => {
    // Arrange: an empty status cell.

    // Act: draw the icon of this status into it.
    const cell = drawStatusIconInACell(status);

    // Assert: the lane stays empty.
    expect(cell.querySelector('svg'), 'a car with nothing to say must draw no icon').toBeNull();
  });
});
