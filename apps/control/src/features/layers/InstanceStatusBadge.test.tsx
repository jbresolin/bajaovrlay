/**
 * Instance status badge (apps/control)
 *
 * What this module is for:
 *   Each row of the layer panel ends in a small coloured word saying how the graphic on
 *   that layer is doing. The server sets it to "loading" at the take, and the renderer
 *   (the page OBS shows) then reports what really happened: the graphic is on screen, or
 *   it failed. The colour lets the operator see a failure without reading every row.
 *
 * What these tests prove:
 *   - Each status shows its pt-BR word in its colour: "No ar" in the success (green)
 *     colour, "Carregando" in the muted (grey) colour, "Falhou" in the destructive (red)
 *     colour. The two statuses nothing sets yet keep a plain outline.
 *   - A failed graphic explains itself: the renderer's detail is in a tooltip on the
 *     badge, reachable with the mouse and with the Tab key.
 *   - A failure the renderer gave no detail for still has a tooltip, saying so.
 *   - A status that is not a failure has no tooltip.
 *
 * What these tests deliberately do not cover:
 *   - The colours themselves. The tests check which semantic colour token the badge
 *     uses (`bg-success`, `bg-secondary`, `bg-destructive`); the token values are in
 *     index.css and are checked by eye in the browser.
 *   - Where the status and its detail come from; LayerStatusPanel.test.tsx draws the
 *     whole panel from the server's slices.
 *   - The language of the detail: it is the renderer's own error text, shown as received.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstanceStatusBadge } from './InstanceStatusBadge';

/**
 * Makes the badge show its tooltip, as it does when the operator rests the mouse on it
 * or reaches it with the Tab key. The badge sits in a small focusable area, and that
 * area is what gets focus.
 */
function focusAreaAroundBadge(badgeWord: string): void {
  const focusableAreaAroundTheBadge = screen.getByText(badgeWord).parentElement;
  if (focusableAreaAroundTheBadge === null) {
    throw new Error(`the badge "${badgeWord}" is not on the page`);
  }
  fireEvent.focus(focusableAreaAroundTheBadge);
}

describe('the instance status badge', () => {
  const statusesAndHowTheyLook = [
    // What the renderer reports once the graphic's entrance has finished: green.
    {
      name: 'shows "No ar" in the success colour for a graphic the renderer says is on air',
      status: 'on-air',
      expectedWord: 'No ar',
      expectedColourClass: 'bg-success',
    },
    // What the server sets at the take, before the renderer has reported anything: grey.
    {
      name: 'shows "Carregando" in the muted colour for a graphic not acknowledged yet',
      status: 'loading',
      expectedWord: 'Carregando',
      expectedColourClass: 'bg-secondary',
    },
    // What the renderer reports when the graphic could not be loaded or played: red.
    {
      name: 'shows "Falhou" in the destructive colour for a graphic that failed',
      status: 'failed',
      expectedWord: 'Falhou',
      expectedColourClass: 'bg-destructive',
    },
  ] as const;

  it.each(statusesAndHowTheyLook)('$name', ({ status, expectedWord, expectedColourClass }) => {
    // Arrange: nothing to prepare.

    // Act: draw the badge for an instance in that status.
    render(<InstanceStatusBadge status={status} statusDetail={undefined} />);

    // Assert: the word is the catalog's, and the badge uses that status's colour token.
    expect(
      screen.getByText(expectedWord),
      `the "${status}" status must read "${expectedWord}" in its own semantic colour`,
    ).toHaveClass(expectedColourClass);
  });

  const statusesNothingSetsYet = [
    // Reserved for a graphic loaded on preview and waiting; no command produces it yet.
    { name: 'shows "Pronto" with a plain outline', status: 'ready', expectedWord: 'Pronto' },
    // Reserved for a graphic animating out; clears remove instances at once for now.
    { name: 'shows "Saindo" with a plain outline', status: 'stopping', expectedWord: 'Saindo' },
  ] as const;

  it.each(statusesNothingSetsYet)('$name', ({ status, expectedWord }) => {
    // Arrange: nothing to prepare.

    // Act: draw the badge for an instance in that status.
    render(<InstanceStatusBadge status={status} statusDetail={undefined} />);

    // Assert: the word is shown, and none of the three meaningful colours is used.
    const badge = screen.getByText(expectedWord);
    expect(badge, `"${expectedWord}" must not look like "No ar"`).not.toHaveClass('bg-success');
    expect(badge, `"${expectedWord}" must not look like "Carregando"`).not.toHaveClass(
      'bg-secondary',
    );
    expect(badge, `"${expectedWord}" must not look like "Falhou"`).not.toHaveClass(
      'bg-destructive',
    );
  });

  it("shows the renderer's detail in a tooltip on a failed graphic", async () => {
    // Arrange: a race clock whose package could not be loaded by the renderer page.
    render(
      <InstanceStatusBadge
        status="failed"
        statusDetail="Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js"
      />,
    );

    // Act: the operator rests on the red badge.
    focusAreaAroundBadge('Falhou');

    // Assert: the tooltip carries the detail exactly as the renderer reported it.
    expect(
      await screen.findByRole('tooltip'),
      'the tooltip must tell the operator why the graphic failed',
    ).toHaveTextContent(
      'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js',
    );
  });

  it('says in the tooltip that no reason was given when a failure has no detail', async () => {
    // Arrange: a failed graphic for which the renderer reported no detail.
    render(<InstanceStatusBadge status="failed" statusDetail={undefined} />);

    // Act: the operator rests on the red badge.
    focusAreaAroundBadge('Falhou');

    // Assert: the tooltip is still there and says, in pt-BR, that the reason is unknown.
    expect(
      await screen.findByRole('tooltip'),
      'a failure with no detail must still explain itself as far as it can',
    ).toHaveTextContent('O renderizador não informou o motivo da falha.');
  });

  it('has no tooltip on a graphic that is on air', () => {
    // Arrange: a race clock the renderer says is on air.
    render(<InstanceStatusBadge status="on-air" statusDetail={undefined} />);

    // Act: the operator rests on the green badge, the same way as on a red one.
    fireEvent.focus(screen.getByText('No ar'));

    // Assert: nothing pops up; there is nothing to explain.
    expect(screen.queryByRole('tooltip'), 'a healthy status must not show a tooltip').toBeNull();
  });
});
