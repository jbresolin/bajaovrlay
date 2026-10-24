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
 *   tests watch all of that in Chromium, and measure what a real update costs the main
 *   thread (the PR #18 freeze is the reason the numbers are reported).
 *
 * What these tests prove:
 *   - Two cars trading places: the two row elements are the same nodes, their order
 *     changed, a transform was applied to them during the swap (the slide), the cues
 *     were shown as the swap started and cleared after the hold.
 *   - A new leader: the leader mark (data-leader) moves to the row now in slot 1.
 *   - A car crossing the page boundary: car 6 (21st) climbing to 20th gets a new row,
 *     car 71's node lifts out and is removed, and the row count is 20 again.
 *   - Over 60 updates of the 60-car list (what a live binding would send over two
 *     minutes at 2 s intervals, applied back to back with every motion token shortened
 *     to a few ms, since the row count does not depend on the wait), each trading two
 *     neighbours' places and every 20th trading the 20th and 21st places, the row count
 *     stays 20 after every update, no row is left lifting out at the end, and the cars
 *     that never left page 1 sit on the very nodes they started on.
 *   - The cost of a real update, animated: a swap of two cars on page 1 and a crossing
 *     of the page boundary each take under 50 ms of main-thread work (the synchronous
 *     part of updateAction: the parse and merge, the DOM moves, FLIP's two measures
 *     with the layouts they force, the timeline build and start); both measured times
 *     are printed in the report, with the time until the slide ended for reference.
 *
 * How the tokens are shortened:
 *   The graphic reads its tokens when it builds each timeline, so the tests declare the
 *   shorter values on :root BEFORE the graphic loads (tokenOverrides.ts). The pages are
 *   held on page 1 so no page turn can land during a test.
 *
 * What these tests deliberately do not cover:
 *   - Pixel looks; positionsTowerScreenshots.e2e.ts covers the end states.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress';
import { expect, type Page, test } from '@playwright/test';

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

/** Finds the row of one car inside the graphic's shadow root (the locator reaches into it). */
function findRowOfCar(page: Page, carNumber: number) {
  return page.locator(
    `baja-positions-tower [data-testid="positions-tower-row"][data-car-number="${carNumber}"]`,
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
    // update resolves, and reading the cues as the update starts; the cues after the
    // hold are read from outside, with a wait that retries until they are gone.
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
      return {
        isSameNodeInSlotThree: rowsAfter[2] === rowOfCar78,
        isSameNodeInSlotFour: rowsAfter[3] === rowOfCar25,
        slotNumbers: [
          rowOfCar78.querySelector('[data-testid="row-pos"]')?.textContent,
          rowOfCar25.querySelector('[data-testid="row-pos"]')?.textContent,
        ],
        movingTransformCount: movingTransforms.length,
        cuesAsTheSwapStarted,
      };
    }, swappedEntries);
    const rowOfCar78 = findRowOfCar(page, 78);
    const rowOfCar25 = findRowOfCar(page, 25);

    // Assert: the same nodes in the other order, reading their new slots; the rows were
    // seen mid-slide; the cues were up as the swap started and gone after the hold (the
    // last three checks retry until the hold has passed).
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
    await expect(rowOfCar78, 'the ▲ must be cleared after the hold').not.toHaveClass(/is-up/);
    await expect(rowOfCar25, 'the ▼ must be cleared with it').not.toHaveClass(/is-down/);
    await expect(
      rowOfCar78.locator('svg.cue'),
      'the arrow must be taken out of the lane',
    ).toHaveCount(0);
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
  test('keep 20 rows with none left lifting out, and reuse the nodes of the cars that never left page 1', async ({
    page,
  }) => {
    // Arrange: every motion token shortened, the preview on air, and 60 lists: each
    // trades the places of two neighbours of page 1, and every 20th (the 20th, 40th and
    // 60th) trades the 20th and 21st places, so the page boundary is crossed three times.
    await placeTokenOverridesBeforeTheGraphicLoads(page, fastMotionTokens);
    await openPreviewHeldOnPageOne(page);
    const listsToSend: SampleEntry[][] = [];
    let entries = readEnduroSampleEntries();
    for (let updateIndex = 0; updateIndex < 60; updateIndex += 1) {
      const upperPosition = (updateIndex % 20) + 1;
      entries = swapCarsAtPositions(entries, upperPosition, upperPosition + 1);
      listsToSend.push(entries);
    }

    // Act: send the 60 updates back to back, counting the rows (lifting ones included)
    // after each, then look at what is left on the page.
    const observed = await page.evaluate(async (lists) => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-positions-tower') as OGrafGraphic;
      const listRows = () => [
        ...(graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="positions-tower-row"]',
        ) ?? []),
      ];
      const nodeByCarAtTheStart = new Map(listRows().map((row) => [row.dataset.carNumber, row]));
      const rowCountsSeen = new Set<number>();
      let carsThatNeverLeft = new Set(nodeByCarAtTheStart.keys());
      for (const entries of lists) {
        await graphic.updateAction({ data: { entries } });
        const rowsNow = listRows();
        rowCountsSeen.add(rowsNow.length);
        const carsNow = new Set(rowsNow.map((row) => row.dataset.carNumber));
        carsThatNeverLeft = new Set([...carsThatNeverLeft].filter((car) => carsNow.has(car)));
      }
      const rowsAtTheEnd = listRows();
      const rowsStillLiftingOut = rowsAtTheEnd.filter((row) =>
        row.classList.contains('is-leaving'),
      );
      const rowsOfCarsThatNeverLeft = rowsAtTheEnd.filter((row) =>
        carsThatNeverLeft.has(row.dataset.carNumber),
      );
      return {
        rowCountsSeen: [...rowCountsSeen],
        rowsStillLiftingOutAtTheEnd: rowsStillLiftingOut.length,
        carsThatNeverLeftPageOne: rowsOfCarsThatNeverLeft.length,
        isEveryCarThatNeverLeftOnItsFirstNode: rowsOfCarsThatNeverLeft.every(
          (row) => nodeByCarAtTheStart.get(row.dataset.carNumber) === row,
        ),
      };
    }, listsToSend);

    // Assert: 20 rows after every update, including the three crossings; nothing left
    // lifting out; and every car that never left page 1 is on the node it had at the
    // start. The neighbour swaps walk the leader down to 20th and each crossing pushes
    // it off, so cars 31, 38 and 25 leave in turn (31 and 38 come back, on new nodes,
    // as a car arriving does); the other 17 never leave.
    expect(observed.rowCountsSeen, 'the row count must stay 20 through every update').toEqual([20]);
    expect(
      observed.rowsStillLiftingOutAtTheEnd,
      'no row may be left lifting out once the updates have resolved',
    ).toBe(0);
    expect(
      observed.carsThatNeverLeftPageOne,
      'seventeen cars stay on page 1 through the sixty updates',
    ).toBe(17);
    expect(
      observed.isEveryCarThatNeverLeftOnItsFirstNode,
      'a car that never left page 1 must still be on the row node it was created with',
    ).toBe(true);
  });
});

