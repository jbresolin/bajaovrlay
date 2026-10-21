/**
 * The positions tower's DOM writers (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   positionsTowerView.ts draws the tower's markup once and afterwards changes it in
 *   place: the head captions and the detailed grid from the columns shown, and the rows
 *   from the visible entries. A row is one `<li>` per visible car, keyed by car number,
 *   reused across updates: moved with `append`, its texts written only when they differ.
 *
 * What these tests prove:
 *   - The head captions follow the columns: POS, Nº, EQUIPE, VOLTAS in compact; the
 *     timing captions too in detailed, with the grid and the width written on the tower
 *     as inline custom properties, and taken off again in compact.
 *   - Rows are created once per car and reused: after a swap the same two nodes are in
 *     the other order, their position cells read their new slots, the leader mark follows
 *     the car in position 1 (so page 2's first row carries no mark and shows its gap).
 *   - Writing the same entries again changes nothing in the DOM (no mutation at all).
 *   - A car arriving gets a new row placed off air; a car leaving has its row removed at
 *     once off air, or taken out of flow (to lift away) when animated.
 *   - The status attribute and icon follow the entry; a car out of the race is marked
 *     so the styles dim it.
 *   - A column change adds or removes one cell per row, keeps the row nodes and writes
 *     the rows again; a status cell created again by that change draws its icon.
 *   - When animated, every layout read (FLIP's measures) happens before any cue is
 *     written, so the browser lays the page out once and not once per cued row.
 *
 * What these tests deliberately do not cover:
 *   - Measured slides: jsdom lays nothing out, so every FLIP shift is 0 here; the
 *     Playwright tests watch the slide in Chromium.
 */
import { render } from 'lit';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { TowerSettings } from './positionsTowerModel.js';
import {
  createEnduroSampleEntries,
  createFirstCarsOfTheEnduroSample,
  swapCarsAtPositions,
} from './positionsTowerOnThePage.testSupport.js';
import {
  applyColumnsToTower,
  findPositionsTowerParts,
  placeVisibleEntries,
  type PositionsTowerParts,
  rebuildEveryRowForColumns,
  renderPositionsTowerTemplate,
  type TowerRowsByCarNumber,
} from './positionsTowerView.js';

/** The manifest's defaults, in the given layout. */
function createSettings(layout: TowerSettings['layout']): TowerSettings {
  return {
    layout,
    showGap: true,
    showInterval: true,
    showLastLap: true,
    showBestLap: true,
    showPitStops: true,
    showFuelStops: false,
    showStatus: true,
    paging: 'cycle',
  };
}

/** Draws the tower's markup into a fresh container on the page and returns its parts. */
function drawTowerParts(): PositionsTowerParts {
  const container = document.createElement('div');
  document.body.append(container);
  render(renderPositionsTowerTemplate(), container);
  return findPositionsTowerParts(container, container);
}

/** A drawn compact tower with the first `carCount` cars of the sample placed off air. */
function drawCompactTowerWithCars(carCount: number) {
  const parts = drawTowerParts();
  const rows: TowerRowsByCarNumber = new Map();
  const columns = applyColumnsToTower(parts, createSettings('compact'));
  const entries = createFirstCarsOfTheEnduroSample(carCount);
  placeVisibleEntries(parts, rows, [], entries, columns, 'offAir', 'update-1');
  return { parts, rows, columns, entries };
}

/** A drawn detailed tower with the given entries placed off air. */
function drawDetailedTowerWithEntries(entries: ReturnType<typeof createEnduroSampleEntries>) {
  const parts = drawTowerParts();
  const rows: TowerRowsByCarNumber = new Map();
  const columns = applyColumnsToTower(parts, createSettings('detailed'));
  placeVisibleEntries(parts, rows, [], entries, columns, 'offAir', 'update-1');
  return { parts, rows, columns, entries };
}

/** The row nodes in the list, in order. */
function listRowNodes(parts: PositionsTowerParts): HTMLElement[] {
  return [...parts.rows.querySelectorAll<HTMLElement>('li.row')];
}

/** The captions in the head, as one line. */
function readHeadCaptions(parts: PositionsTowerParts): string {
  return [...parts.head.children].map((caption) => caption.textContent).join('|');
}

