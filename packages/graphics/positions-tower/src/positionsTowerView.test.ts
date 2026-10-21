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
 *     slot 1.
 *   - Writing the same entries again changes nothing in the DOM (no mutation at all).
 *   - A car arriving gets a new row placed off air; a car leaving has its row removed at
 *     once off air, or taken out of flow (to lift away) when animated.
 *   - The status attribute and icon follow the entry; a car out of the race is marked
 *     so the styles dim it.
 *   - A column change adds or removes one cell per row and keeps the row nodes.
 *
 * What these tests deliberately do not cover:
 *   - Measured slides: jsdom lays nothing out, so every FLIP shift is 0 here; the
 *     Playwright tests watch the slide in Chromium.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { TowerSettings } from './positionsTowerModel.js';
import {
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
    const { parts, rows } = drawCompactTowerWithCars(3);
    const rowNodesBefore = listRowNodes(parts);

    // Act: rebuild for the detailed columns, then for compact again.
    const detailedColumns = applyColumnsToTower(parts, createSettings('detailed'));
    rebuildEveryRowForColumns(rows, detailedColumns);
    const cellCountWhenDetailed = rowNodesBefore[0]?.querySelectorAll('.cell').length;
    const compactColumns = applyColumnsToTower(parts, createSettings('compact'));
    rebuildEveryRowForColumns(rows, compactColumns);

    // Assert: the same nodes, eleven cells when detailed, six again when compact.
    expect(listRowNodes(parts), 'the row nodes must be kept').toEqual(rowNodesBefore);
    expect(cellCountWhenDetailed, 'a detailed row has eleven cells').toBe(11);
    expect(rowNodesBefore[0]?.querySelectorAll('.cell').length, 'a compact row has six').toBe(6);
  });
});
