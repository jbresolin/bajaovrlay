/**
 * Test support shared by the bracket's tests: the element under test, loading it like a
 * renderer, the theme's tokens the bracket reads, and readers of what is on the stage. No
 * theme token is placed on the page unless a test places it, so every timeline lasts 0 ms
 * and a test never waits on real motion unless it asks for it.
 */
import { onTestFinished } from 'vitest';

import BracketGraphic from './bracket.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-bracket-under-test', BracketGraphic);

// jsdom lays nothing out, so every element's offsetParent is null. GSAP reads that as "not
// in the page" the first time it parses an element's transform (the rise's `y`), moves the
// element to the document to measure it and puts it back before its next element sibling;
// the last card of a board has none, so it went back after Lit's end marker, out of Lit's
// reach, and a redraw left it behind (17 cards on a board of 16). In Chromium a card on the
// page always has an offsetParent and GSAP never moves it. Answering the parent, as a laid
// out page would, keeps the DOM the tests read the one Lit drew.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.parentElement;
  },
});

/**
 * Puts a fresh bracket element on the page, as a renderer does before calling load. When
 * the test ends it is disposed and removed, so nothing runs into the next test.
 */
export function createBracketOnThePage(): BracketGraphic {
  const bracket = document.createElement('baja-bracket-under-test') as BracketGraphic;
  document.body.append(bracket);
  onTestFinished(async () => {
    await bracket.dispose();
    bracket.remove();
  });
  return bracket;
}

/** Loads the bracket the way an OBS renderer does: real-time, at 1920x1080. */
export function loadBracketWithData(bracket: BracketGraphic, data: unknown) {
  return bracket.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Every element of a test id inside the shadow root, in the DOM's order. */
export function findEveryPartOfBracket(bracket: BracketGraphic, testId: string): HTMLElement[] {
  return [
    ...(bracket.shadowRoot?.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`) ?? []),
  ];
}

/** One part by its test id; undefined when absent. */
export function findPartOfBracket(
  bracket: BracketGraphic,
  testId: string,
): HTMLElement | undefined {
  return findEveryPartOfBracket(bracket, testId)[0];
}

/**
 * Whether a piece is shown now: GSAP's autoAlpha leaves a shown piece at opacity 1 and
 * visibility inherit, a hidden one at opacity 0 and visibility hidden.
 */
export function isPieceShown(piece: Element | undefined): boolean {
  const style = (piece as HTMLElement | SVGElement | undefined)?.style;
  return style?.opacity === '1' && style.visibility !== 'hidden';
}

/** What is on the stage, in words a reader checks against the design pages. */
export function describeTheStage(bracket: BracketGraphic) {
  const shownCards = findEveryPartOfBracket(bracket, 'bracket-match-card').filter(isPieceShown);
  const shownTreeMatches = findEveryPartOfBracket(bracket, 'bracket-tree-match').filter((match) =>
    [...match.querySelectorAll('[data-testid="bracket-tree-car-slot"]')].every(isPieceShown),
  );
  return {
    eventLine: findPartOfBracket(bracket, 'bracket-event-line')?.textContent ?? '',
    stepLine: findPartOfBracket(bracket, 'bracket-page-line')?.textContent ?? '',
    boardCards: shownCards.length,
    treeColumnsShown: [...new Set(shownTreeMatches.map((match) => match.dataset.column))],
    shownLines: findEveryPartOfBracket(bracket, 'bracket-tree-line').filter(isPieceShown).length,
  };
}

/** The result cell of a car by its key ("final:carA"). */
export function findResultCellOfCar(
  bracket: BracketGraphic,
  carKey: string,
): HTMLElement | undefined {
  return findEveryPartOfBracket(bracket, 'bracket-result').find(
    (cell) => cell.dataset.carKey === carKey,
  );
}

/** The motion tokens of Ardósia the bracket reads, as packages/theme/ardosia/tokens.css declares them. */
export const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-row-stagger': '30ms',
  '--motion-lead': '100ms',
  '--motion-flag': '300ms',
  '--motion-in-offset': '20',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
};

/** The tree's sizes in Ardósia, as packages/theme/ardosia/tokens.css declares them. */
export const ardosiaTreeTokenDeclarations: Record<string, string> = {
  '--board-stage-width': '1728px',
  '--board-stage-height': '900px',
  '--bracket-column-gap': '96px',
  '--head-height': '32px',
  '--stack-gap': '8px',
  '--bracket-row-height': '48px',
  '--row-gap': '3px',
};

/**
 * Puts tokens on :root, as the renderer page does, and takes them off again when the test
 * ends so a test without a theme reads nothing.
 */
export function placeTokensOnTheRoot(tokenDeclarations: Record<string, string>): void {
  const root = document.documentElement;
  for (const [tokenName, value] of Object.entries(tokenDeclarations)) {
    root.style.setProperty(tokenName, value);
  }
  onTestFinished(() => {
    for (const tokenName of Object.keys(tokenDeclarations)) {
      root.style.removeProperty(tokenName);
    }
  });
}
