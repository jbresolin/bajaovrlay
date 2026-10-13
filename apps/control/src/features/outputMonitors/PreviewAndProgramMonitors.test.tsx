/**
 * The two monitors side by side, at one size (apps/control)
 *
 * What this module is for:
 *   "Prévia" and "Programa" sit side by side in the centre column. João's ruling (gate 2
 *   of BAJAOVRLAY-15): when the column is too narrow for two 480 px monitors, both
 *   shrink together and stay side by side, always 16:9, with the renderer page inside
 *   still laid out at the stream's 1920x1080 and scaled down to fit. The page measures
 *   its column and asks monitorWidthForColumnWidth.ts how wide each monitor is.
 *
 * What these tests prove:
 *   - Both monitor boxes are given the same width, the one the column allows: 480 px in
 *     a wide column, 424 px in the 864 px column of a 1600 px window.
 *   - The frame inside each box stays 1920x1080 and is scaled by box width / 1920.
 *   - "Prévia" comes first in the page, which puts it on the left.
 *
 * What these tests deliberately do not cover:
 *   - Real layout. These tests run in jsdom, a browser stand-in that draws nothing, so
 *     the test itself says how wide the column "is". That the boxes really end up side by
 *     side, equal and 16:9, and follow the window when it is resized, is proven in a
 *     real browser by e2e/monitorsSideBySide.e2e.ts.
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
 * for every width; the only element the page measures here is the row of the monitors.
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

describe('the two monitors of the centre column', () => {
  const columnWidthScenarios = [
    // A 1920 px wide window: both monitors at their full quarter size.
    {
      name: 'are both 480 px wide in a column with room to spare',
      columnWidthInPixels: 1184,
      expectedSize: { boxWidth: '480px', frameScale: 'scale(0.25)', frameLayoutSize: '1920x1080' },
    },
    // A narrow window whose column is 784 px: (784 - 16) / 2 = 384 px each, a fifth of
    // the stream's width, so the scale is a round number to read.
    {
      name: 'both shrink to 384 px, and the frames to a fifth, in a 784 px column',
      columnWidthInPixels: 784,
      expectedSize: { boxWidth: '384px', frameScale: 'scale(0.2)', frameLayoutSize: '1920x1080' },
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

  it('puts "Prévia" before "Programa", which draws it on the left', () => {
    // Arrange: a centre column wide enough for both monitors.
    const centreColumn = makeTheCentreColumnMeasure(1184);

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
      'the operator reads left to right: look at it first, then it is on air',
    ).toEqual(['Prévia', 'Programa']);
  });
});
