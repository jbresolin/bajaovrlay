/**
 * The lower strip with the laps, the gap to the leader and no flag
 * (packages/graphics/lower-strip, BAJAOVRLAY-81)
 *
 * What this module is for:
 *   An item of the strip may ask each car to show its laps ("Mostrar as voltas") and its
 *   gap to the leader ("Diferença para o líder": não mostrar, só voltas, voltas e tempo,
 *   só tempo), read from the same positions list the strip already receives. With more in
 *   each pill, fewer cars fit a page, so the pages get shorter. The flag ("Bandeira") is
 *   optional: with none, the clock block shows its time without the flag pill.
 *
 * What these tests prove:
 *   - With the laps on, page 1 holds four cars, each showing its laps, and the page cell
 *     reads "1/9"; the pill's accessible name says the laps too.
 *   - With the laps and the gap in laps, page 1 holds three cars, the leader without a
 *     gap and the others "+1 volta", "+2 voltas"; the page cell reads "1/12".
 *   - Switching the gap on while on air redraws the page in place, on the same pills, with
 *     the shorter page, and switching it back to "Não mostrar" gives the six-car page.
 *   - Data with neither choice draws exactly the pills of before: no laps or gap cell.
 *   - A list with a bad gap (0 laps behind, or a fractional time) is still taken on air:
 *     the running order changes and only that car's gap cell stays blank.
 *   - With no flag the clock block's pill is hidden and the time still shows.
 *
 * What these tests deliberately do not cover:
 *   - The words for every gap case; stripCarTexts.test.ts.
 *   - Whether the pages fit the bar; e2e/lowerStripFitsTheBar.e2e.ts measures them.
 */
import { describe, expect, it } from 'vitest';

import {
  createLowerStripOnThePage,
  createRealEnduroStripData,
  findPartOfLowerStrip,
  loadLowerStripWithData,
  readCarPillsOnAir,
  readPageCell,
} from './lowerStripOnThePage.testSupport.js';

describe('the laps and the gap in each pill', () => {
  it('shows four cars a page with their laps, "1/9", and names the laps for assistive technology', async () => {
    // Arrange: a strip on the page and the real enduro with "Mostrar as voltas" on.
    const lowerStrip = createLowerStripOnThePage();
    const data = { ...createRealEnduroStripData(), showLaps: true };

    // Act: load it and put it on air.
    await loadLowerStripWithData(lowerStrip, data);
    await lowerStrip.playAction({ skipAnimation: true });

    // Assert: four cars with their laps, nine pages, and the laps in the pill's name.
    expect(readCarPillsOnAir(lowerStrip), 'page 1 with the laps').toEqual([
      '1º 51 FAHOR 43 voltas',
      '2º 10 UFSJ 42 voltas',
      '3º 47 UTFPR-PB 41 voltas',
      '4º 1 FEI 40 voltas',
    ]);
    expect(readPageCell(lowerStrip), '34 cars, four a page').toBe('1/9');
    expect(
      findPartOfLowerStrip(lowerStrip, 'lower-strip-car')?.getAttribute('aria-label'),
      'the leader’s pill names its laps',
    ).toBe('1º, carro 51, FAHOR, 43 voltas');
  });

  it('shows three cars a page with laps and gap, the leader without a gap, "1/12"', async () => {
    // Arrange: the real enduro with the laps on and the gap shown in laps.
    const lowerStrip = createLowerStripOnThePage();
    const data = { ...createRealEnduroStripData(), showLaps: true, gapDisplay: 'laps' };

    // Act: load it and put it on air.
    await loadLowerStripWithData(lowerStrip, data);
    await lowerStrip.playAction({ skipAnimation: true });

    // Assert: three cars, the leader with no gap, the others their laps behind.
    expect(readCarPillsOnAir(lowerStrip), 'page 1 with laps and gap').toEqual([
      '1º 51 FAHOR 43 voltas',
      '2º 10 UFSJ 42 voltas +1 volta',
      '3º 47 UTFPR-PB 41 voltas +2 voltas',
    ]);
    expect(readPageCell(lowerStrip), '34 cars, three a page').toBe('1/12');
  });

  it('redraws the page in place when the gap is switched on air, and back', async () => {
    // Arrange: the everyday strip on air, six cars on page 1, and its leader's pill.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });
    const leaderPillBefore = findPartOfLowerStrip(lowerStrip, 'lower-strip-car');

    // Act: the operator picks "Só voltas" on air, then "Não mostrar" again.
    await lowerStrip.updateAction({ data: { gapDisplay: 'laps' } });
    const pillsWithTheGap = readCarPillsOnAir(lowerStrip);
    const pageCellWithTheGap = readPageCell(lowerStrip);
    const leaderPillWithTheGap = findPartOfLowerStrip(lowerStrip, 'lower-strip-car');
    await lowerStrip.updateAction({ data: { gapDisplay: 'none' } });

    // Assert: four cars with their gaps on the same pills, then the six-car page again.
    expect(pillsWithTheGap, 'four cars with their gap').toEqual([
      '1º 51 FAHOR',
      '2º 10 UFSJ +1 volta',
      '3º 47 UTFPR-PB +2 voltas',
      '4º 1 FEI +3 voltas',
    ]);
    expect(pageCellWithTheGap, 'the pages got shorter').toBe('1/9');
    expect(leaderPillWithTheGap, 'the pills are rewritten in place').toBe(leaderPillBefore);
    expect(readCarPillsOnAir(lowerStrip), 'back to the six-car page').toHaveLength(6);
    expect(readPageCell(lowerStrip), 'back to six pages').toBe('1/6');
  });

  it('draws no laps or gap cell for data that asks for neither, as every strip before', async () => {
    // Arrange: the everyday strip, whose cars do carry laps and gaps from the positions.
    const lowerStrip = createLowerStripOnThePage();

    // Act: load it.
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());

    // Assert: the laps and gap cells of the 2nd car are hidden and empty.
    const secondPill = readCarPillsOnAir(lowerStrip)[1];
    const lapsCells = lowerStrip.shadowRoot?.querySelectorAll<HTMLElement>(
      '[data-testid="lower-strip-car-laps"]',
    );
    const gapCells = lowerStrip.shadowRoot?.querySelectorAll<HTMLElement>(
      '[data-testid="lower-strip-car-gap"]',
    );
    expect(secondPill, 'the pill reads as before').toBe('2º 10 UFSJ');
    expect(
      [...(lapsCells ?? []), ...(gapCells ?? [])].every((cell) => cell.hidden),
      'every laps and gap cell is hidden',
    ).toBe(true);
  });
});

