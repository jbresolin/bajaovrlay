/**
 * Positions tower texts and status icons, in the preview page
 * (packages/graphics/positions-tower, Playwright)
 *
 * What this module is for:
 *   What a row says, beyond its order: the status icon of a car in the pit, broken down
 *   or out of the race (and the dimmed pill of the last two), a long team name clipped
 *   inside its column (it scrolls there on air, BAJAOVRLAY-55) at the same row height as
 *   the others, the empty mark
 *   for a value the source does not know, and the gaps and lap times written to the
 *   tenth, cut, without a unit (João's gate decision on PR #19), in caps on air.
 *
 * What these tests prove:
 *   - A six-car list with one car per status draws "No box", "Quebrado", "Abandonou"
 *     and "Desclassificado" as the icons' names, no icon for running and notStarted,
 *     and dims the retired and disqualified pills to `--status-retired-opacity`.
 *   - A 40-character team name does not change its row's height (34 px like the others)
 *     and overflows hidden inside its column, cut with no ellipsis (positionsTowerLongNames
 *     .e2e.ts proves it scrolls).
 *   - A car missing its optional values shows "—" in every detailed cell that needs them.
 *   - 19 087 ms reads "+19,0", 278 293 ms reads "4:38,2", and two laps down reads
 *     "+2 voltas" in the DOM with the cell's computed text-transform uppercase, so the
 *     viewer sees "+2 VOLTAS".
 *
 * What these tests deliberately do not cover:
 *   - Pixel looks; positionsTowerScreenshots.e2e.ts covers them.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview with the given tower data and waits for the play-in to finish. */