test.describe('the cost of one real update', () => {
  test('a swap of two cars and a page-boundary crossing, animated, each take little main-thread time', async ({
    page,
  }) => {
    // Arrange: the preview on air with the theme's real tokens (a slide lasts 400 ms),
    // and two lists: 78 passes 25 (a swap inside page 1), then car 6 (21st) climbs to
    // 20th and car 71 drops off the page (a crossing: one row rises, one lifts out).
    await openPreviewHeldOnPageOne(page);
    const swapEntries = swapCarsAtPositions(readEnduroSampleEntries(), 3, 4);
    const crossingEntries = swapCarsAtPositions(swapEntries, 20, 21);

    // Act: send each without skipAnimation and time it twice. "Main thread" is the
    // synchronous part of updateAction, from the call until it hands control back at
    // its first real await: the parse and merge, the row moves in the DOM, FLIP's two
    // measures (each forcing a layout), the cue writes, the timeline build and its
    // start. That is the work OBS's frame would wait on. "Until the slide ended" is the
    // whole await, which is mostly the 400 ms slide and says nothing about cost.
    const measured = await page.evaluate(
      async ({ swap, crossing }) => {
        type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
        const graphic = document.querySelector('baja-positions-tower') as OGrafGraphic;
        const timeOneUpdate = async (entries: unknown[]) => {
          const startedAt = performance.now();
          const pendingUpdate = graphic.updateAction({ data: { entries } });
          const mainThreadMs = performance.now() - startedAt;
          await pendingUpdate;
          const untilTheSlideEndedMs = performance.now() - startedAt;
          return { mainThreadMs, untilTheSlideEndedMs };
        };
        return { swap: await timeOneUpdate(swap), crossing: await timeOneUpdate(crossing) };
      },
      { swap: swapEntries, crossing: crossingEntries },
    );

    // Assert: both under 50 ms of main-thread work (a loose guard: CI machines are a few
    // times slower than a developer's; the measured times go in the PR description).
    const describeMeasure = (name: string, measure: typeof measured.swap) =>
      `${name}: ${measure.mainThreadMs.toFixed(2)} ms on the main thread, ` +
      `${measure.untilTheSlideEndedMs.toFixed(0)} ms until the slide ended`;
    const report = [
      describeMeasure('a swap of two cars (animated)', measured.swap),
      describeMeasure('a page-boundary crossing (animated)', measured.crossing),
    ];
    for (const line of report) {
      test.info().annotations.push({ type: 'measured', description: line });
      process.stdout.write(`${line}\n`);
    }
    expect(
      measured.swap.mainThreadMs,
      'a swap must take under 50 ms of main-thread work',
    ).toBeLessThan(50);
    expect(
      measured.crossing.mainThreadMs,
      'a page-boundary crossing must take under 50 ms of main-thread work',
    ).toBeLessThan(50);
  });
});
