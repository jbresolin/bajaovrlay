/**
 * Data for the preview page (packages/graphics/notice)
 *
 * What this module is for:
 *   preview.html shows the notice on its own, for designers, for the screenshot tests and
 *   later for the control page. It takes its data from `?data=<JSON>` in the address, or
 *   shows the fastest lap sample when there is none; its variant buttons send the
 *   fastest lap or the penalty sample.
 *
 * What these tests prove:
 *   - Without `?data=`, the preview shows the design's fastest lap: car 31, Acauã Baja
 *     (Mauá), 4:38,2 on lap 34.
 *   - The penalty sample is the design's: car 47, Carnaúba Baja (UFERSA), a jump start
 *     for +30 segundos.
 *   - With `?data=`, the JSON in the address is used exactly as written.
 *   - JSON that cannot be read gives a pt-BR problem to show, not an exception.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid notice data; the graphic's own `load` decides that
 *     (noticeModel.test.ts), so the preview shows the same answer a renderer gets.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData, createPenaltySample } from './previewData.js';

describe('choosePreviewData', () => {
  it('uses the design’s fastest lap when the address has no data', () => {
    // Arrange: the address of the preview page with no query at all.
    const addressQuery = '';

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: the fastest lap sample.
    expect(choice, 'with no ?data= the preview must show the fastest lap sample').toEqual({
      isReadable: true,
      data: {
        variant: 'fastestLap',
        carNumber: 31,
        teamName: 'Acauã Baja',
        schoolName: 'Mauá',
        lapNumber: 34,
        lapTimeText: '4:38,2',
      },
    });
  });

  it('uses the JSON from ?data= exactly as written', () => {
    // Arrange: an incident with no penalty yet, encoded into the address as the tests do.
    const incidentData = { variant: 'penalty', carNumber: 12, noticeKind: 'incident' };
    const addressQuery = `?data=${encodeURIComponent(JSON.stringify(incidentData))}`;

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: the data is the address JSON, untouched.
    expect(choice, 'the ?data= JSON must be used exactly as written').toEqual({
      isReadable: true,
      data: incidentData,
    });
  });

  it('gives a pt-BR problem instead of throwing when ?data= is not JSON', () => {
    // Arrange: an address whose data was cut off while being copied.
    const addressQuery = '?data=%7B%22variant%22%3A%22pen';

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: a pt-BR problem the page can show.
    expect(choice, 'unreadable ?data= must produce a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});

describe('createPenaltySample', () => {
  it('is the design’s penalty: car 47, a jump start, +30 segundos', () => {
    // Arrange: nothing to set up; the sample is built fresh.

    // Act: build the sample the "penalidade" button sends.
    const penaltySample = createPenaltySample();

    // Assert: every field of the design's penalty notice.
    expect(penaltySample, 'the penalty sample must be the design’s').toEqual({
      variant: 'penalty',
      carNumber: 47,
      teamName: 'Carnaúba Baja',
      schoolName: 'UFERSA',
      noticeKind: 'penalty',
      reason: 'Queima de largada',
      penaltyText: '+30 segundos',
    });
  });
});