describe('applyColumnsToTower', () => {
  it('writes the compact captions and no detailed grid', () => {
    // Arrange: freshly drawn parts.
    const parts = drawTowerParts();

    // Act: dress the tower for the compact layout.
    applyColumnsToTower(parts, createSettings('compact'));

    // Assert: the four captions with blank cue and status lanes; no inline grid.
    expect(readHeadCaptions(parts), 'the compact head names its columns').toBe(
      'POS||Nº|EQUIPE|VOLTAS|',
    );
    expect(parts.tower.dataset.layout, 'the tower is marked compact').toBe('compact');
    expect(parts.tower.style.getPropertyValue('--detail-columns'), 'no detailed grid').toBe('');
  });

  it('writes the detailed captions, the grid and the width, then takes them off in compact', () => {
    // Arrange: freshly drawn parts.
    const parts = drawTowerParts();

    // Act: dress the tower detailed, then compact again.
    applyColumnsToTower(parts, createSettings('detailed'));
    const detailedGrid = parts.tower.style.getPropertyValue('--detail-columns');
    const detailedWidth = parts.tower.style.getPropertyValue('--tower-width');
    const detailedCaptions = readHeadCaptions(parts);
    applyColumnsToTower(parts, createSettings('compact'));

    // Assert: the detailed head named every column; the grid and width were written from
    // the tokens and are gone once compact again.
    expect(detailedCaptions, 'the detailed head names the timing columns').toBe(
      'POS||Nº|EQUIPE|VOLTAS|DIF.|INTERV.|ÚLT. VOLTA|MELHOR|PARADAS|',
    );
    expect(detailedGrid, 'the grid must start with the position token').toContain('var(--col-pos)');
    expect(detailedWidth, 'the width must be a calc of the tokens').toMatch(
      /^calc\(var\(--col-pos\)/,
    );
    expect(parts.tower.style.getPropertyValue('--tower-width'), 'compact has no width').toBe('');
  });
});

describe('placeVisibleEntries', () => {
  it('creates one row per car, in order, the first marked as the leader', () => {
    // Arrange and act: a compact tower with the top five placed.
    const { parts } = drawCompactTowerWithCars(5);
    const rowNodes = listRowNodes(parts);

    // Assert: five rows keyed by car number, slot numbers 1 to 5, the leader marked.
    expect(
      rowNodes.map((row) => row.dataset.carNumber),
      'one row per car in position order',
    ).toEqual(['31', '38', '25', '78', '52']);
    expect(
      rowNodes.map((row) => row.querySelector('[data-testid="row-pos"]')?.textContent),
      'each row reads the number of its slot',
    ).toEqual(['1', '2', '3', '4', '5']);
    expect(rowNodes[0]?.hasAttribute('data-leader'), 'slot 1 carries the leader mark').toBe(true);
    expect(rowNodes[1]?.hasAttribute('data-leader'), 'slot 2 carries no leader mark').toBe(false);
  });

  it('marks the leader by position 1, so page 2’s first row carries no mark and shows its gap', () => {
    // Arrange and act: a detailed tower showing page 2 (positions 21 to 25; car 6 first,
    // four laps down), as the page turner draws it.
    const pageTwoEntries = createEnduroSampleEntries().slice(20, 25);
    const { parts } = drawDetailedTowerWithEntries(pageTwoEntries);
    const firstRowOnPageTwo = listRowNodes(parts)[0];

    // Assert: the first row is car 6 in 21st, wears no leader mark, and its gap cell
    // reads the laps down instead of the leader's blank.
    expect(firstRowOnPageTwo?.dataset.carNumber, 'page 2 starts with car 6').toBe('6');
    expect(
      firstRowOnPageTwo?.querySelector('[data-testid="row-pos"]')?.textContent,
      'the first row of page 2 is position 21',
    ).toBe('21');
    expect(
      firstRowOnPageTwo?.hasAttribute('data-leader'),
      'only the car in position 1 wears the leader mark, never the first row of a page',
    ).toBe(false);
    expect(
      firstRowOnPageTwo?.querySelector('[data-testid="row-gap"]')?.textContent,
      'the 21st car shows its gap to the leader',
    ).toBe('+4 voltas');
  });

  it('reuses the row nodes of two cars trading places and rewrites their slot numbers', () => {
    // Arrange: the top five placed; the nodes of 25 (3rd) and 78 (4th) noted.
    const { parts, rows, columns, entries } = drawCompactTowerWithCars(5);
    const [, , rowOfCar25, rowOfCar78] = listRowNodes(parts);

    // Act: 78 passes 25.
    placeVisibleEntries(
      parts,
      rows,
      entries,
      swapCarsAtPositions(entries, 3, 4),
      columns,
      'offAir',
      'update-2',
    );
    const rowNodesAfter = listRowNodes(parts);

    // Assert: the same nodes in the other order, each reading its new slot.
    expect(rowNodesAfter[2], 'slot 3 is car 78’s node').toBe(rowOfCar78);
    expect(rowNodesAfter[3], 'slot 4 is car 25’s node').toBe(rowOfCar25);
    expect(rowOfCar78?.querySelector('[data-testid="row-pos"]')?.textContent, '78 reads 3').toBe(
      '3',
    );
    expect(rowOfCar25?.querySelector('[data-testid="row-pos"]')?.textContent, '25 reads 4').toBe(
      '4',
    );
    expect(rows.size, 'still five rows are kept').toBe(5);
  });

  it('touches nothing in the DOM when the same entries are written again', async () => {
    // Arrange: the top five placed, and a watcher on everything inside the list.
    const { parts, rows, columns, entries } = drawCompactTowerWithCars(5);
    const watcher = new MutationObserver(() => {});
    watcher.observe(parts.rows, {
      childList: true,
      characterData: true,
      attributes: true,
      subtree: true,
    });

    // Act: write the very same entries again (a poll that found nothing new).
    placeVisibleEntries(parts, rows, entries, entries, columns, 'offAir', 'update-2');
    await Promise.resolve();
    const mutations = watcher.takeRecords();
    watcher.disconnect();

    // Assert: not one node, text or attribute changed.
    expect(mutations, 'an unchanged list must leave the DOM alone').toEqual([]);
  });

  it('adds a row for a car arriving and removes the row of a car leaving, off air', () => {
    // Arrange: cars 1–5 placed; car 47 (6th) will replace car 52 (5th).
    const { parts, rows, columns, entries } = drawCompactTowerWithCars(5);
    const sixCars = createFirstCarsOfTheEnduroSample(6);
    const rowOfCar52 = listRowNodes(parts)[4];

    // Act: 47 climbs to 5th and 52 drops off the page.
    const change = placeVisibleEntries(
      parts,
      rows,
      entries,
      [...entries.slice(0, 4), { ...sixCars[5]!, position: 5 }],
      columns,
      'offAir',
      'update-2',
    );

    // Assert: a new row for 47 in slot 5, 52's row gone, and the change says so.
    expect(listRowNodes(parts)[4]?.dataset.carNumber, 'slot 5 is now car 47').toBe('47');
    expect(rowOfCar52?.isConnected, 'off air the leaving row is removed at once').toBe(false);
    expect(
      change.rowsEntering.map((row) => row.carNumber),
      'car 47 enters',
    ).toEqual([47]);
    expect(change.rowsLeaving, 'off air nothing is left to lift out').toEqual([]);
  });

  it('takes a leaving row out of flow (to lift away) when animated', () => {
    // Arrange: cars 1–5 placed; the same change, animated this time.
    const { parts, rows, columns, entries } = drawCompactTowerWithCars(5);
    const sixCars = createFirstCarsOfTheEnduroSample(6);
    const rowOfCar52 = listRowNodes(parts)[4];

    // Act: 47 climbs to 5th and 52 drops off the page, on air.
    const change = placeVisibleEntries(
      parts,
      rows,
      entries,
      [...entries.slice(0, 4), { ...sixCars[5]!, position: 5 }],
      columns,
      'animated',
      'update-2',
    );

    // Assert: 52's row is still in the DOM, marked as leaving, and reported so the
    // component can remove it after the lift.
    expect(rowOfCar52?.isConnected, 'animated, the leaving row stays until it lifted').toBe(true);
    expect(rowOfCar52?.classList.contains('is-leaving'), 'the row is taken out of flow').toBe(true);
    expect(
      change.rowsLeaving.map((row) => row.carNumber),
      'car 52 is reported leaving',
    ).toEqual([52]);
  });

  it('does every layout read before any cue is written, when animated', () => {
    // Arrange: the top five placed, and a watch on every layout read that notes how many
    // cues were already on the page at the moment of the read.
    const { parts, rows, columns, entries } = drawCompactTowerWithCars(5);
    const cuesOnThePageAtEachRead: number[] = [];
    const measureAsTheBrowserDoes = Element.prototype.getBoundingClientRect;
    const readSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function recordCuesThenMeasure(this: Element) {
        cuesOnThePageAtEachRead.push(parts.rows.querySelectorAll('.is-up, .is-down').length);
        return measureAsTheBrowserDoes.call(this);
      });
    onTestFinished(() => readSpy.mockRestore());

    // Act: 78 passes 25 on air (both rows get a cue).
    placeVisibleEntries(
      parts,
      rows,
      entries,
      swapCarsAtPositions(entries, 3, 4),
      columns,
      'animated',
      'update-2',
    );

    // Assert: the rows were measured (before and after the move), and no read ever saw
    // a cue on the page: the cue writes all came after the last read.
    expect(cuesOnThePageAtEachRead.length, 'FLIP must measure the rows').toBeGreaterThan(0);
    expect(
      cuesOnThePageAtEachRead.every((cueCount) => cueCount === 0),
      'every layout read must happen before the first cue is written (one layout, not one per cued row)',
    ).toBe(true);
    expect(parts.rows.querySelectorAll('.is-up, .is-down').length, 'both cues end up written').toBe(
      2,
    );
  });

  it('writes the status attribute and draws the icon of a car in the pit', () => {
    // Arrange: the top 17 placed (car 69, 17th, is in the pit).
    const { parts } = drawCompactTowerWithCars(17);
    const rowOfCar69 = listRowNodes(parts)[16];

    // Assert: the row is marked inPit and its status lane holds the "No box" icon.
    expect(rowOfCar69?.dataset.status, 'the row carries the status').toBe('inPit');
    expect(
      rowOfCar69?.querySelector('[data-testid="row-status"] svg')?.getAttribute('aria-label'),
      'the pit icon must be drawn in the status lane',
    ).toBe('No box');
  });
});

