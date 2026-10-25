/**
 * The notice's DOM: the template Lit draws once, with the parts of both variants, and the
 * function that afterwards writes the data into it in place. Nothing is rebuilt: a part
 * the variant or the data has no use for is hidden (the `hidden` attribute), so an update
 * on air touches only text and attributes.
 */
import { writeTextIfChanged } from '@bajaovrlay/graphics-kit/textInPlace';
import { isTextGiven } from '@bajaovrlay/graphics-kit/textPresence';
import { html, type TemplateResult } from 'lit';

import type { NoticeAnimatedElements } from './noticeAnimations.js';
import { type NoticeData, readNoticeKind } from './noticeModel.js';
import { ptBR } from './ptBR.js';

/** The elements whose text or attributes change after the first render. */
export type NoticeParts = NoticeAnimatedElements & {
  bestLapBadge: HTMLElement;
  warningBadge: HTMLElement;
  kindWord: HTMLElement;
  headCaption: HTMLElement;
  carNumber: HTMLElement;
  team: HTMLElement;
  teamName: HTMLElement;
  schoolName: HTMLElement;
  lapTime: HTMLElement;
  reasonRow: HTMLElement;
  reason: HTMLElement;
  penalty: HTMLElement;
};

/**
 * The warning triangle of a penalty notice, the design's own drawing (penalty-notice.html).
 * It is drawn in `currentColor`, so it takes the head's text colour from the theme.
 */
function renderWarningTriangle(): TemplateResult {
  return html`
    <svg
      class="warning-icon"
      viewBox="0 0 20 20"
      role="img"
      aria-label=${ptBR.warningIconAlternativeText}
      data-testid="notice-warning-icon"
    >
      <path
        d="M10 2.4 18.6 17.2H1.4z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path d="M10 7.6v4.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="10" cy="14.4" r="1.2" fill="currentColor" />
    </svg>
  `;
}

/** The notice's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderNoticeTemplate(): TemplateResult {
  return html`
    <section class="notice-panel" data-testid="notice-panel">
      <header class="head">
        <span class="badge best-lap-badge" data-testid="notice-best-lap-badge"
          >${ptBR.fastestLapBadge}</span
        >
        <span class="badge warning-badge" data-testid="notice-warning-badge"
          >${renderWarningTriangle()}<span data-testid="notice-kind-word"></span
        ></span>
        <span class="caption" data-testid="notice-head-caption"></span>
      </header>
      <div class="row">
        <span class="chip" data-testid="notice-car-number"></span>
        <span class="team" data-testid="notice-team"
          ><span class="team-name" data-testid="notice-team-name"></span
          ><span class="school-name" data-testid="notice-school-name"></span
        ></span>
        <span class="lap-time" data-testid="notice-lap-time"></span>
      </div>
      <div class="row reason-row" data-testid="notice-reason-row">
        <span class="reason" data-testid="notice-reason"></span>
        <span class="penalty" data-testid="notice-penalty"></span>
      </div>
    </section>
  `;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findNoticeParts(renderRoot: ParentNode): NoticeParts {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`notice part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    panel: findPart('notice-panel'),
    bestLapBadge: findPart('notice-best-lap-badge'),
    warningBadge: findPart('notice-warning-badge'),
    kindWord: findPart('notice-kind-word'),
    headCaption: findPart('notice-head-caption'),
    carNumber: findPart('notice-car-number'),
    team: findPart('notice-team'),
    teamName: findPart('notice-team-name'),
    schoolName: findPart('notice-school-name'),
    lapTime: findPart('notice-lap-time'),
    reasonRow: findPart('notice-reason-row'),
    reason: findPart('notice-reason'),
    penalty: findPart('notice-penalty'),
  };
}

/** Shows an element with the text, or hides it (and empties it) when there is none. */
function showTextOrHide(element: HTMLElement, text: string | undefined): void {
  const isShown = text !== undefined;
  element.hidden = !isShown;
  writeTextIfChanged(element, isShown ? text : '');
}

/** Writes the head: the green badge and the lap, or the triangle, the kind and race control. */
function writeHead(parts: NoticeParts, data: NoticeData): void {
  const isFastestLap = data.variant === 'fastestLap';
  parts.bestLapBadge.hidden = !isFastestLap;
  parts.warningBadge.hidden = isFastestLap;
  writeTextIfChanged(parts.kindWord, ptBR.noticeKindWords[readNoticeKind(data)]);

  if (!isFastestLap) {
    showTextOrHide(parts.headCaption, ptBR.raceControlCaption);
    return;
  }
  const lapNumber = data.lapNumber;
  showTextOrHide(
    parts.headCaption,
    lapNumber === undefined ? undefined : ptBR.lapNumberCaption(lapNumber),
  );
}

/**
 * Writes the car row: the chip, the team with its school, and (fastest lap only) the time.
 * Without a team name the whole team block is hidden, school included: the school is a
 * caption of the team, and alone beside the chip it would read as the team's name.
 */
function writeCarRow(parts: NoticeParts, data: NoticeData): void {
  writeTextIfChanged(parts.carNumber, String(data.carNumber));

  const hasTeamName = isTextGiven(data.teamName);
  parts.team.hidden = !hasTeamName;
  showTextOrHide(parts.teamName, hasTeamName ? data.teamName : undefined);
  const hasSchoolName = hasTeamName && isTextGiven(data.schoolName);
  showTextOrHide(parts.schoolName, hasSchoolName ? data.schoolName : undefined);

  const isLapTimeShown = data.variant === 'fastestLap' && isTextGiven(data.lapTimeText);
  showTextOrHide(parts.lapTime, isLapTimeShown ? data.lapTimeText : undefined);
}

/**
 * Writes the reason row of a penalty notice: the reason and the navy penalty cell. The
 * row is there when either is given (a penalty with no reason still shows its cell), and
 * never on a fastest lap.
 */
function writeReasonRow(parts: NoticeParts, data: NoticeData): void {
  const isPenalty = data.variant === 'penalty';
  const reasonText = isPenalty && isTextGiven(data.reason) ? data.reason : undefined;
  const penaltyText = isPenalty && isTextGiven(data.penaltyText) ? data.penaltyText : undefined;
  showTextOrHide(parts.reason, reasonText);
  showTextOrHide(parts.penalty, penaltyText);
  parts.reasonRow.hidden = reasonText === undefined && penaltyText === undefined;
}

/**
 * Writes the whole notice from its data, in place: the variant mark the styles read, the
 * head, the car row and the reason row. Fields of the other variant are kept in the data
 * but not drawn (a lap time on a penalty, a reason on a fastest lap).
 */
export function writeNoticeData(parts: NoticeParts, data: NoticeData): void {
  parts.panel.dataset.variant = data.variant;
  writeHead(parts, data);
  writeCarRow(parts, data);
  writeReasonRow(parts, data);
}
