/**
 * The sessions board's DOM, drawn by Lit from the data and the slots on the board at a
 * moment (the design's `sessions-board` page, PR #21): the kit's head ("PROGRAMAÇÃO DO
 * DIA", the event, the date) over one 64 px pill per slot: the start's time of day, the
 * session, and its state at the right as a shape and a word.
 *
 * So that a state can crossfade on air (motion.md, "Sessions board"), each row holds its
 * three state layers stacked in one place, and two slates behind its content: the base
 * slate and the denser one that marks the slot in progress. Exactly one layer and one slate
 * are visible; the graphic sets which (sessionsBoardAnimations.ts) and crossfades them when
 * the status changes. Rows are keyed by slot id, so Lit keeps a slot's row (and the
 * opacities on it) across redraws.
 *
 * The shapes are inline SVG paths (a check mark, a play triangle, a hollow circle) in the
 * text's colour; the word beside each carries the meaning, so the shapes are hidden from
 * assistive technology.
 */
import { renderBoardHead } from '@bajaovrlay/graphics-kit/boardHead';
import { checkMarkShape } from '@bajaovrlay/graphics-kit/checkMarkShape';
import { writeTimeOfDayText } from '@bajaovrlay/graphics-kit/countdownText';
import type { ScheduleSlotStatus } from '@bajaovrlay/shared/scheduleSlotStatus';
import { html, svg, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { ptBR } from './ptBR.js';
import { listSessionsBoardHeadLines, type SessionsBoardData } from './sessionsBoardModel.js';
import type { SlotOnTheBoard } from './sessionsBoardWindow.js';

/** The three states, in the order their layers are stacked. */
export const sessionsBoardStatuses: ScheduleSlotStatus[] = ['finished', 'inProgress', 'upcoming'];

/** The shape of each state, as the design draws it (docs/design/tools/slateVocabulary.mjs). */
const statusShapes: Record<ScheduleSlotStatus, TemplateResult> = {
  // The check mark is the kit's, shared with the bracket's winner (BAJAOVRLAY-25).
  finished: checkMarkShape,
  inProgress: svg`<path d="M5 3.5v13l11-6.5z" fill="currentColor" />`,
  upcoming: svg`<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2.2" />`,
};

/** One state layer: its shape and its word, coloured by its own data-status. */
function renderStatusLayer(status: ScheduleSlotStatus): TemplateResult {
  return html`<span
    class="status-layer"
    data-status=${status}
    data-testid="sessions-board-status-${status}"
    ><svg class="status-icon" viewBox="0 0 20 20" aria-hidden="true">${statusShapes[status]}</svg
    ><span>${ptBR.statusWords[status]}</span></span
  >`;
}

/**
 * One slot's row: the list item Lit keys by slot id, holding the pill the animations move
 * (the two slates, the time, the session and the three state layers). The pill is never
 * the item itself: GSAP may take an element it moves out of the page and back (see the
 * kit's boardHead.ts), which would corrupt the keyed list's markers around an item.
 */
function renderSlotRow(slotOnTheBoard: SlotOnTheBoard): TemplateResult {
  const { slot } = slotOnTheBoard;
  return html`<li class="row-place" data-testid="sessions-board-row" data-slot-id=${slot.slotId}>
    <div class="session-row" data-testid="sessions-board-pill">
      <span class="slate base-slate" data-testid="sessions-board-base-slate"></span>
      <span class="slate live-slate" data-testid="sessions-board-live-slate"></span>
      <span class="session-time" data-testid="sessions-board-time"
        >${writeTimeOfDayText(slot.startsAtMs)}</span
      >
      <span class="session-name" data-testid="sessions-board-session">${slot.sessionName}</span>
      <span class="session-status">${sessionsBoardStatuses.map(renderStatusLayer)}</span>
    </div>
  </li>`;
}

/**
 * The board's markup for the data and the slots on the board; before load (no data yet)
 * an empty board, invisible until played. data-testid names are how code and tests find
 * parts.
 */
export function renderSessionsBoardTemplate(
  data: SessionsBoardData | undefined,
  slotsOnTheBoard: SlotOnTheBoard[],
): TemplateResult {
  if (data === undefined) {
    return html`<section class="board" data-testid="sessions-board"></section>`;
  }
  const headLines = listSessionsBoardHeadLines(data);
  return html`<section class="board" data-testid="sessions-board">
    ${renderBoardHead({
      testIdPrefix: 'sessions-board',
      logoAlternativeText: ptBR.logoAlternativeText,
      title: data.title,
      subtitle: headLines.eventLine,
      aside: headLines.dateLine,
    })}
    <ol class="rows" data-testid="sessions-board-rows">
      ${repeat(
        slotsOnTheBoard,
        (slotOnTheBoard) => slotOnTheBoard.slot.slotId,
        (slotOnTheBoard) => renderSlotRow(slotOnTheBoard),
      )}
    </ol>
  </section>`;
}

/** One row on the page and the parts of it a status change touches. */
export type SessionsBoardRowParts = {
  /** The pill: what the animations move and what carries data-status. */
  row: HTMLElement;
  slotId: string;
  baseSlate: HTMLElement;
  liveSlate: HTMLElement;
  statusLayers: Record<ScheduleSlotStatus, HTMLElement>;
};

/** Finds one part inside a row; a missing one is a bug in the template. */
function findPartOfRow(row: HTMLElement, testId: string): HTMLElement {
  const part = row.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (part === null) {
    throw new Error(`sessions board part "${testId}" is missing from a row; this is a bug`);
  }
  return part;
}

/** Finds the head card; undefined before load. */
export function findSessionsBoardHead(renderRoot: ParentNode): HTMLElement | undefined {
  return renderRoot.querySelector<HTMLElement>('[data-testid="sessions-board-head"]') ?? undefined;
}

/** Finds the board, which the theme's tokens are read from. */
export function findSessionsBoard(renderRoot: ParentNode): HTMLElement {
  const board = renderRoot.querySelector<HTMLElement>('[data-testid="sessions-board"]');
  if (board === null) {
    throw new Error('the sessions board is missing from the template; this is a bug');
  }
  return board;
}

/** Every row on the page with its parts, top to bottom. */
export function findSessionsBoardRows(renderRoot: ParentNode): SessionsBoardRowParts[] {
  const rows = [...renderRoot.querySelectorAll<HTMLElement>('[data-testid="sessions-board-row"]')];
  return rows.map((row) => ({
    row: findPartOfRow(row, 'sessions-board-pill'),
    slotId: row.dataset.slotId ?? '',
    baseSlate: findPartOfRow(row, 'sessions-board-base-slate'),
    liveSlate: findPartOfRow(row, 'sessions-board-live-slate'),
    statusLayers: {
      finished: findPartOfRow(row, 'sessions-board-status-finished'),
      inProgress: findPartOfRow(row, 'sessions-board-status-inProgress'),
      upcoming: findPartOfRow(row, 'sessions-board-status-upcoming'),
    },
  }));
}
