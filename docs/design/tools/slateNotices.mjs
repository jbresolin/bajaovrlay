// The notice slot (BAJAOVRLAY-43): the small transient cards under the sponsor bug, top-left,
// one at a time: the fastest lap, and a penalty or an incident from race direction. Each is
// one card like the clock's (a denser head, then rows) and never a coloured band, so a notice
// cannot be read as the clock's flag band. slateCataloguePages.mjs places them and
// slateCatalogueSheets.mjs shows every variant side by side.
import { escapeHtml, warningIcon } from './slateVocabulary.mjs';

// The school caption is optional: the penalty export names a school and no team, so its
// notices carry the school as the name and no caption.
function renderNoticeCar(car) {
  const school = car.schoolName
    ? `<span class="notice__school">${escapeHtml(car.schoolName)}</span>`
    : '';
  return `<span class="chip">${car.carNumber}</span>
    <span class="notice__team"><span class="notice__team-name">${escapeHtml(car.teamName)}</span>${school}</span>`;
}

/** The fastest lap: a green "MELHOR VOLTA" badge, the car, the time in green, the lap. */
export function renderFastestLap(fastestLap, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="fastest-lap"' : '';
  // The lap it was set on is optional: the positions shape has no lap number for a best lap.
  const lap =
    fastestLap.lap === undefined
      ? ''
      : `\n    <span class="caption">VOLTA ${fastestLap.lap}</span>`;
  return `<section class="card notice fastest-lap"${root}>
  <header class="notice__head">
    <span class="notice__badge notice__badge--best">MELHOR VOLTA</span>${lap}
  </header>
  <div class="notice__row">
    ${renderNoticeCar(fastestLap)}
    <span class="notice__time">${fastestLap.bestLapText}</span>
  </div>
</section>`;
}

const noticeKindWords = { penalty: 'PENALIDADE', incident: 'INCIDENTE' };

/**
 * A notice from race direction: the warning shape and the kind in the head with where it
 * happened (the export's track sector, "SETOR J"), the car, then the reason with the penalty
 * (optional) in a navy cell. No flag colour anywhere.
 */
export function renderPenaltyNotice(notice, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="penalty-notice"' : '';
  const penalty = notice.penalty
    ? `\n    <span class="notice__penalty">${escapeHtml(notice.penalty)}</span>`
    : '';
  const where = notice.sector ?? 'DIREÇÃO DE PROVA';
  return `<section class="card notice penalty-notice"${root} data-notice="${notice.kind}">
  <header class="notice__head">
    <span class="notice__badge notice__badge--warning">${warningIcon}<span>${noticeKindWords[notice.kind]}</span></span>
    <span class="caption">${escapeHtml(where)}</span>
  </header>
  <div class="notice__row">
    ${renderNoticeCar(notice)}
  </div>
  <div class="notice__row notice__row--reason">
    <span class="notice__reason">${escapeHtml(notice.reason)}</span>${penalty}
  </div>
</section>`;
}
