/**
 * The bracket's DOM, drawn by Lit from the data and the step on screen: the board, the
 * kit's wide head card, and under it the stage holding the step: a round board
 * (roundBoardView.ts), the tree (bracketTreeView.ts, laid out by treeLayout.ts), or nothing
 * (brackets with no round). Every piece the animations move is found here by its test id:
 * the board's match cards, the tree's round names, car slots and lines.
 */
import {
  findWideBoardHeadParts,
  renderWideBoardHeadTemplate,
  type WideBoardHeadParts,
} from '@bajaovrlay/graphics-kit/wideBoardHead';
import { html, nothing, type TemplateResult } from 'lit';

import type { BracketData } from './bracketModel.js';
import { describeStepOnScreen, describeTreeOfBracket } from './bracketStepView.js';
import { renderBracketTree } from './bracketTreeView.js';
import { ptBR } from './ptBR.js';
import { renderRoundBoard } from './roundBoardView.js';
import { layOutBracketTree, type TreeGeometry } from './treeLayout.js';

/** What the stage draws: the data on screen, its step, and the theme's sizes for the tree. */
export type BracketOnScreen = { data: BracketData; stepIndex: number; geometry: TreeGeometry };

/** The elements the template draws once, and the element the theme's tokens are read from. */
export type BracketParts = WideBoardHeadParts & {
  /**
   * The host element, in the page's light DOM: every token is read from its computed
   * style (jsdom does not inherit custom properties across the shadow boundary, so the
   * graphic and its tests read the same values this way).
   */
  tokensSource: Element;
  board: HTMLElement;
  stage: HTMLElement;
};

/** The pieces on the stage that move, by kind, each list in the order it cascades. */
export type PiecesOnScreen = {
  matchCards: HTMLElement[];
  roundNames: HTMLElement[];
  treeCarSlots: HTMLElement[];
  treeLines: SVGElement[];
};

/** The stage's content at the step on screen. */
function renderStageContent(onScreen: BracketOnScreen): TemplateResult | typeof nothing {
  const step = describeStepOnScreen(onScreen.data, onScreen.stepIndex);
  if (step.kind === 'headAlone') {
    return nothing;
  }
  if (step.kind === 'board') {
    return renderRoundBoard(step.matches);
  }
  const tree = describeTreeOfBracket(onScreen.data);
  const matchCounts = tree.columnRounds.map((round) => round.matches.length);
  const hasThirdPlace = tree.thirdPlaceRound !== undefined;
  const layout = layOutBracketTree(matchCounts, tree.columnCount, hasThirdPlace, onScreen.geometry);
  return renderBracketTree(tree, layout, step, {
    widthPx: onScreen.geometry.stageWidthPx,
    heightPx: onScreen.geometry.stageHeightPx,
  });
}

/**
 * The board's markup; before load (nothing on screen yet) the stage is empty. data-testid
 * names are how code and tests find parts.
 */
export function renderBracketTemplate(onScreen: BracketOnScreen | undefined): TemplateResult {
  return html`<section class="board" data-testid="bracket">
    ${renderWideBoardHeadTemplate('bracket', ptBR.logoAlternativeText)}
    <div class="stage" data-testid="bracket-stage">
      ${onScreen === undefined ? nothing : renderStageContent(onScreen)}
    </div>
  </section>`;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findBracketParts(renderRoot: ParentNode, tokensSource: Element): BracketParts {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`the bracket part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    tokensSource,
    board: findPart('bracket'),
    stage: findPart('bracket-stage'),
    ...findWideBoardHeadParts(renderRoot, 'bracket'),
  };
}

/**
 * Every moving piece on the stage now. The board's cards come down the left column then
 * the right (the DOM's order, which the grid flows by column); the tree's car slots column
 * by column, top to bottom.
 */
export function listPiecesOnScreen(parts: BracketParts): PiecesOnScreen {
  const stage = parts.stage;
  return {
    matchCards: [...stage.querySelectorAll<HTMLElement>('[data-testid="bracket-match-card"]')],
    roundNames: [...stage.querySelectorAll<HTMLElement>('[data-testid="bracket-round-name"]')],
    treeCarSlots: [...stage.querySelectorAll<HTMLElement>('[data-testid="bracket-tree-car-slot"]')],
    treeLines: [...stage.querySelectorAll<SVGElement>('[data-testid="bracket-tree-line"]')],
  };
}

/** Every moving piece on the stage, in one list. */
export function listEveryPieceOnScreen(parts: BracketParts): Element[] {
  const pieces = listPiecesOnScreen(parts);
  return [...pieces.matchCards, ...pieces.roundNames, ...pieces.treeCarSlots, ...pieces.treeLines];
}

/** Each result cell on the stage, by its car's key, with its signature (matchResults.ts). */
export function readResultSignaturesOnScreen(parts: BracketParts): Map<string, string> {
  const signatures = new Map<string, string>();
  const cells = parts.stage.querySelectorAll<HTMLElement>('[data-testid="bracket-result"]');
  for (const cell of cells) {
    const carKey = cell.dataset.carKey;
    const signature = cell.dataset.resultSignature;
    if (carKey !== undefined && signature !== undefined) {
      signatures.set(carKey, signature);
    }
  }
  return signatures;
}

/** The result cell of a car on the stage, by its key; undefined when it is not drawn. */
export function findResultCellOfCar(parts: BracketParts, carKey: string): HTMLElement | undefined {
  const cells = parts.stage.querySelectorAll<HTMLElement>('[data-testid="bracket-result"]');
  return [...cells].find((cell) => cell.dataset.carKey === carKey);
}
