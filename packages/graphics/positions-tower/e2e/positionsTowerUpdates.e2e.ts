/**
 * Positions tower updates on air, in the preview page
 * (packages/graphics/positions-tower, Playwright)
 *
 * What this module is for:
 *   The live binding sends the tower a new list about every 2 s. On air the tower moves
 *   pills, never numbers: a car that changed slot keeps its row node and slides to its
 *   new place (FLIP), a car arriving from the next page rises in, a car pushed off the
 *   page lifts out and its node is removed, and the ▲ / ▼ with the coloured cell are
 *   held `--motion-cue-hold` then cleared. The brief's performance rule: one DOM node per
 *   visible row, reused across updates, so OBS never re-lays out the whole list. These
 *   tests watch all of that in Chromium, and measure one update's main-thread time (the
 *   PR #18 freeze is the reason the number is reported).
 *
 * What these tests prove:
 *   - Two cars trading places: the two row elements are the same nodes, their order
 *     changed, a transform was applied to them during the swap (the slide), the cues
 *     were shown as the swap started and cleared after the hold.
 *   - A new leader: the leader mark (data-leader) moves to the row now in slot 1.
 *   - A car crossing the page boundary: car 6 (21st) climbing to 20th gets a new row,
 *     car 71's node lifts out and is removed, and the row count is 20 again.
 *   - Over 60 updates of the 60-car list, each trading two cars' places (what a live
 *     binding would send over two minutes at 2 s intervals, applied back to back with
 *     every motion token shortened to a few ms, since the row count does not depend on
 *     the wait), the row count stays 20 and the same elements are reused for the cars
 *     that stayed.
 *   - One update of the 60-car list (with skipAnimation, so only main-thread work is
 *     timed) takes under 50 ms; the measured time is printed in the report.
 *
 * How the tokens are shortened:
 *   The graphic reads its tokens when it builds each timeline, so the tests declare the
 *   shorter values on :root BEFORE the graphic loads (tokenOverrides.ts). The pages are
 *   held on page 1 so no page turn can land during a test.
 *
 * What these tests deliberately do not cover:
 *   - Pixel looks; positionsTowerScreenshots.e2e.ts covers the end states.
 */
import { expect, type Page, test } from '@playwright/test';

import { buildPreviewAddressWithData } from './previewAddress.js';
import { readEnduroSampleEntries, type SampleEntry, swapCarsAtPositions } from './sampleEntries.js';
import { placeTokenOverridesBeforeTheGraphicLoads } from './tokenOverrides.js';

