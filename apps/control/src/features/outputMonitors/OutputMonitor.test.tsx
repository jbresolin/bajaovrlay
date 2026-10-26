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
 *   - The box is as wide as it is told to be, and the frame inside stays the stream's
 *     1920x1080, scaled by that width / 1920 (a quarter at 480 px, a fifth at 384 px).
 *
 * What these tests deliberately do not cover:
 *   - What the renderer page does with `monitor=1` and `target=preview` (connect without
 *     the renderer role, never report, draw one output only); the renderer's own tests
 *     prove that. Only those exact words in the address count there, which is why the
 *     addresses are checked here letter by letter.
 *   - That the layer panel stays "Carregando" with only these boxes open, and that a
 *     previewed item appears in "Prévia" and not in "Programa"; e2e/takeAndClear.e2e.ts
 *     and e2e/previewThenTake.e2e.ts prove those in a real browser.
 *   - What is drawn inside a frame, and how wide the box SHOULD be in a given window
 *     (monitorWidthForColumnWidth.test.ts); the frames are empty here. That the box is
 *     16:9 on screen needs a real browser: e2e/monitorsSideBySide.e2e.ts.
 *   - The lines under "Prévia" with "Tomar" and "Descartar" (PreviewedLayersList.test.tsx).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OutputMonitor } from './OutputMonitor';

/** The one output of a show without a PiP: these tests are about program's frame. */
const programOutput = { outputId: 'program', name: 'Programa', order: 0 };

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
    render(<OutputMonitor output={output} widthInPixels={480} outputs={[programOutput]} />);

    // Assert: the frame opens exactly the address of this row.
    expect(
      screen.getByTitle(title),
      `the "${title}" frame must open ${expectedAddress}: another address would draw the wrong output, or report "No ar" as if it were OBS`,
    ).toHaveAttribute('src', expectedAddress);
  });

  it.each(monitorScenarios)('$name, under its pt-BR heading', ({ output, title }) => {
    // Arrange: nothing to prepare; a monitor needs no data of its own.

    // Act: draw the monitor of this output.
    render(<OutputMonitor output={output} widthInPixels={480} outputs={[programOutput]} />);

    // Assert: the box has its heading, so the operator can tell the two boxes apart.
    expect(
      screen.getByRole('heading', { name: title }),
      `the monitor must be labelled "${title}"`,
    ).toBeInTheDocument();
  });
});

describe('the size of an output monitor', () => {
  const monitorSizeScenarios = [
    // The full size: a quarter of the stream's 1920 px.
    { name: 'is 480 px wide with its frame at a quarter', widthInPixels: 480, scale: 0.25 },
    // A narrower window: the same frame, scaled further down.
    { name: 'is 384 px wide with its frame at a fifth', widthInPixels: 384, scale: 0.2 },
  ];

  it.each(monitorSizeScenarios)('$name', ({ widthInPixels, scale }) => {
    // Arrange: nothing to prepare; the width is all a monitor is told.

    // Act: draw the program monitor at the width of this row.
    render(
      <OutputMonitor output="program" widthInPixels={widthInPixels} outputs={[programOutput]} />,
    );

    // Assert: the box around the frame has that width, and the frame is still laid out
    // at the stream's size, so the graphics inside are drawn as OBS draws them.
    const frame = screen.getByTitle('Programa');
    expect(frame.parentElement, 'the box must be as wide as it was told').toHaveStyle({
      width: `${widthInPixels}px`,
    });
    expect(
      [frame.getAttribute('width'), frame.getAttribute('height')],
      'the framed page must stay laid out at 1920x1080',
    ).toEqual(['1920', '1080']);
    expect(frame, 'the frame must be scaled to fit the box exactly').toHaveStyle({
      transform: `scale(${scale})`,
    });
  });
});
