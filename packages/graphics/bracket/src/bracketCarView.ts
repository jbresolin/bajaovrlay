/**
 * The pieces of one car of a match, drawn the same in a round board's card and in a tree
 * pill (catalogue entry 4): the car's chip, its team and school, and its result cell; and
 * the empty slot of a bye. The chip holds a green fill under the number, shown for the
 * winner, so a result arriving on air can fade the chip green rather than switch it
 * (bracketAnimations.ts); the loser is dimmed by the styles, from `data-outcome`.
 *
 * Each result cell carries its car's key (`matchId:carA`) and its signature
 * (matchResults.ts), which is how the graphic finds the cells an update changed.
 */
import { checkMarkShape } from '@bajaovrlay/graphics-kit/checkMarkShape';
import { html, nothing, type TemplateResult } from 'lit';

import type { BracketCarData } from './bracketModel.js';
import { type CarResult, type CarSide, writeResultSignature } from './matchResults.js';
import { ptBR } from './ptBR.js';

/** The key of one car of one match: what an update's cells are matched by. */
export function writeCarKey(matchId: string, side: CarSide): string {
  return `${matchId}:${side}`;
}

/** The car's chip: its number over a green fill that only the winner shows. */
export function renderCarChip(car: BracketCarData): TemplateResult {
  return html`<span class="chip" data-testid="bracket-car-number"
    ><span class="chip-winner-fill" data-testid="bracket-chip-winner-fill"></span
    ><span class="chip-number">${car.carNumber}</span></span
  >`;
}

/** The team and its school, side by side; a long team name is cut with an ellipsis. */
export function renderCarTeam(car: BracketCarData): TemplateResult {
  return html`<span class="team"
    ><span class="team-name" data-testid="bracket-team-name">${car.teamName}</span
    ><span class="school-name">${car.schoolName}</span></span
  >`;
}

/** What goes inside the result cell: the W.O. tag, the mark, a number, "—" or nothing. */
function renderResultContent(result: CarResult): TemplateResult | typeof nothing | string {
  switch (result.cell.kind) {
    case 'walkoverTag':
      return html`<span class="walkover-tag">${ptBR.walkoverTag}</span>`;
    case 'winnerMark':
      return html`<svg
        class="winner-mark"
        viewBox="0 0 20 20"
        role="img"
        aria-label=${ptBR.winnerMarkLabel}
      >
        ${checkMarkShape}
      </svg>`;
    case 'number':
      return result.cell.text;
    case 'dash':
      return ptBR.emptyMark;
    case 'blank':
      return nothing;
  }
}

/** The result cell of a car, keyed and signed for the crossfade of a result arriving. */
export function renderResultCell(carKey: string, result: CarResult): TemplateResult {
  return html`<span
    class="result"
    data-testid="bracket-result"
    data-car-key=${carKey}
    data-result-kind=${result.cell.kind}
    data-result-signature=${writeResultSignature(result)}
    >${renderResultContent(result)}</span
  >`;
}

/** The empty slot of a bye: no chip, no team, a dashed outline with its words. */
export function renderNoOpponentWords(): TemplateResult {
  return html`<span class="no-opponent" data-testid="bracket-no-opponent"
    >${ptBR.noOpponent}</span
  >`;
}