/** Opens the preview with the sample held on page 1 and waits for the play-in to finish. */
async function openPreviewHeldOnPageOne(page: Page): Promise<void> {
  await page.goto(
    buildPreviewAddressWithData({ entries: readEnduroSampleEntries(), paging: 'firstPageOnly' }),
  );
  await expect(page.locator('body'), 'the tower must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
}

/** Every motion token down to a few milliseconds, the page hold long enough never to fire. */
const fastMotionTokens = {
  '--motion-in': '5ms',
  '--motion-out': '5ms',
  '--motion-row-stagger': '1ms',
  '--motion-swap': '5ms',
  '--motion-cue-hold': '5ms',
  '--motion-strip-hold': '600000ms',
};

test.describe('a swap of two cars', () => {
  test('slides the same two row nodes into each other’s slot and holds the cues, then clears them', async ({
    page,
  }) => {
    // Arrange: a short cue hold on :root, the preview on air; cars 25 (3rd) and 78 (4th).
    await placeTokenOverridesBeforeTheGraphicLoads(page, { '--motion-cue-hold': '300ms' });
    await openPreviewHeldOnPageOne(page);
    const swappedEntries = swapCarsAtPositions(readEnduroSampleEntries(), 3, 4);

    // Act: send the swap, sampling the two rows' transforms on every frame until the
    // update resolves, and reading the cues as the update starts and after the hold.
    const observed = await page.evaluate(async (entries) => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-positions-tower') as OGrafGraphic;
      const rowsBefore = [
        ...(graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="positions-tower-row"]',
        ) ?? []),
      ];
      const rowOfCar25 = rowsBefore[2] as HTMLElement;
      const rowOfCar78 = rowsBefore[3] as HTMLElement;
      const transformsSeen = new Set<string>();
      let isStillSampling = true;
      const sampleTransforms = () => {
        transformsSeen.add(rowOfCar25.style.transform);
        transformsSeen.add(rowOfCar78.style.transform);
        if (isStillSampling) {
          requestAnimationFrame(sampleTransforms);
        }
      };
      sampleTransforms();
      const pendingUpdate = graphic.updateAction({ data: { entries } });
      const cuesAsTheSwapStarted = {
        car78: rowOfCar78.classList.contains('is-up'),
        car25: rowOfCar25.classList.contains('is-down'),
        arrowOnCar78: rowOfCar78.querySelector('svg.cue')?.getAttribute('aria-label') ?? null,
      };
      await pendingUpdate;
      isStillSampling = false;
      const rowsAfter = [
        ...(graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="positions-tower-row"]',
        ) ?? []),
      ];
      // A slide leaves translate() values other than 0 on the way; "" and "translate(0px, 0px)" are rest.
      const movingTransforms = [...transformsSeen].filter(
        (transform) => transform !== '' && !/translate\(0px, 0px\)/.test(transform),
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
      return {
        isSameNodeInSlotThree: rowsAfter[2] === rowOfCar78,
        isSameNodeInSlotFour: rowsAfter[3] === rowOfCar25,
        slotNumbers: [
          rowOfCar78.querySelector('[data-testid="row-pos"]')?.textContent,
          rowOfCar25.querySelector('[data-testid="row-pos"]')?.textContent,
        ],
        movingTransformCount: movingTransforms.length,
        cuesAsTheSwapStarted,
        cuesAfterTheHold: {
          car78: rowOfCar78.classList.contains('is-up'),
          car25: rowOfCar25.classList.contains('is-down'),
          arrowOnCar78: rowOfCar78.querySelector('svg.cue'),
        },
      };
    }, swappedEntries);

    // Assert: the same nodes in the other order, reading their new slots; the rows were
    // seen mid-slide; the cues were up as the swap started and gone after the hold.
    expect(observed.isSameNodeInSlotThree, 'slot 3 must hold car 78’s own node').toBe(true);
    expect(observed.isSameNodeInSlotFour, 'slot 4 must hold car 25’s own node').toBe(true);
    expect(observed.slotNumbers, 'each node reads the number of its new slot').toEqual(['3', '4']);
    expect(
      observed.movingTransformCount,
      'the rows must slide (a transform other than rest was applied during the swap)',
    ).toBeGreaterThan(0);
    expect(observed.cuesAsTheSwapStarted, 'the ▲ and ▼ must show as the swap starts').toEqual({
      car78: true,
      car25: true,
      arrowOnCar78: 'Subiu',
    });
    expect(observed.cuesAfterTheHold, 'the cues must be cleared after the hold').toEqual({
      car78: false,
      car25: false,
      arrowOnCar78: null,
    });
  });
});

test.describe('a new leader', () => {
  test('moves the leader mark to the row now in slot 1', async ({ page }) => {
    // Arrange: the preview on air; car 38 about to take the lead from car 31.
    await openPreviewHeldOnPageOne(page);
    const newLeaderEntries = swapCarsAtPositions(readEnduroSampleEntries(), 1, 2);

    // Act: send the update and read which rows carry the mark.
    const leaderMarks = await page.evaluate(async (entries) => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-positions-tower') as OGrafGraphic;
      const [rowOfCar31, rowOfCar38] = [
        ...(graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="positions-tower-row"]',
        ) ?? []),
      ];
      await graphic.updateAction({ data: { entries } });
      return {
        car38HasTheMark: rowOfCar38?.hasAttribute('data-leader'),
        car31HasTheMark: rowOfCar31?.hasAttribute('data-leader'),
        firstRowCar: graphic.shadowRoot?.querySelector<HTMLElement>(
          '[data-testid="positions-tower-row"]',
        )?.dataset.carNumber,
      };
    }, newLeaderEntries);

    // Assert: 38 took the mark and slot 1, 31 lost it.
    expect(leaderMarks, 'the green chip must follow slot 1 to the new leader').toEqual({
      car38HasTheMark: true,
      car31HasTheMark: false,
      firstRowCar: '38',
    });
  });
});

