/**
 * Data and stage for the preview page (packages/graphics/lower-third)
 *
 * What this module is for:
 *   preview.html shows the lower third on its own, for designers, for the screenshot
 *   tests and later for the control page. It takes its data from `?data=<JSON>` in the
 *   address, or shows the team captain sample when there is none, and paints the stage
 *   grey or black when `?stage=` asks for one of the design's screenshot backgrounds.
 *
 * What these tests prove:
 *   - Without `?data=`, the preview shows the design's lower third: Mariana Costa,
 *     Capitã da equipe, Baja UFMG · UFMG.
 *   - The name-only sample names the role and the team line as undefined, so the button
 *     that sends it clears them on air (the renderer's way of clearing a field).
 *   - With `?data=`, the JSON in the address is used exactly as written; JSON that cannot
 *     be read gives a pt-BR problem to show, not an exception.
 *   - `?stage=grey` and `?stage=black` choose those stages; no stage, or one the preview
 *     does not know, keeps the footage stand-in.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid lower third data; the graphic's own `load` decides that
 *     (lowerThirdModel.test.ts), so the preview shows the same answer a renderer gets.
 *   - The stage's colours, which live in preview.html; the screenshots pin them.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData, createNameOnlySample } from './previewData.js';

describe('choosePreviewData', () => {
  it('uses the design’s team captain when the address has no data', () => {
    // Arrange: the address of the preview page with no query at all.
    const addressQuery = '';

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: the team captain sample.
    expect(choice, 'with no ?data= the preview must show the team captain sample').toEqual({
      isReadable: true,
      data: { name: 'Mariana Costa', role: 'Capitã da equipe', teamLine: 'Baja UFMG · UFMG' },
    });
  });

  it('uses the JSON from ?data= exactly as written', () => {
    // Arrange: a narrator, encoded into the address as the tests do.
    const narratorData = { name: 'Ana Paula Ribeiro', role: 'Narradora' };
    const addressQuery = `?data=${encodeURIComponent(JSON.stringify(narratorData))}`;

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: the data is the address JSON, untouched.
    expect(choice, 'the ?data= JSON must be used exactly as written').toEqual({
      isReadable: true,
      data: narratorData,
    });
  });

  it('gives a pt-BR problem instead of throwing when ?data= is not JSON', () => {
    // Arrange: an address whose data was cut off while being copied.
    const addressQuery = '?data=%7B%22name%22%3A%22Ana';

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: a pt-BR problem the page can show.
    expect(choice, 'unreadable ?data= must produce a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});

describe('createNameOnlySample', () => {
  it('names the role and the team line as undefined, so sending it clears them', () => {
    // Arrange: nothing to set up; the sample is built fresh.

    // Act: build the sample the "só o nome" button sends.
    const nameOnlySample = createNameOnlySample();

    // Assert: the name, and the two optional keys present but empty.
    expect(Object.keys(nameOnlySample), 'both optional keys must be named').toEqual([
      'name',
      'role',
      'teamLine',
    ]);
    expect(
      [nameOnlySample.role, nameOnlySample.teamLine],
      'the role and the team line must be undefined, the renderer’s way of clearing them',
    ).toEqual([undefined, undefined]);
  });
});
