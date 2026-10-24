/**
 * The positions tower's DOM: the template Lit draws once (the tower, its head pill, the
 * list of rows), the head captions and the detailed grid written from the columns shown,
 * and the one function that makes the rows match a new list of visible entries. Rows are
 * one node per visible car, keyed by car number, reused across updates and never rebuilt;
 * when motion is wanted this module also takes the two layout measures FLIP needs (every
 * row's top before the DOM change and after it) and nothing else. Reads and writes are
 * kept apart: every measure of a pass happens before any write of that pass, so the
 * browser lays the page out once per measure and not once per row.
 */
import { html, type TemplateResult } from 'lit';

import type { CueDirection } from './cueArrows.js';
import {
  placePillsOffAir,
  type RowSlotShift,
  showPillsAtOnce,
} from './positionsTowerAnimations.js';
import type { TowerEntry, TowerSettings } from './positionsTowerModel.js';
import { ptBR } from './ptBR.js';
import {
  buildDetailedGridTemplate,
  buildDetailedTowerWidth,
  listColumnsShown,
  type TowerColumn,
} from './towerColumns.js';
import { diffVisibleRows } from './towerRowDiff.js';
import {
  createTowerRow,
  rebuildTowerRowCells,
  showCueOnRow,
  type TowerRow,
  writeTowerRowFromEntry,
} from './towerRows.js';

/** The elements the template draws once, and the element the theme's tokens are read from. */
export type PositionsTowerParts = {
  /**
   * The host element, in the page's light DOM: every token is read from its computed
   * style. Custom properties reach into the shadow root in a browser, but jsdom does not
   * inherit them across the shadow boundary, so reading them from the host keeps the
   * graphic and its tests reading the same values.
   */
  tokensSource: Element;
  tower: HTMLElement;
  head: HTMLElement;
  rows: HTMLOListElement;
};

/** The rows on the page, by car number; the component owns it and hands it in. */
export type TowerRowsByCarNumber = Map<number, TowerRow>;

/**
 * How new rows and leaving rows are placed:
 * - `offAir`: the tower is not on air; new rows are placed below their slot and invisible
 *   (the next play-in brings them in), leaving rows are removed at once, nothing is measured;
 * - `atOnce`: on air with skipAnimation; new rows are shown in place, leaving rows removed;
 * - `animated`: on air; tops are measured around the DOM change, leaving rows are taken
 *   out of flow where they were (so they can lift out without moving the others), new rows
 *   are placed below their slot and invisible, and the rows whose slot changed get their cue.
 */
export type RowPlacement = 'offAir' | 'atOnce' | 'animated';

/** What the component animates after `placeVisibleEntries` (empty unless `animated`). */
export type VisibleRowsChange = {
  rowsEntering: TowerRow[];
  /** Taken out of flow, still in the DOM: the component removes them once they lifted out. */
  rowsLeaving: TowerRow[];
  slotShifts: RowSlotShift[];
  cuedRows: Array<{ row: TowerRow; direction: CueDirection }>;
};

/** The tower's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderPositionsTowerTemplate(): TemplateResult {
  return html`
    <section class="tower" data-testid="positions-tower" data-layout="compact">
      <header class="pill head" data-testid="positions-tower-head"></header>
      <ol class="rows" data-testid="positions-tower-rows"></ol>
    </section>
  `;
}

/**
 * Finds every part in the rendered template; a missing one is a bug in the template.
 * `tokensSource` is the host element the tokens are read from.
 */
