/**
 * Program monitor (apps/control)
 *
 * What this module is for:
 *   The small "Programa" box on the control page lets the operator see what is on air
 *   without looking at OBS. It is the renderer page in a frame. Only the program output
 *   (the renderer page OBS loads) may tell the server what is on air: if this box
 *   reported too, the layer panel would say "No ar" with OBS switched off, and a fault
 *   in this box alone would say "Falhou" while the stream is fine. So the box opens the
 *   renderer page with `monitor=1` in its address, which is how that page knows it is
 *   only a monitor: it draws, and tells the server nothing.
 *
 * What these tests prove:
 *   - The frame's address is `/render/?monitor=1`: the renderer page, marked as a monitor.
 *   - The box is labelled "Programa", as a heading and as the frame's title.
 *
 * What these tests deliberately do not cover:
 *   - What the renderer page does with `monitor=1` (connect without the renderer role,
 *     never report); the renderer's own tests prove that.
 *   - That the layer panel stays "Carregando" with only this box open, and says "No ar"
 *     once OBS is there; e2e/takeAndClear.e2e.ts proves that in a real browser.
 *   - What is drawn inside the frame, and the box's size; the frame is empty here.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgramMonitor } from './ProgramMonitor';

describe('the program monitor', () => {
  it('frames the renderer page marked as a monitor, so it never reports what is on air', () => {
    // Arrange: nothing to prepare; the monitor needs no data of its own.

    // Act: draw the program monitor.
    render(<ProgramMonitor />);

    // Assert: the frame opens the renderer page with monitor=1 in the address.
    expect(
      screen.getByTitle('Programa'),
      'the frame must open /render/?monitor=1: without monitor=1 this box would report "No ar" as if it were OBS',
    ).toHaveAttribute('src', '/render/?monitor=1');
  });

  it('is labelled "Programa"', () => {
    // Arrange: nothing to prepare; the monitor needs no data of its own.

    // Act: draw the program monitor.
    render(<ProgramMonitor />);

    // Assert: the box has its pt-BR heading.
    expect(
      screen.getByRole('heading', { name: 'Programa' }),
      'the program monitor must be labelled "Programa"',
    ).toBeInTheDocument();
  });
});
