/**
 * The lower strip's DOM: the bar Lit draws once (the kit's clock block, the pages box with
 * its two lanes of car pills, the page cell), and the functions that afterwards write the
 * cars, the page cell and the block's switch in place.
 *
 * Two lanes, because a page turn lifts the old pills away while the new ones rise into
 * the same places (motion.md, "The lower strip"): the new page is drawn on the lane that
 * is not on air, both move at once, and the lanes then trade roles, so the bar is never
 * empty. A lane reuses its pills by slot: a live update rewrites the texts of the pills on
 * air and adds or removes pills only when the page's length changed, never rebuilding the
 * rest.
 */
import {
  type ClockBlockParts,
  findClockBlockParts,
  renderClockBlockTemplate,
} from '@bajaovrlay/graphics-kit/clockBlock';
import {
  makeScrollingTextBox,
  writeScrollingTextIfChanged,
} from '@bajaovrlay/graphics-kit/scrollingTextBox';
import { writeTextIfChanged } from '@bajaovrlay/graphics-kit/textInPlace';
import { html, type TemplateResult } from 'lit';

import type { StripCar, StripCarColumns } from './lowerStripModel.js';
import { ptBR } from './ptBR.js';
import { writeGapText, writeLapsText } from './stripCarTexts.js';
import { writePageCellText } from './stripPages.js';

/** The elements of the bar that change after the first render. */
export type LowerStripParts = {
  bar: HTMLElement;
  clockBlock: ClockBlockParts;
  /** The two lanes of car pills, which trade roles at every page turn. */
  lanes: [HTMLOListElement, HTMLOListElement];
  pageCell: HTMLElement;
};

/** The bar's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderLowerStripTemplate(): TemplateResult {
  return html`<section
    class="lower-strip bar"
    data-testid="lower-strip-bar"
    data-clock-block="shown"
  >
    ${renderClockBlockTemplate()}
    <div class="pages">
      <ol class="cars" data-testid="lower-strip-lane" aria-label=${ptBR.carListName}></ol>
      <ol class="cars" data-testid="lower-strip-lane" aria-hidden="true"></ol>
    </div>
    <div class="page-cell" data-testid="lower-strip-page-cell"></div>
  </section>`;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findLowerStripParts(renderRoot: ParentNode): LowerStripParts {
  const bar = renderRoot.querySelector<HTMLElement>('[data-testid="lower-strip-bar"]');
  const pageCell = renderRoot.querySelector<HTMLElement>('[data-testid="lower-strip-page-cell"]');
  const lanes = [
    ...renderRoot.querySelectorAll<HTMLOListElement>('[data-testid="lower-strip-lane"]'),
  ];
  const [firstLane, secondLane] = lanes;
  if (bar === null || pageCell === null || firstLane === undefined || secondLane === undefined) {
    throw new Error('a part of the lower strip is missing from the template; this is a bug');
  }
  return {
    bar,
    clockBlock: findClockBlockParts(renderRoot),
    lanes: [firstLane, secondLane],
    pageCell,
  };
}

/** Builds one empty cell of a car pill, with its class and test id. */
function createCarPillCell(className: string, testId: string): HTMLSpanElement {
  const cell = document.createElement('span');
  cell.className = className;
  cell.dataset.testid = testId;
  return cell;
}

/**
 * Builds one empty car pill: the position, the car chip, the school, then the laps and the
 * gap to the leader (BAJAOVRLAY-81), in that order. The school is a scrolling box: a name
 * too long for the pill scrolls inside it (BAJAOVRLAY-55). The last two cells are hidden
 * until the item asks for them and the car has something to show.
 */
function createCarPill(): HTMLLIElement {
  const pill = document.createElement('li');
  pill.className = 'car';
  pill.dataset.testid = 'lower-strip-car';
  const schoolCell = createCarPillCell('school', 'lower-strip-car-school');
  makeScrollingTextBox(schoolCell);
  const lapsCell = createCarPillCell('laps', 'lower-strip-car-laps');
  const gapCell = createCarPillCell('gap', 'lower-strip-car-gap');
  lapsCell.hidden = true;
  gapCell.hidden = true;
  pill.append(
    createCarPillCell('position', 'lower-strip-car-position'),
    createCarPillCell('chip', 'lower-strip-car-number'),
    schoolCell,
    lapsCell,
    gapCell,
  );
  return pill;
}

