/**
 * A round board (catalogue entry 4, bracket-passo-1 to -3): a draw sheet in two columns,
 * read down the left column then the right, each match one card with the two cars facing
 * each other across a "×": chips on the outer edges, the results meeting in the middle
 * like a football score line ("2 × 0"), so who runs against whom is never in doubt. The
 * gutter between the columns is wider than the gap between cards, so a row is never read
 * across. A bye's empty side is the dashed "SEM ADVERSÁRIO".
 *
 * Cards are keyed by match id, so Lit keeps a match's card across an update and its result
 * cell can crossfade in place.
 */
import { html, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import {
  renderCarChip,
  renderCarTeam,
  renderNoOpponentWords,
  renderResultCell,
  writeCarKey,
} from './bracketCarView.js';
import type { BracketMatchData } from './bracketModel.js';
import { type CarSide, describeResultOfCar } from './matchResults.js';
import { ptBR } from './ptBR.js';

/** One side of a card: chip, team, result on the left; result, team, chip on the right. */
function renderCardSide(match: BracketMatchData, side: CarSide): TemplateResult {
  const car = match[side];
  const result = describeResultOfCar(match, side);
  const sideName = side === 'carA' ? 'left' : 'right';
  if (car === undefined || result === undefined) {
    return html`<div class="card-side" data-side=${sideName} data-empty>
      ${renderNoOpponentWords()}
    </div>`;
  }
  const chip = renderCarChip(car);
  const team = renderCarTeam(car);
  const resultCell = renderResultCell(writeCarKey(match.matchId, side), result);
  const cells = side === 'carA' ? [chip, team, resultCell] : [resultCell, team, chip];
  return html`<div
    class="card-side"
    data-testid="bracket-card-side"
    data-side=${sideName}
    data-car-number=${car.carNumber}
    data-outcome=${result.outcome}
  >
    ${cells}
  </div>`;
}

/** One match card: the two sides across the "×". */
function renderMatchCard(match: BracketMatchData): TemplateResult {
  // The card GSAP moves sits alone in a holder with no box of its own (display: contents),
  // and the holder is what the repeat keeps: GSAP takes an element it thinks is off the page
  // (in jsdom always, in Chromium under a hidden ancestor) out to measure it and puts it
  // back before its next element sibling; a board's last card has none, so held directly it
  // went back past Lit's end marker and a redraw left it behind (gate 2 of PR #30). The
  // kit's boardHead.ts does the same for its head.
  return html`<div class="piece-holder">
    <div class="match-card" data-testid="bracket-match-card" data-match-id=${match.matchId}>
      ${renderCardSide(match, 'carA')}
      <span class="versus">${ptBR.versus}</span>
      ${renderCardSide(match, 'carB')}
    </div>
  </div>`;
}

/**
 * The board of one page's matches: two columns of half the matches each (the left one
 * holds the extra card of an odd page), filled down the left column first.
 */
export function renderRoundBoard(matches: BracketMatchData[]): TemplateResult {
  const rowsPerColumn = Math.ceil(matches.length / 2);
  return html`<div
    class="round-board"
    data-testid="bracket-round-board"
    style=${`--round-board-rows: ${String(rowsPerColumn)}`}
  >
    ${repeat(
      matches,
      (match) => match.matchId,
      (match) => renderMatchCard(match),
    )}
  </div>`;
}