async function openPreviewWithData(page: Page, towerData: Record<string, unknown>): Promise<void> {
  await page.goto(buildPreviewAddressWithData(towerData));
  await expect(page.locator('body'), 'the tower must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** One car per status, in a small field. */
function createOneCarPerStatus() {
  return [
    {
      position: 1,
      carNumber: 31,
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      laps: 34,
      status: 'running',
    },
    {
      position: 2,
      carNumber: 69,
      teamName: 'Seriema Off-Road',
      schoolName: 'UFV',
      laps: 31,
      status: 'inPit',
    },
    {
      position: 3,
      carNumber: 65,
      teamName: 'Pantanal Off-Road',
      schoolName: 'UEM',
      laps: 25,
      status: 'stopped',
    },
    {
      position: 4,
      carNumber: 96,
      teamName: 'Guará Baja',
      schoolName: 'UFS',
      laps: 12,
      status: 'retired',
    },
    {
      position: 5,
      carNumber: 12,
      teamName: 'Mandacaru Racing',
      schoolName: 'UFCG',
      laps: 10,
      status: 'disqualified',
    },
    {
      position: 6,
      carNumber: 77,
      teamName: 'Araucária Baja',
      schoolName: 'UTFPR',
      laps: 0,
      status: 'notStarted',
    },
  ];
}

test.describe('status icons', () => {
  test('draws one icon per status, named in pt-BR, and dims the cars out of the race', async ({
    page,
  }) => {
    // Arrange and act: the compact tower with one car per status.
    await openPreviewWithData(page, { entries: createOneCarPerStatus(), paging: 'firstPageOnly' });
    const rowsAsDrawn = await page.getByTestId('positions-tower-row').evaluateAll((rows) =>
      rows.map((row) => ({
        status: (row as HTMLElement).dataset.status,
        iconName:
          row.querySelector('[data-testid="row-status"] svg')?.getAttribute('aria-label') ?? null,
        pillOpacity: getComputedStyle(row.querySelector('.pill') as HTMLElement).opacity,
      })),
    );

    // Assert: the icons and the dimming the design's sheet-status page shows.
    expect(
      rowsAsDrawn,
      'each status must draw its icon and dim only the cars out of the race',
    ).toEqual([
      { status: 'running', iconName: null, pillOpacity: '1' },
      { status: 'inPit', iconName: 'No box', pillOpacity: '1' },
      { status: 'stopped', iconName: 'Quebrado', pillOpacity: '1' },
      { status: 'retired', iconName: 'Abandonou', pillOpacity: '0.55' },
      { status: 'disqualified', iconName: 'Desclassificado', pillOpacity: '0.55' },
      { status: 'notStarted', iconName: null, pillOpacity: '1' },
    ]);
  });
});

test.describe('a long team name', () => {
  test('is clipped inside its column and never changes the row height', async ({ page }) => {
    // Arrange and act: a compact tower where the second car's team name is 40 characters.
    const fortyCharacterName = 'Associação Atlética Baja Cerrado Goiano!';
    const entries = [
      {
        position: 1,
        carNumber: 31,
        teamName: 'Acauã Baja',
        schoolName: 'Mauá',
        laps: 34,
        status: 'running',
      },
      {
        position: 2,
        carNumber: 52,
        teamName: fortyCharacterName,
        schoolName: 'UFG',
        laps: 33,
        status: 'running',
      },
      {
        position: 3,
        carNumber: 25,
        teamName: 'Bem-te-vi Off-Road',
        schoolName: 'UFES',
        laps: 33,
        status: 'running',
      },
    ];
    await openPreviewWithData(page, { entries, paging: 'firstPageOnly' });
    const rowHeights = await page
      .getByTestId('positions-tower-row')
      .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
    const nameOverflow = await page
      .getByTestId('positions-tower-row')
      .nth(1)
      .locator('[data-testid="row-team-box"]')
      .evaluate((teamBox) => ({
        isOverflowing: teamBox.scrollWidth > teamBox.clientWidth,
        overflow: getComputedStyle(teamBox).overflow,
        textOverflow: getComputedStyle(teamBox).textOverflow,
        whiteSpace: getComputedStyle(teamBox).whiteSpace,
      }));

    // Assert: every row is 34 px (the long name did not wrap), the name overflows its
    // team cell and is clipped there on one line, with no ellipsis.
    expect(fortyCharacterName, 'the name under test is 40 characters').toHaveLength(40);
    expect(rowHeights, 'every row must be the theme’s 34 px, the long name included').toEqual([
      34, 34, 34,
    ]);
    expect(nameOverflow, 'the long name must be clipped, never wrapped nor ellipsed').toEqual({
      isOverflowing: true,
      overflow: 'hidden',
      textOverflow: 'clip',
      whiteSpace: 'nowrap',
    });
  });
});

test.describe('missing optional values', () => {
  test('show the empty mark in every detailed cell that needs them', async ({ page }) => {
    // Arrange and act: a detailed tower with every column, whose second car carries only
    // the required fields (a source that knows nothing but the order).
    const entries = [
      {
        position: 1,
        carNumber: 31,
        teamName: 'Acauã Baja',
        schoolName: 'Mauá',
        laps: 34,
        lastLapMs: 278_293,
        bestLapMs: 278_291,
        pitStops: 2,
        fuelStops: 2,
        status: 'running',
      },
      {
        position: 2,
        carNumber: 38,
        teamName: 'Coruja Racing',
        schoolName: 'EESC-USP',
        laps: 34,
        status: 'running',
      },
    ];
    await openPreviewWithData(page, {
      entries,
      layout: 'detailed',
      showFuelStops: true,
      paging: 'firstPageOnly',
    });
    const secondRowCells = await page
      .getByTestId('positions-tower-row')
      .nth(1)
      .evaluate((row) => ({
        gap: row.querySelector('[data-testid="row-gap"]')?.textContent,
        interval: row.querySelector('[data-testid="row-interval"]')?.textContent,
        lastLap: row.querySelector('[data-testid="row-lastLap"]')?.textContent,
        bestLap: row.querySelector('[data-testid="row-bestLap"]')?.textContent,
        pitStops: row.querySelector('[data-testid="row-pitStops"]')?.textContent,
        fuelStops: row.querySelector('[data-testid="row-fuelStops"]')?.textContent,
      }));

    // Assert: the mark everywhere, never a 0.
    expect(secondRowCells, 'a value the source does not know must show the empty mark').toEqual({
      gap: '—',
      interval: '—',
      lastLap: '—',
      bestLap: '—',
      pitStops: '—',
      fuelStops: '—',
    });
  });
});

test.describe('gap and lap text', () => {
  test('writes gaps and lap times to the tenth, cut, with no unit, and laps down in caps on air', async ({
    page,
  }) => {
    // Arrange and act: a detailed tower; the second car 19 087 ms behind with a 278 293 ms
    // lap, the third car two laps down.
    const entries = [
      {
        position: 1,
        carNumber: 31,
        teamName: 'Acauã Baja',
        schoolName: 'Mauá',
        laps: 34,
        lastLapMs: 278_293,
        status: 'running',
      },
      {
        position: 2,
        carNumber: 38,
        teamName: 'Coruja Racing',
        schoolName: 'EESC-USP',
        laps: 34,
        gapToLeaderMs: 19_087,
        intervalMs: 19_087,
        lastLapMs: 278_293,
        status: 'running',
      },
      {
        position: 3,
        carNumber: 95,
        teamName: 'Cangaço Baja',
        schoolName: 'UFPE',
        laps: 32,
        gapToLeaderLaps: 2,
        status: 'running',
      },
    ];
    await openPreviewWithData(page, { entries, layout: 'detailed', paging: 'firstPageOnly' });
    const textsAsDrawn = await page.getByTestId('positions-tower-row').evaluateAll((rows) => {
      const readCell = (row: Element, cell: string) => row.querySelector(`[data-testid="${cell}"]`);
      return {
        leaderGap: readCell(rows[0] as Element, 'row-gap')?.textContent,
        secondGap: readCell(rows[1] as Element, 'row-gap')?.textContent,
        secondLastLap: readCell(rows[1] as Element, 'row-lastLap')?.textContent,
        thirdGap: readCell(rows[2] as Element, 'row-gap')?.textContent,
        thirdGapTextTransform: getComputedStyle(readCell(rows[2] as Element, 'row-gap') as Element)
          .textTransform,
      };
    });

    // Assert: the leader's gap is blank, "+19,0" and "4:38,2" are cut to the tenth, and
    // "+2 voltas" is set in caps by the styles.
    expect(textsAsDrawn, 'gaps and laps must be written as the timing board does').toEqual({
      leaderGap: '',
      secondGap: '+19,0',
      secondLastLap: '4:38,2',
      thirdGap: '+2 voltas',
      thirdGapTextTransform: 'uppercase',
    });
  });
});
