/**
 * The two monitors stacked, at one size (apps/control)
 *
 * What this module is for:
 *   "Prévia" sits above "Programa" in the centre column (BAJAOVRLAY-59; side by side
 *   before that). Each is as wide as the column, at most 640 px (a third of the stream),
 *   always 16:9, with the renderer page inside still laid out at the stream's 1920x1080
 *   and scaled down to fit. The page measures its column and asks
 *   monitorWidthForColumnWidth.ts how wide each monitor is.
 *
 * What these tests prove:
 *   - Both monitor boxes are given the same width, the one the column allows: 640 px in
 *     the 640 px column of a 1920 px window, 480 px in a 480 px column.
 *   - The frame inside each box stays 1920x1080 and is scaled by box width / 1920.
 *   - "Prévia" comes first in the page, which puts it on top.
 *
 * What these tests deliberately do not cover:
 *   - Real layout. These tests run in jsdom, a browser stand-in that draws nothing, so
 *     the test itself says how wide the column "is". That the boxes really end up stacked,
 *     equal, 16:9 and inside a 1920x1080 screen is proven in a real browser by
 *     e2e/consoleLayout.e2e.ts.
 *   - The width rule row by row: monitorWidthForColumnWidth.test.ts.
 *   - The lines under "Prévia": PreviewedLayersList.test.tsx.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { PreviewAndProgramMonitors } from './PreviewAndProgramMonitors';

/**
 * Makes every element of the page measure this wide. jsdom has no layout and answers 0
 * for every width; the only element the page measures here is the column of the monitors.
 */
function makeTheCentreColumnMeasure(widthInPixels: number) {
  const measuredWidth = vi
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockReturnValue(widthInPixels);
  return {
    /** Gives elements their own (zero) width back, for the tests that follow. */
    stopFakingTheWidth: () => measuredWidth.mockRestore(),
  };
}

/** Reads the width and the scale the page gave one monitor, by the title of its frame. */
function readSizeGivenToMonitor(monitorTitle: 'Prévia' | 'Programa') {
  const frame = screen.getByTitle(monitorTitle);
  const boxAroundTheFrame = frame.parentElement;
  return {
    boxWidth: boxAroundTheFrame?.style.width,
    frameScale: frame.style.transform,
    frameLayoutSize: `${frame.getAttribute('width')}x${frame.getAttribute('height')}`,
  };
}

describe('the two stacked monitors of the centre column', () => {
  const columnWidthScenarios = [
    // A 1920 px wide window: the column is 640 px and each monitor a third of the stream.
    {
      name: 'are both 640 px wide, and the frames a third, in the 640 px column of a 1920 px window',
      columnWidthInPixels: 640,
      expectedSize: {
        boxWidth: '640px',
        frameScale: `scale(${String(640 / 1920)})`,
        frameLayoutSize: '1920x1080',
      },
    },
    // A narrower column of 480 px: a quarter of the stream, a round scale to read.
    {
      name: 'both shrink to 480 px, and the frames to a quarter, in a 480 px column',
      columnWidthInPixels: 480,
      expectedSize: { boxWidth: '480px', frameScale: 'scale(0.25)', frameLayoutSize: '1920x1080' },
    },
  ];

  it.each(columnWidthScenarios)('$name', ({ columnWidthInPixels, expectedSize }) => {
    // Arrange: a centre column of the width of this row.
    const centreColumn = makeTheCentreColumnMeasure(columnWidthInPixels);

    // Act: draw the two monitors on a connected page.
    renderOnControlPageConnectedToFakeServer(
      <PreviewAndProgramMonitors />,
      buildSlicesWithNothingOnAir(),
    );
    const sizeOfPreview = readSizeGivenToMonitor('Prévia');
    const sizeOfProgram = readSizeGivenToMonitor('Programa');
    centreColumn.stopFakingTheWidth();

    // Assert: both monitors got the size of this row, so they are equal; the frame
    // inside is still the stream's 1920x1080, only scaled.
    expect(sizeOfPreview, '"Prévia" must be drawn at the size the column allows').toEqual(
      expectedSize,
    );
    expect(sizeOfProgram, '"Programa" must be drawn at exactly the size of "Prévia"').toEqual(
      sizeOfPreview,
    );
  });

  it('puts "Prévia" before "Programa", which draws it on top', () => {
    // Arrange: a centre column wide enough for both monitors.
    const centreColumn = makeTheCentreColumnMeasure(640);

    // Act: draw the two monitors.
    renderOnControlPageConnectedToFakeServer(
      <PreviewAndProgramMonitors />,
      buildSlicesWithNothingOnAir(),
    );
    centreColumn.stopFakingTheWidth();

    // Assert: `getAllByTitle` answers in the order of the page.
    const frameTitlesInPageOrder = screen
      .getAllByTitle(/^(Prévia|Programa)$/)
      .map((frame) => frame.getAttribute('title'));
    expect(
      frameTitlesInPageOrder,
      'the operator reads top to bottom: look at it first, then it is on air',
    ).toEqual(['Prévia', 'Programa']);
  });
});