describe('a list with a bad laps or gap value', () => {
  it('still updates the order on air, and leaves only the bad cells blank', async () => {
    // Arrange: the strip on air with the gap shown in laps and time.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, {
      ...createRealEnduroStripData(),
      gapDisplay: 'lapsAndTime',
    });
    await lowerStrip.playAction({ skipAnimation: true });

    // Act: the source sends a new order whose 2nd car says "0 laps behind" and whose 3rd
    // has a fractional time gap, values the positions shape would never send.
    const answer = await lowerStrip.updateAction({
      data: {
        entries: [
          { position: 1, carNumber: 10, schoolName: 'UFSJ', laps: 6 },
          { position: 2, carNumber: 51, schoolName: 'FAHOR', laps: 6, gapToLeaderLaps: 0 },
          { position: 3, carNumber: 47, schoolName: 'UTFPR-PB', laps: 6, gapToLeaderMs: 1500.5 },
          { position: 4, carNumber: 1, schoolName: 'FEI', laps: 5, gapToLeaderLaps: 1 },
        ],
      },
    });

    // Assert: accepted, the new order on air, the two bad gaps blank, the good one shown.
    expect(answer, 'a bad gap must not refuse the whole update').toEqual({ statusCode: 200 });
    expect(readCarPillsOnAir(lowerStrip), 'the new order, the bad gaps left blank').toEqual([
      '1º 10 UFSJ',
      '2º 51 FAHOR',
      '3º 47 UTFPR-PB',
      '4º 1 FEI +1 volta',
    ]);
  });
});

describe('the strip with no flag', () => {
  it('hides the clock block’s flag pill and still shows the time', async () => {
    // Arrange: the real enduro with "Bandeira" cleared, so no flag is sent.
    const lowerStrip = createLowerStripOnThePage();
    const { state: flagLeftOut, ...dataWithoutFlag } = createRealEnduroStripData();

    // Act: load it.
    const answer = await loadLowerStripWithData(lowerStrip, dataWithoutFlag);

    // Assert: loaded, the time shown, the pill hidden, the cars as usual.
    expect(flagLeftOut, 'the data we started from had a flag').toBe('green');
    expect(answer, 'data without a flag must load').toEqual({ statusCode: 200 });
    expect(findPartOfLowerStrip(lowerStrip, 'clock-block-time')?.textContent, 'the time').toBe(
      '1:00:00',
    );
    expect(
      findPartOfLowerStrip(lowerStrip, 'clock-block-flag')?.hidden,
      'with no flag the pill must be hidden',
    ).toBe(true);
    expect(readCarPillsOnAir(lowerStrip), 'six cars as usual').toHaveLength(6);
  });
});
