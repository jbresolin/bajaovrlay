/**
 * Output monitors: "Prévia" and "Programa" (apps/control)
 *
 * What this module is for:
 *   Two small boxes on the control page let the operator see the two outputs without
 *   looking at OBS: "Programa" is what is on air, "Prévia" is what was put up to be looked
 *   at before it goes on air. Each is the renderer page in a frame. Only the page OBS
 *   loads may tell the server what is on air: if a box reported too, the layer panel would
 *   say "No ar" with OBS switched off, and a fault in a box alone would say "Falhou" while
 *   the stream is fine. So both boxes open the renderer page with `monitor=1` in the
 *   address, which is how that page knows it only draws and tells the server nothing; and
 *   the "Prévia" box adds `target=preview`, which is how the page knows to draw the
 *   preview output instead of the program output.
 *
 * What these tests prove:
 *   - The "Programa" box frames `/render/?monitor=1`.
 *   - The "Prévia" box frames `/render/?target=preview&monitor=1`.
 *   - Each box is labelled with its name, as a heading and as the frame's title.
 *
 * What these tests deliberately do not cover:
 *   - What the renderer page does with `monitor=1` and `target=preview` (connect without
 *     the renderer role, never report, draw one output only); the renderer's own tests
 *     prove that. Only those exact words in the address count there, which is why the
 *     addresses are checked here letter by letter.
 *   - That the layer panel stays "Carregando" with only these boxes open, and that a
 *     previewed item appears in "Prévia" and not in "Programa"; e2e/takeAndClear.e2e.ts
 *     and e2e/previewThenTake.e2e.ts prove those in a real browser.
 *   - What is drawn inside a frame, and the box's size; the frames are empty here.
 *   - The lines under "Prévia" with "Tomar" and "Descartar" (PreviewedLayersList.test.tsx).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OutputMonitor } from './OutputMonitor';

const monitorScenarios = [
  // What is on air. The address is the one OBS loads plus the monitor mark, and nothing
  // else: without `target` the renderer page draws the program output.
  {
    name: 'the program monitor frames the renderer page marked as a monitor',
    output: 'program' as const,
    title: 'Programa',
    expectedAddress: '/render/?monitor=1',
  },
  // What is being looked at before it goes on air. `target=preview` chooses the output;
  // `monitor=1` is there too, although a preview page never reports anyway, so that both
  // boxes are plainly marked as "for looking".
  {
    name: 'the preview monitor frames the renderer page of the preview output, marked as a monitor',
    output: 'preview' as const,
    title: 'Prévia',
    expectedAddress: '/render/?target=preview&monitor=1',
  },
];

describe('an output monitor', () => {
  it.each(monitorScenarios)('$name', ({ output, title, expectedAddress }) => {
    // Arrange: nothing to prepare; a monitor needs no data of its own.

    // Act: draw the monitor of this output.
    render(<OutputMonitor output={output} />);

    // Assert: the frame opens exactly the address of this row.
    expect(
      screen.getByTitle(title),
      `the "${title}" frame must open ${expectedAddress}: another address would draw the wrong output, or report "No ar" as if it were OBS`,
    ).toHaveAttribute('src', expectedAddress);
  });

  it.each(monitorScenarios)('$name, under its pt-BR heading', ({ output, title }) => {
    // Arrange: nothing to prepare; a monitor needs no data of its own.

    // Act: draw the monitor of this output.
    render(<OutputMonitor output={output} />);

    // Assert: the box has its heading, so the operator can tell the two boxes apart.
    expect(
      screen.getByRole('heading', { name: title }),
      `the monitor must be labelled "${title}"`,
    ).toBeInTheDocument();
  });
});