export function findPositionsTowerParts(
  renderRoot: ParentNode,
  tokensSource: Element,
): PositionsTowerParts {
  const findPart = <Part extends HTMLElement>(testId: string): Part => {
    const part = renderRoot.querySelector<Part>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`tower part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    tokensSource,
    tower: findPart('positions-tower'),
    head: findPart('positions-tower-head'),
    rows: findPart<HTMLOListElement>('positions-tower-rows'),
  };
}

/**
 * Dresses the tower for the settings: the layout mark the styles switch on, the head's
 * captions (one per column shown, the cue and status lanes blank), and for the detailed
 * layout the grid template and the width written from the width tokens. Answers the
 * columns shown, which the rows are built from.
 */
export function applyColumnsToTower(
  parts: PositionsTowerParts,
  settings: TowerSettings,
): TowerColumn[] {
  const columns = listColumnsShown(settings);
  parts.tower.dataset.layout = settings.layout;
  if (settings.layout === 'detailed') {
    parts.tower.style.setProperty('--detail-columns', buildDetailedGridTemplate(columns));
    parts.tower.style.setProperty('--tower-width', buildDetailedTowerWidth(columns));
  } else {
    parts.tower.style.removeProperty('--detail-columns');
    parts.tower.style.removeProperty('--tower-width');
  }
  const captions = columns.map((column) => {
    const caption = document.createElement('span');
    caption.className = `caption caption-${column.key}`;
    caption.textContent = ptBR.columnCaptions[column.key];
    return caption;
  });
  parts.head.replaceChildren(...captions);
  return columns;
}

/**
 * Makes every row's cells match the columns shown (a layout or column switch on air)
 * and writes every visible row again from its entry, so a cell the switch created
 * carries its text at once. Without the rewrite a switch during a page turn, when the
 * component applies nothing else, would leave the new cells empty until the next list.
 */
export function rebuildEveryRowForColumns(
  rows: TowerRowsByCarNumber,
  columns: TowerColumn[],
  visibleEntries: readonly TowerEntry[],
): void {
  for (const row of rows.values()) {
    rebuildTowerRowCells(row, columns);
  }
  for (const entry of visibleEntries) {
    const row = rows.get(entry.carNumber);
    if (row !== undefined) {
      writeTowerRowFromEntry(row, entry, entry.position === 1);
    }
  }
}

/**
 * Makes the rows match `entriesAfter`: keeps the row of every car still on the page
 * (moved to its new slot with `append`, which moves a node already in the list), creates
 * a row for every car arriving, takes the row of every car leaving, and writes every
 * row from its entry (the position number follows the slot). See RowPlacement for what
 * is measured and animated.
 */
export function placeVisibleEntries(
  parts: PositionsTowerParts,
  rows: TowerRowsByCarNumber,
  entriesBefore: readonly TowerEntry[],
  entriesAfter: readonly TowerEntry[],
  columns: TowerColumn[],
  placement: RowPlacement,
  cueMark: string,
): VisibleRowsChange {
  const diff = diffVisibleRows(entriesBefore, entriesAfter);
  const isAnimated = placement === 'animated';

  // FLIP's first measure: where every row is before anything changes. One read per row,
  // all before any write, so the browser lays the page out once.
  const listTopPx = isAnimated ? parts.rows.getBoundingClientRect().top : 0;
  const topBeforeByCarNumber = new Map<number, number>();
  if (isAnimated) {
    for (const row of rows.values()) {
      topBeforeByCarNumber.set(row.carNumber, row.element.getBoundingClientRect().top);
    }
  }

  const rowsLeaving: TowerRow[] = [];
  for (const carNumber of diff.leaving) {
    const row = rows.get(carNumber);
    if (row === undefined) {
      continue;
    }
    rows.delete(carNumber);
    if (!isAnimated) {
      row.element.remove();
      continue;
    }
    // Out of flow, pinned where it was: the other rows close up under it while it lifts.
    const topPx = (topBeforeByCarNumber.get(carNumber) ?? listTopPx) - listTopPx;
    row.element.classList.add('is-leaving');
    row.element.style.top = `${topPx}px`;
    rowsLeaving.push(row);
  }

  const rowsEntering: TowerRow[] = [];
  for (const entry of entriesAfter) {
    const existingRow = rows.get(entry.carNumber);
    const row = existingRow ?? createTowerRow(entry.carNumber, columns);
    if (existingRow === undefined) {
      rows.set(entry.carNumber, row);
      rowsEntering.push(row);
    }
    parts.rows.append(row.element);
    // The leader is the car in position 1, wherever the page starts: the first row of
    // page 2 is the 21st car, with a gap and no mark.
    const isLeader = entry.position === 1;
    writeTowerRowFromEntry(row, entry, isLeader);
  }

  // FLIP's second measure: where every staying row is now, read for every row before
  // the cue writes below so the browser lays the page out once, not once per cued row.
  const topAfterByCarNumber = new Map<number, number>();
  if (isAnimated) {
    for (const stayingRow of diff.staying) {
      const row = rows.get(stayingRow.carNumber);
      if (row !== undefined) {
        topAfterByCarNumber.set(stayingRow.carNumber, row.element.getBoundingClientRect().top);
      }
    }
  }

  const newRowElements = rowsEntering.map((row) => row.element);
  if (placement === 'atOnce') {
    showPillsAtOnce(newRowElements);
  } else {
    placePillsOffAir(parts.tokensSource, newRowElements);
  }

  if (!isAnimated) {
    return { rowsEntering, rowsLeaving, slotShifts: [], cuedRows: [] };
  }

  // The slides (the difference between the two measures) and the cues: writes only.
  const slotShifts: RowSlotShift[] = [];
  const cuedRows: VisibleRowsChange['cuedRows'] = [];
  for (const stayingRow of diff.staying) {
    const row = rows.get(stayingRow.carNumber);
    const topBeforePx = topBeforeByCarNumber.get(stayingRow.carNumber);
    const topAfterPx = topAfterByCarNumber.get(stayingRow.carNumber);
    if (row === undefined || topBeforePx === undefined || topAfterPx === undefined) {
      continue;
    }
    const shiftPx = topBeforePx - topAfterPx;
    if (shiftPx !== 0) {
      slotShifts.push({ element: row.element, shiftPx });
    }
    if (stayingRow.direction !== 'same') {
      showCueOnRow(row, stayingRow.direction, cueMark);
      cuedRows.push({ row, direction: stayingRow.direction });
    }
  }
  return { rowsEntering, rowsLeaving, slotShifts, cuedRows };
}