describe('rebuildEveryRowForColumns', () => {
  it('adds the detailed cells to every existing row, and removes them again', () => {
    // Arrange: a compact tower with three cars.
    const { parts, rows, entries } = drawCompactTowerWithCars(3);
    const rowNodesBefore = listRowNodes(parts);

    // Act: rebuild for the detailed columns, then for compact again.
    const detailedColumns = applyColumnsToTower(parts, createSettings('detailed'));
    rebuildEveryRowForColumns(rows, detailedColumns, entries);
    const cellCountWhenDetailed = rowNodesBefore[0]?.querySelectorAll('.cell').length;
    const compactColumns = applyColumnsToTower(parts, createSettings('compact'));
    rebuildEveryRowForColumns(rows, compactColumns, entries);

    // Assert: the same nodes, eleven cells when detailed, six again when compact.
    expect(listRowNodes(parts), 'the row nodes must be kept').toEqual(rowNodesBefore);
    expect(cellCountWhenDetailed, 'a detailed row has eleven cells').toBe(11);
    expect(rowNodesBefore[0]?.querySelectorAll('.cell').length, 'a compact row has six').toBe(6);
  });

  it('draws the status icon again in a status cell created again by a column change', () => {
    // Arrange: a detailed tower with the top 17 (car 69, 17th, is in the pit), then the
    // status column switched off, which removes every status cell.
    const { parts, rows, entries } = drawDetailedTowerWithEntries(
      createFirstCarsOfTheEnduroSample(17),
    );
    const settingsWithoutStatus = { ...createSettings('detailed'), showStatus: false };
    rebuildEveryRowForColumns(rows, applyColumnsToTower(parts, settingsWithoutStatus), entries);
    const rowOfCar69 = listRowNodes(parts)[16];
    const hadStatusCellWhileOff = rowOfCar69?.querySelector('[data-testid="row-status"]');

    // Act: the status column switched back on, which creates the status cells again.
    rebuildEveryRowForColumns(
      rows,
      applyColumnsToTower(parts, createSettings('detailed')),
      entries,
    );

    // Assert: the cell was gone while off, and the new cell holds the pit icon again.
    expect(hadStatusCellWhileOff, 'with the column off the status cell is gone').toBeNull();
    expect(
      rowOfCar69?.querySelector('[data-testid="row-status"] svg')?.getAttribute('aria-label'),
      'a status cell created again must draw the icon of the status the row already has',
    ).toBe('No box');
  });
});
