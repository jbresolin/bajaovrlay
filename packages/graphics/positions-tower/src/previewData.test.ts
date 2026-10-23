/**
 * Data for the preview page (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   preview.html shows the positions tower on its own, for designers, for the
 *   screenshot tests and later for the control page. It takes its data from
 *   `?data=<JSON>` in the address, or shows the enduro sample when there is none, and
 *   its buttons change the list (two cars trading places) before sending it again.
 *
 * What these tests prove:
 *   - Without `?data=`, the sample is the shared package's 60-car enduro, compact, pages
 *     cycling, with car 31 leading.
 *   - With `?data=`, the JSON in the address is used exactly as written.
 *   - JSON that cannot be read gives a pt-BR problem to show, not an exception.
 *   - Trading two cars' places rewrites their positions and leaves the list given alone.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid tower data; the graphic's own `load` decides that
 *     (positionsTowerModel.test.ts), so the preview shows the same answer a renderer gets.
 */
import { describe, expect, it } from 'vitest';

import {
  choosePreviewData,
  createEnduroSampleTowerData,
  swapCarsAtPositions,
} from './previewData.js';

describe('choosePreviewData', () => {
  it('uses the 60-car enduro sample, compact and cycling, when the address has no data', () => {
    // Arrange: the address of the preview page with no query at all.
    const addressQuery = '';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the sample, with car 31 "Acauã Baja" leading a field of 60.
    expect(choice.isReadable, 'the sample must be readable').toBe(true);
    const data = createEnduroSampleTowerData();
    expect(data.entries, 'the sample holds the whole field').toHaveLength(60);
    expect(data.entries[0]?.teamName, 'Acauã Baja leads the sample').toBe('Acauã Baja');
    expect({ layout: data.layout, paging: data.paging }, 'compact and cycling').toEqual({
      layout: 'compact',
      paging: 'cycle',
    });
  });

  it('uses the JSON in ?data= exactly as written', () => {
    // Arrange: an address carrying a three-car detailed tower.
    const dataInTheAddress = {
      entries: [
        {
          position: 1,
          carNumber: 42,
          teamName: 'Baja UFPR',
          schoolName: 'UFPR',
          laps: 3,
          status: 'running',
        },
      ],
      layout: 'detailed',
    };
    const addressQuery = `?data=${encodeURIComponent(JSON.stringify(dataInTheAddress))}`;

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the very same object comes back.
    expect(choice, 'the address data must be used as written').toEqual({
      isReadable: true,
      data: dataInTheAddress,
    });
  });

  it('answers a pt-BR problem, not an exception, when ?data= is not JSON', () => {
    // Arrange: an address whose data was pasted half way.
    const addressQuery = '?data=%7B%22entries%22%3A%5B';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: unreadable, with the catalog's sentence.
    expect(choice, 'bad JSON must give a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});

describe('swapCarsAtPositions', () => {
  it('trades the places of the 3rd and 4th cars and rewrites their positions', () => {
    // Arrange: the sample's entries; car 25 is 3rd and car 78 is 4th.
    const entries = createEnduroSampleTowerData().entries;

    // Act: trade their places.
    const swapped = swapCarsAtPositions(entries, 3, 4);

    // Assert: 78 is now 3rd and 25 is 4th, each with its new position; the original
    // list is untouched.
    expect(
      swapped.slice(2, 4).map((entry) => [entry.position, entry.carNumber]),
      'the two cars must trade places with their positions rewritten',
    ).toEqual([
      [3, 78],
      [4, 25],
    ]);
    expect(entries[2]?.carNumber, 'the list given must not be changed').toBe(25);
  });
});
