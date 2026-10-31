/**
 * One row of the tower: the `<li>` the animations move (opacity, transform, out of flow
 * when leaving) wrapping the pill that holds the cells. A row is created once per
 * visible car and reused across updates: afterwards only its texts, its data attributes
 * and its icons change, and only when they differ. The one time cells are created again
 * is a column change on air (the layout or a column switch), which adds or removes the
 * cells of the columns that changed on the same row; a status cell made again this way
 * draws the row's icon at once, since the status itself did not change.
 */
import { makeScrollingTextBox } from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
import { writeTextIfChanged } from '@bajaovrlay/graphics-kit/textInPlace';
import { nothing, render } from 'lit';

import { type CueDirection, renderCueArrow } from './cueArrows.js';
import type { PositionStatus, TowerColumnKey, TowerEntry } from './positionsTowerModel.js';
import { renderStatusIcon } from './statusIcons.js';
import type { TowerColumn } from './towerColumns.js';
import { writeCountText, writeGapText, writeIntervalText, writeLapTimeText } from './towerText.js';

/** A row node and the cells inside it, found once at creation. */
export type TowerRow = {
  /** The `<li>` the animations move; `data-car-number`, `data-status`, `data-leader` live here. */
  element: HTMLLIElement;
  /** The slate pill inside the `<li>`: the grid of cells, dimmed for a car out of the race. */
  pill: HTMLDivElement;
  carNumber: number;
  cells: Map<TowerColumnKey, HTMLElement>;
  /** The status last written, so a status cell made again can draw its icon. */
  status: PositionStatus | undefined;
  /** The team name inside the team cell, which scrolls when too long for its column. */
  teamName: HTMLElement;
  /** The school after the team name, shown in the detailed layout only. */
  schoolName: HTMLElement;
};

/** The class of each column's cell, which the styles align and colour by column. */
const cellClassByColumn: Record<TowerColumnKey, string> = {
  pos: 'cell-pos',
  cue: 'cell-cue',
  car: 'cell-car chip',
  team: 'cell-team',
  laps: 'cell-laps',
  gap: 'cell-gap',
  interval: 'cell-interval',
  lastLap: 'cell-last-lap',
  bestLap: 'cell-best-lap',
  pitStops: 'cell-pit-stops',
  fuelStops: 'cell-fuel-stops',
  status: 'cell-status',
};

/** Creates a row for a car with one cell per column shown, texts not written yet. */
export function createTowerRow(carNumber: number, columns: TowerColumn[]): TowerRow {
  const element = document.createElement('li');
  element.className = 'row';
  element.dataset.testid = 'positions-tower-row';
  element.dataset.carNumber = String(carNumber);
  const pill = document.createElement('div');
  pill.className = 'pill';
  element.append(pill);

  const teamName = document.createElement('span');
  teamName.className = 'team-name';
  teamName.dataset.testid = 'row-team-name';
  const schoolName = document.createElement('span');
  schoolName.className = 'school-name';
  schoolName.dataset.testid = 'row-school-name';

  const row: TowerRow = {
    element,
    pill,
    carNumber,
    cells: new Map(),
    status: undefined,
    teamName,
    schoolName,
  };
  rebuildTowerRowCells(row, columns);
  return row;
}

/**
 * Makes the row's cells match the columns shown: a cell of a column that is now off is
 * removed, a cell of a column that is now on is created, and the cells are put in
 * column order. Cells that stay keep their text and icon; a status cell made again gets
 * its icon drawn here, because the status write below skips a status that did not
 * change. The one place cells are made after a row's creation.
 */
export function rebuildTowerRowCells(row: TowerRow, columns: TowerColumn[]): void {
  const columnKeysShown = new Set(columns.map((column) => column.key));
  for (const [columnKey, cell] of row.cells) {
    if (!columnKeysShown.has(columnKey)) {
      cell.remove();
      row.cells.delete(columnKey);
    }
  }
  for (const column of columns) {
    const existingCell = row.cells.get(column.key);
    const cell = existingCell ?? createCellOfColumn(row, column.key);
    row.cells.set(column.key, cell);
    // append moves a cell already in the pill, so this also puts the cells in order.
    row.pill.append(cell);
    const isNewStatusCell = existingCell === undefined && column.key === 'status';
    if (isNewStatusCell && row.status !== undefined) {
      render(renderStatusIcon(row.status), cell);
    }
  }
}