test.describe('a car crossing the page boundary', () => {
  test('rises a new row in for car 6, lifts car 71’s row out and removes it, keeping 20 rows', async ({
    page,
  }) => {
    // Arrange: the preview on air; car 6 (21st) about to climb to 20th.
    await openPreviewHeldOnPageOne(page);
    const crossingEntries = swapCarsAtPositions(readEnduroSampleEntries(), 20, 21);

    // Act: send the update; note car 71's node before, and the rows after.
    const observed = await page.evaluate(async (entries) => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-positions-tower') as OGrafGraphic;
      const rowsBefore = [
        ...(graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="positions-tower-row"]',
        ) ?? []),
      ];
      const rowOfCar71 = rowsBefore[19] as HTMLElement;
      await graphic.updateAction({ data: { entries } });
      const rowsAfter = [
        ...(graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="positions-tower-row"]',
        ) ?? []),
      ];
      return {
        rowCount: rowsAfter.length,
        lastRowCar: rowsAfter[19]?.dataset.carNumber,
        isCar71StillOnThePage: rowOfCar71.isConnected,
        isCar6RowNew: !rowsBefore.includes(rowsAfter[19] as HTMLElement),
        lastRowOpacity: rowsAfter[19] ? getComputedStyle(rowsAfter[19]).opacity : 'no row',
      };
    }, crossingEntries);

    // Assert: 20 rows, car 6 on a new row in slot 20 and visible, car 71's node gone.
    expect(observed, 'the arriving car rises in on a new row, the leaving car is removed').toEqual({
      rowCount: 20,
      lastRowCar: '6',
      isCar71StillOnThePage: false,
      isCar6RowNew: true,
      lastRowOpacity: '1',
    });
  });
});

test.describe('sixty updates of a sixty-car list', () => {
  test('keep 20 row nodes, reuse them for the cars that stayed, and one update takes under 50 ms', async ({
    page,
  }) => {
    // Arrange: every motion token shortened, the preview on air, and 60 lists where each
    // trades the places of two cars of page 1 (a live binding's two minutes at 2 s).
    await placeTokenOverridesBeforeTheGraphicLoads(page, fastMotionTokens);
    await openPreviewHeldOnPageOne(page);
    const listsToSend: SampleEntry[][] = [];
    let entries = readEnduroSampleEntries();
    for (let updateIndex = 0; updateIndex < 60; updateIndex += 1) {
      const upperPosition = (updateIndex % 19) + 1;
      entries = swapCarsAtPositions(entries, upperPosition, upperPosition + 1);
      listsToSend.push(entries);
    }

    // Act: send the 60 updates back to back, counting the rows after each, then time one
    // more update with skipAnimation (main-thread work only).
    const observed = await page.evaluate(async (lists) => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-positions-tower') as OGrafGraphic;
      const listRows = () => [
        ...(graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="positions-tower-row"]',
        ) ?? []),
      ];
      const nodesAtTheStart = new Set(listRows());
      const rowCountsSeen = new Set<number>();
      for (const entries of lists) {
        await graphic.updateAction({ data: { entries } });
        rowCountsSeen.add(listRows().length);
      }
      const nodesAtTheEnd = listRows();
      const timedEntries = lists[lists.length - 1] as unknown[];
      const startedAt = performance.now();
      await graphic.updateAction({ data: { entries: timedEntries }, skipAnimation: true });
      const updateTimeMs = performance.now() - startedAt;
      return {
        rowCountsSeen: [...rowCountsSeen],
        isEveryNodeReused: nodesAtTheEnd.every((node) => nodesAtTheStart.has(node)),
        updateTimeMs,
      };
    }, listsToSend);

    // Assert: always 20 rows, the very same nodes, and the timed update under 50 ms (a
    // loose guard: CI machines are a few times slower than a developer's; the measured
    // time goes in the PR description).
    test.info().annotations.push({
      type: 'measured',
      description: `one update of the 60-car list took ${observed.updateTimeMs.toFixed(2)} ms`,
    });
    process.stdout.write(
      `one update of the 60-car list took ${observed.updateTimeMs.toFixed(2)} ms\n`,
    );
    expect(observed.rowCountsSeen, 'the row count must stay 20 through every update').toEqual([20]);
    expect(observed.isEveryNodeReused, 'every row node must be one created at load').toBe(true);
    expect(
      observed.updateTimeMs,
      'one update must take under 50 ms of main-thread time',
    ).toBeLessThan(50);
  });
});
