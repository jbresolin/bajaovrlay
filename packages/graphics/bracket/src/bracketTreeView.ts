/**
 * The tree (catalogue entry 4, bracket-passo-4 to -7): one column per round under its name
 * pill, each match two stacked car pills, the lines between the rounds, and the third place
 * at the foot of the final's column under its own name pill, with no line into it. Every
 * position comes from treeLayout.ts; this file only draws them.
 *
 * At a step the tree draws every round's name (from its first step), the matches of the
 * rounds shown so far, the lines leading into those rounds, and the third place's match
 * once its step has come. What a step has not reached is left out, not hidden, so nothing
 * already shown moves when the next step comes. Each piece carries its column
 * (`data-column`: 0, 1…, or "third"), which is how the animations pick a step's pieces.
 */
import { html, nothing, svg, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import {
  renderCarChip,
  renderCarTeam,
  renderNoOpponentWords,
  renderResultCell,
  writeCarKey,
} from './bracketCarView.js';
import type { BracketMatchData, BracketRoundData } from './bracketModel.js';
import type { TreeOfBracket } from './bracketStepView.js';
import { type CarSide, describeResultOfCar } from './matchResults.js';
import type { TreeLayout, TreeLine } from './treeLayout.js';

/** Which of the tree's pieces a step shows. */
export type TreeStepShown = { treeRoundsShown: number; isThirdPlaceShown: boolean };

/** A piece's place on the stage, as an inline style. */
function writePlacement(leftPx: number, topPx: number, widthPx: number): string {
  return `left: ${String(leftPx)}px; top: ${String(topPx)}px; width: ${String(widthPx)}px`;
}

/** One car pill of a match in the tree, in its slot (the slot is what rises in). */
function renderTreeCar(match: BracketMatchData, side: CarSide, column: string): TemplateResult {
  const car = match[side];
  const result = describeResultOfCar(match, side);
  const pill =
    car === undefined || result === undefined
      ? html`<div class="tree-car" data-empty>${renderNoOpponentWords()}</div>`
      : html`<div
          class="tree-car"
          data-testid="bracket-tree-car"
          data-car-number=${car.carNumber}
          data-outcome=${result.outcome}
        >
          ${renderCarChip(car)} ${renderCarTeam(car)}
          ${renderResultCell(writeCarKey(match.matchId, side), result)}
        </div>`;
  return html`<div class="tree-car-slot" data-testid="bracket-tree-car-slot" data-column=${column}>
    ${pill}
  </div>`;
}

/** One match: its two car pills, at its place. */
function renderTreeMatch(
  match: BracketMatchData,
  column: string,
  placement: string,
): TemplateResult {
  return html`<div
    class="tree-match"
    data-testid="bracket-tree-match"
    data-match-id=${match.matchId}
    data-column=${column}
    style=${placement}
  >
    ${renderTreeCar(match, 'carA', column)} ${renderTreeCar(match, 'carB', column)}
  </div>`;
}

/** A round's name pill. */
function renderRoundName(roundName: string, column: string, placement: string): TemplateResult {
  return html`<div
    class="round-name"
    data-testid="bracket-round-name"
    data-column=${column}
    style=${placement}
  >
    ${roundName}
  </div>`;
}

/** A line as an SVG path through its four points. */
function renderLine(line: TreeLine): TemplateResult {
  const [start, ...rest] = line.points;
  if (start === undefined) {
    return svg``;
  }
  const pathData = [`M${String(start.xPx)} ${String(start.yPx)}`]
    .concat(rest.map((point) => `L${String(point.xPx)} ${String(point.yPx)}`))
    .join(' ');
  return svg`<path data-testid="bracket-tree-line" data-into-column=${String(line.intoColumnIndex)} d=${pathData} />`;
}

/** The tree at one step: names, the rounds shown, their lines, the third place. */
export function renderBracketTree(
  tree: TreeOfBracket,
  layout: TreeLayout,
  shown: TreeStepShown,
  stageSize: { widthPx: number; heightPx: number },
): TemplateResult {
  const linesShown = layout.lines.filter((line) => line.intoColumnIndex < shown.treeRoundsShown);
  const viewBox = `0 0 ${String(stageSize.widthPx)} ${String(stageSize.heightPx)}`;

  // Every column's name from the first step, a round still to come's included (contract B).
  const names = tree.columnNames.map((roundName, columnIndex) => {
    const column = layout.columns[columnIndex];
    return column === undefined
      ? nothing
      : renderRoundName(
          roundName,
          String(columnIndex),
          writePlacement(column.leftPx, 0, column.widthPx),
        );
  });

  const matchesShown = tree.columnRounds
    .slice(0, shown.treeRoundsShown)
    .flatMap((round, columnIndex) =>
      round.matches.map((match, matchIndex) => ({ match, columnIndex, matchIndex })),
    );

  const thirdPlace = layout.thirdPlace;
  const thirdPlaceRound = tree.thirdPlaceRound;
  const thirdPlaceMatch = thirdPlaceRound?.matches[0];
  const thirdPlaceName =
    thirdPlace === undefined || thirdPlaceRound === undefined
      ? nothing
      : renderRoundName(
          thirdPlaceRound.name,
          'third',
          writePlacement(thirdPlace.leftPx, thirdPlace.nameTopPx, thirdPlace.widthPx),
        );
  const thirdPlaceMatchShown =
    thirdPlace === undefined || thirdPlaceMatch === undefined || !shown.isThirdPlaceShown
      ? nothing
      : renderTreeMatch(
          thirdPlaceMatch,
          'third',
          writePlacement(thirdPlace.leftPx, thirdPlace.topPx, thirdPlace.widthPx),
        );

  return html`<div class="tree" data-testid="bracket-tree">
    <svg class="tree-lines" viewBox=${viewBox} aria-hidden="true">
      ${linesShown.map((line) => renderLine(line))}
    </svg>
    ${names} ${thirdPlaceName}
    ${repeat(
      matchesShown,
      (shownMatch) => shownMatch.match.matchId,
      (shownMatch) => {
        const column = layout.columns[shownMatch.columnIndex];
        const placed = column?.matches[shownMatch.matchIndex];
        if (column === undefined || placed === undefined) {
          return nothing;
        }
        const placement = writePlacement(column.leftPx, placed.topPx, column.widthPx);
        return renderTreeMatch(shownMatch.match, String(shownMatch.columnIndex), placement);
      },
    )}
    ${thirdPlaceMatchShown}
  </div>`;
}