/**
 * Builds one empty cell for a column. The team cell is a scrolling box holding the name and
 * the school, which scroll together as one line when too long for the column (BAJAOVRLAY-55).
 */
function createCellOfColumn(row: TowerRow, columnKey: TowerColumnKey): HTMLElement {
  const cell = document.createElement('span');
  cell.className = `cell ${cellClassByColumn[columnKey]}`;
  cell.dataset.testid = `row-${columnKey}`;
  if (columnKey === 'team') {
    cell.append(row.teamName, row.schoolName);
    makeScrollingTextBox(cell);
  }
  return cell;
}

/** The text of one cell for an entry; the cue and status lanes carry no text. */
function writeCellTextOfColumn(
  columnKey: TowerColumnKey,
  entry: TowerEntry,
  isLeader: boolean,
): string | undefined {
  switch (columnKey) {
    case 'pos':
      return String(entry.position);
    case 'car':
      return String(entry.carNumber);
    case 'laps':
      return String(entry.laps);
    case 'gap':
      return writeGapText(entry, isLeader);
    case 'interval':
      return writeIntervalText(entry.intervalMs, isLeader);
    case 'lastLap':
      return writeLapTimeText(entry.lastLapMs);
    case 'bestLap':
      return writeLapTimeText(entry.bestLapMs);
    case 'pitStops':
      return writeCountText(entry.pitStops);
    case 'fuelStops':
      return writeCountText(entry.fuelStops);
    default:
      return undefined;
  }
}

/**
 * Writes an entry into its row: the position (which belongs to the slot the row is in),
 * every cell's text, the team and school, the status (the attribute the styles dim by,
 * and the icon, drawn again only when the status changed) and the leader mark. Nothing
 * that did not change is touched.
 */
export function writeTowerRowFromEntry(row: TowerRow, entry: TowerEntry, isLeader: boolean): void {
  for (const [columnKey, cell] of row.cells) {
    const text = writeCellTextOfColumn(columnKey, entry, isLeader);
    if (text !== undefined) {
      writeTextIfChanged(cell, text);
    }
  }
  writeTextIfChanged(row.teamName, entry.teamName);
  writeTextIfChanged(row.schoolName, entry.schoolName);
  writeStatusIfChanged(row, entry.status);
  if (isLeader) {
    row.element.setAttribute('data-leader', '');
  } else {
    row.element.removeAttribute('data-leader');
  }
}

/** Writes the status attribute and redraws the icon, only when the status changed. */
function writeStatusIfChanged(row: TowerRow, status: PositionStatus): void {
  if (row.status === status) {
    return;
  }
  row.status = status;
  row.element.dataset.status = status;
  const statusCell = row.cells.get('status');
  if (statusCell !== undefined) {
    render(renderStatusIcon(status), statusCell);
  }
}

/**
 * Draws the ▲ or ▼ in the cue lane and colours the position cell (`is-up` / `is-down`),
 * tagged with the update that showed it, so the clear of an older update never takes
 * away a cue a newer update put on the same row.
 */
export function showCueOnRow(row: TowerRow, direction: CueDirection, cueMark: string): void {
  row.element.classList.remove('is-up', 'is-down');
  row.element.classList.add(direction === 'up' ? 'is-up' : 'is-down');
  row.element.dataset.cueMark = cueMark;
  const cueCell = row.cells.get('cue');
  if (cueCell !== undefined) {
    render(renderCueArrow(direction), cueCell);
  }
}

/** Takes the cue off a row when it was shown by the update `cueMark` names. */
export function clearCueOnRowOfUpdate(row: TowerRow, cueMark: string): void {
  if (row.element.dataset.cueMark !== cueMark) {
    return;
  }
  row.element.classList.remove('is-up', 'is-down');
  delete row.element.dataset.cueMark;
  const cueCell = row.cells.get('cue');
  if (cueCell !== undefined) {
    render(nothing, cueCell);
  }
}
