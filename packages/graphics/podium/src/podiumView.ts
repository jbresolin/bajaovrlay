/**
 * The podium's DOM, drawn by Lit from the data: the board, the kit's head card, and the
 * three cards on one baseline, left to right the 2nd, the 1st (taller) and the 3rd. The
 * three card elements are always there, one per slot, whatever the list holds: a card not
 * yet revealed, or with no entry, keeps its room invisible, so the cards already shown
 * never move (motion.md). Lit keeps each card element across redraws, so the animations'
 * inline styles on it survive an update.
 *
 * Inside a card, the logo row exists only when the team has a logo (the team card's rule);
 * without it the card's content is simply shorter and stays centred in the card's height.
 * Images are `<img src>` and nothing else: an `<img>` runs no script, even for an SVG.
 */
import {
  type WideBoardHeadParts,
  findWideBoardHeadParts,
  renderWideBoardHeadTemplate,
} from '@bajaovrlay/graphics-kit/wideBoardHead';
import { renderTeamLogoCell } from '@bajaovrlay/graphics-kit/teamLogoCell';
import { html, nothing, type TemplateResult } from 'lit';

import {
  hasLogo,
  isLogoOnLightPlate,
  isPlaceOnTheLeaderChip,
  listPodiumCardsLeftToRight,
  type PodiumCard,
  type PodiumData,
  type PodiumEntry,
  type PodiumSlot,
  writePlaceText,
} from './podiumModel.js';
import { ptBR } from './ptBR.js';

/** The elements the template draws once, and the element the theme's tokens are read from. */
export type PodiumParts = WideBoardHeadParts & {
  /**
   * The host element, in the page's light DOM: every token is read from its computed
   * style (jsdom does not inherit custom properties across the shadow boundary, so the
   * graphic and its tests read the same values this way).
   */
  tokensSource: Element;
  board: HTMLElement;
  cardsBySlot: Record<PodiumSlot, HTMLElement>;
};

/** The logo row: the kit's logo cell, the logo whole inside its box, on the plate or not. */
function renderLogoRow(entry: PodiumEntry): TemplateResult {
  return renderTeamLogoCell({
    logoUrl: entry.logoUrl ?? '',
    alternativeText: ptBR.teamLogoAlternativeText(entry.teamName),
    isOnLightPlate: isLogoOnLightPlate(entry),
    cellTestId: 'podium-logo-cell',
    imageTestId: 'podium-logo',
  });
}

/** A card's content: the logo row when there is a logo, the place, the chip, the team, the school. */
function renderCardContent(entry: PodiumEntry): TemplateResult {
  return html`${hasLogo(entry) ? renderLogoRow(entry) : nothing}
    <span class="place" data-testid="podium-place" ?data-leader=${isPlaceOnTheLeaderChip(entry)}
      >${writePlaceText(entry)}</span
    >
    <span class="car-chip-large" data-testid="podium-car-number">${entry.carNumber}</span>
    <span class="team-name" data-testid="podium-team-name">${entry.teamName}</span>
    <span class="school-name" data-testid="podium-school-name">${entry.schoolName}</span>`;
}

/** One card: its slot and step marked for the styles and tests, empty past the list's end. */
function renderCard(card: PodiumCard): TemplateResult {
  return html`<div
    class="card"
    data-testid="podium-card"
    data-slot=${card.slot}
    data-revealed-at-step=${card.revealedAtStep}
    data-car-number=${card.entry === undefined ? '' : String(card.entry.carNumber)}
    ?data-empty=${card.entry === undefined}
  >
    ${card.entry === undefined ? nothing : renderCardContent(card.entry)}
  </div>`;
}

/**
 * The board's markup for the data; before load (no data yet) the three cards are there
 * empty. data-testid names are how code and tests find parts.
 */
export function renderPodiumTemplate(data: PodiumData | undefined): TemplateResult {
  const cards = listPodiumCardsLeftToRight(data?.entries ?? []);
  return html`<section class="board" data-testid="podium">
    ${renderWideBoardHeadTemplate('podium', ptBR.logoAlternativeText)}
    <div class="stage">
      <div class="cards" data-testid="podium-cards">${cards.map((card) => renderCard(card))}</div>
    </div>
  </section>`;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findPodiumParts(renderRoot: ParentNode, tokensSource: Element): PodiumParts {
  const board = renderRoot.querySelector<HTMLElement>('[data-testid="podium"]');
  if (board === null) {
    throw new Error('the podium board is missing from the template; this is a bug');
  }
  const findCard = (slot: PodiumSlot): HTMLElement => {
    const card = renderRoot.querySelector<HTMLElement>(
      `[data-testid="podium-card"][data-slot="${slot}"]`,
    );
    if (card === null) {
      throw new Error(`the podium card of slot "${slot}" is missing from the template; a bug`);
    }
    return card;
  };
  return {
    tokensSource,
    board,
    ...findWideBoardHeadParts(renderRoot, 'podium'),
    cardsBySlot: { second: findCard('second'), first: findCard('first'), third: findCard('third') },
  };
}

/** Whether a slot's card has an entry to show (a card past the list's end never shows). */
export function isCardOfSlotFilled(parts: PodiumParts, slot: PodiumSlot): boolean {
  return !parts.cardsBySlot[slot].hasAttribute('data-empty');
}
