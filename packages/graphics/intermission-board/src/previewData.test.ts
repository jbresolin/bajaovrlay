/**
 * What the intermission board's preview page loads (packages/graphics/intermission-board)
 *
 * What this module is for:
 *   preview.html shows the design's break before the enduro, 23:45 from "now", with the
 *   real top five and the 17 sponsors, each part switched off by the address (`?topFive=off`,
 *   `?sponsors=off`); `?data=<JSON>` replaces it with any data.
 *
 * What these tests prove:
 *   - The sample: the next session 23:45 from now, five teams, 17 sponsors.
 *   - Each switch takes its part off; `?nextStartsAtMs=` fixes the start; text that is not
 *     JSON gives the pt-BR problem.
 *
 * What these tests deliberately do not cover:
 *   - The page's buttons; the e2e tests drive the built preview.
 */
import { describe, expect, it } from 'vitest';

import type { IntermissionBoardData } from './intermissionBoardModel.js';
import { choosePreviewData } from './previewData.js';

/** 09:36:15 on Sunday 30 March 2025 in Brasília: "now" for these tests. */
const nowMs = Date.parse('2025-03-30T09:36:15.000-03:00');

/** The data a preview address gives. */
function readSampleOf(address: string): IntermissionBoardData | undefined {
  const choice = choosePreviewData(address, nowMs);
  return choice.isReadable ? (choice.data as IntermissionBoardData) : undefined;
}

describe('choosePreviewData', () => {
  it('gives the break before the enduro with its top five and its 17 sponsors', () => {
    // Arrange: an address with no query.

    // Act: choose the data.
    const data = readSampleOf('');

    // Assert: 10:00 start, five teams, seventeen sponsors.
    expect(data?.nextStartsAtMs, 'the start, 23:45 from now').toBe(
      Date.parse('2025-03-30T10:00:00.000-03:00'),
    );
    expect([data?.topFive?.length, data?.sponsors?.length], 'both parts').toEqual([5, 17]);
  });

  it('takes each part off with its switch', () => {
    // Arrange: the two switches.

    // Act: choose the data with each.
    const withoutTopFive = readSampleOf('?topFive=off');
    const withoutSponsors = readSampleOf('?sponsors=off');

    // Assert: the part left out.
    expect(withoutTopFive?.topFive, 'no top five').toBeUndefined();
    expect(withoutSponsors?.sponsors, 'no sponsors').toBeUndefined();
  });

  it('fixes the start with ?nextStartsAtMs=', () => {
    // Arrange: the enduro's start in the address.
    const enduroStartsAtMs = Date.parse('2025-03-30T10:00:00.000-03:00');

    // Act: choose the data an hour before it.
    const data = readSampleOf(`?nextStartsAtMs=${String(enduroStartsAtMs)}`);

    // Assert: the start as given.
    expect(data?.nextStartsAtMs, 'the start fixed by the address').toBe(enduroStartsAtMs);
  });

  it('says when ?data= is not JSON', () => {
    // Arrange: a broken text.

    // Act: choose the data.
    const choice = choosePreviewData('?data=%7Bquebrado', nowMs);

    // Assert: the pt-BR problem.
    expect(choice, 'a broken text says why').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