/** Writes an optional cell: its text, and hidden when it has none, so it takes no room. */
function writeOptionalCell(cell: HTMLElement, text: string): void {
  writeTextIfChanged(cell, text);
  const isEmpty = text === '';
  if (cell.hidden !== isEmpty) {
    cell.hidden = isEmpty;
  }
}

/**
 * Writes one car into a pill: "1º" (the leader's on the green chip), the number, the
 * school, and the laps and gap the item asks for (stripCarTexts.ts).
 */
function writeCarIntoPill(pill: HTMLLIElement, car: StripCar, columns: StripCarColumns): void {
  const [positionCell, chipCell, schoolCell, lapsCell, gapCell] = pill.children;
  const isSchoolCellWhole = schoolCell instanceof HTMLElement;
  const areOptionalCellsWhole = lapsCell instanceof HTMLElement && gapCell instanceof HTMLElement;
  if (
    positionCell === undefined ||
    chipCell === undefined ||
    !isSchoolCellWhole ||
    !areOptionalCellsWhole
  ) {
    throw new Error('a car pill lost a cell; this is a bug in lowerStripView.ts');
  }
  const lapsText = writeLapsText(car, columns.isLapsShown);
  const gapText = writeGapText(car, columns.gapDisplay);
  writeTextIfChanged(positionCell, ptBR.positionWithOrdinal(car.position));
  writeTextIfChanged(chipCell, String(car.carNumber));
  writeScrollingTextIfChanged(schoolCell, car.schoolName);
  writeOptionalCell(lapsCell, lapsText);
  writeOptionalCell(gapCell, gapText);
  pill.toggleAttribute('data-leader', car.position === 1);
  const extraTexts = [lapsText, gapText].filter((text) => text !== '');
  pill.setAttribute(
    'aria-label',
    ptBR.carPillName(car.position, car.carNumber, car.schoolName, extraTexts),
  );
}

/**
 * Draws a page of cars on a lane, reusing its pills by slot, and answers the pills that
 * were added (which the caller places: off air, on air, or ready to rise).
 */
export function drawCarsOnLane(
  lane: HTMLOListElement,
  cars: readonly StripCar[],
  columns: StripCarColumns,
): HTMLElement[] {
  const pillsAdded: HTMLElement[] = [];
  while (lane.children.length < cars.length) {
    const pill = createCarPill();
    lane.append(pill);
    pillsAdded.push(pill);
  }
  while (lane.children.length > cars.length) {
    lane.lastElementChild?.remove();
  }
  for (const [index, car] of cars.entries()) {
    const pill = lane.children[index] as HTMLLIElement;
    writeCarIntoPill(pill, car, columns);
  }
  return pillsAdded;
}

/** Empties a lane, once the page it held has lifted away. */
export function emptyLane(lane: HTMLOListElement): void {
  lane.replaceChildren();
}

/** The pills on a lane, left to right. */
export function listPillsOfLane(lane: HTMLOListElement): HTMLElement[] {
  return [...lane.children] as HTMLElement[];
}

/**
 * Makes one lane the one on air for assistive technology: it is named the running order,
 * and the other is hidden from it (it is empty, or lifting away).
 */
export function markLaneOnAir(parts: LowerStripParts, laneIndex: 0 | 1): void {
  const laneOnAir = parts.lanes[laneIndex];
  const otherLane = parts.lanes[laneIndex === 0 ? 1 : 0];
  laneOnAir.removeAttribute('aria-hidden');
  laneOnAir.setAttribute('aria-label', ptBR.carListName);
  otherLane.removeAttribute('aria-label');
  otherLane.setAttribute('aria-hidden', 'true');
}

/** Writes the page cell: "1/6", named "página 1 de 6" for assistive technology. */
export function writePageCell(parts: LowerStripParts, pageNumber: number, pageCount: number): void {
  writeTextIfChanged(parts.pageCell, writePageCellText(pageNumber, pageCount));
  parts.pageCell.setAttribute('aria-label', ptBR.pageCellName(pageNumber, pageCount));
}
