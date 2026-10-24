// The cards of the catalogue (BAJAOVRLAY-43): the team card, the battle card, the QR card,
// the countdown card, the message ticker and the corner sponsor roll. Each is the slate card
// or pill language of slateTemplates.mjs applied to one more graphic; the notices are in
// slateNotices.mjs, the boards in slateBoards.mjs, the stepped graphics in slateSteps.mjs.
import { logoPath, renderStripClock } from './slateTemplates.mjs';
import { escapeHtml, renderLogo, trendIcons } from './slateVocabulary.mjs';

/** "33 VOLTAS", "1 VOLTA": the laps as the clock writes them. */
function lapsWords(laps) {
  return laps === 1 ? '1 VOLTA' : `${laps} VOLTAS`;
}

// ---------------------------------------------------------------- team card

// The photo cell, the logo cell and the city are written only when the team has them (the
// entity library, BAJAOVRLAY-19, will say); without them the card is the chip, the name and
// the school under it, and nothing is left empty.
export function renderTeamCard(team, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="team-card"' : '';
  const photo = team.photoPath
    ? `\n  <div class="team-card__photo" role="img" aria-label="Foto do carro ${team.carNumber}" style="background-image: url('${team.photoPath}')"></div>`
    : '';
  const logo = team.logo ? `\n  ${renderLogo(team.logo, 'team-card__logo')}` : '';
  const city = team.city
    ? `\n      <span class="team-card__city">${escapeHtml(team.city)}</span>`
    : '';
  return `<section class="card team-card"${root}>${photo}
  <div class="team-card__identity">
    <div class="team-card__title">
      <span class="chip chip--large">${team.carNumber}</span>
      <span class="team-card__name">${escapeHtml(team.teamName)}</span>
    </div>
    <div class="team-card__details">
      <span class="team-card__school">${escapeHtml(team.schoolName)}</span>${city}
    </div>
  </div>${logo}
</section>`;
}

// ---------------------------------------------------------------- battle card

const trendWords = { closing: 'FECHANDO', opening: 'ABRINDO', steady: 'ESTÁVEL' };

function renderBattleCar(car) {
  const leader = car.position === 1 ? ' data-leader' : '';
  return `  <div class="pill battle-car" data-row${leader}>
    <span class="row__pos">${car.position}</span>
    <span class="chip">${car.carNumber}</span>
    <span class="battle-car__team"><span class="battle-car__name">${escapeHtml(car.teamName)}</span><span class="battle-car__school">${escapeHtml(car.schoolName)}</span></span>
    <span class="battle-car__laps">${lapsWords(car.laps)}</span>
  </div>`;
}

/** "FECHANDO −0,7", "ABRINDO +0,6", "ESTÁVEL": the trend's word and, unless steady, its change. */
export function writeTrendWords(trend, changeText) {
  if (trend === 'steady') return trendWords.steady;
  return `${trendWords[trend]} ${changeText}`;
}

/** The trend cell: its shape and its words, its colour set by its own data-trend. */
export function renderTrendCell(trend, words) {
  return `<span class="battle-gap__trend" data-trend="${trend}">${trendIcons[trend]}<span class="battle-gap__trend-words">${escapeHtml(words)}</span></span>`;
}

/**
 * Two cars for one place with the gap between them. The trend is one of closing, opening or
 * steady: a word, the change since a lap ago and a shape, so it reads in a still frame.
 */
export function renderBattleCard(battle, trend, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="battle-card"' : '';
  return `<section class="battle-card"${root}>
${renderBattleCar(battle.ahead)}
  <div class="card battle-gap">
    <span class="battle-gap__value">${battle.gapText}</span>
    ${renderTrendCell(trend, writeTrendWords(trend, battle.trends[trend]))}
  </div>
${renderBattleCar(battle.behind)}
</section>`;
}

// ---------------------------------------------------------------- QR card

// A placeholder code drawn from the sample's module rows (buildSampleData.mjs), one square per
// "1", with a one-module quiet zone; it does not scan. The real card takes a real code.
function renderQrPlaceholder(modules) {
  const size = modules.length;
  const squares = [];
  modules.forEach((line, row) => {
    [...line].forEach((bit, column) => {
      if (bit === '1') squares.push(`M${column} ${row}h1v1h-1z`);
    });
  });
  return `<svg class="qr-card__code" viewBox="-1 -1 ${size + 2} ${size + 2}" role="img" aria-label="QR code (modelo)"><path d="${squares.join('')}" fill="currentColor"/></svg>`;
}

/** The QR card: the code on the one light surface, the call to action and the address. */
export function renderQrCard(qr, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="qr-card"' : '';
  return `<section class="card qr-card"${root}>
  ${renderQrPlaceholder(qr.modules)}
  <div class="qr-card__text">
    <span class="qr-card__call">${escapeHtml(qr.callToAction)}</span>
    <span class="qr-card__url">${escapeHtml(qr.url)}</span>
  </div>
</section>`;
}

// ---------------------------------------------------------------- countdown card

/** The race clock's card without the band, counting down to the next session's start. */
export function renderCountdownCard(countdown, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="countdown"' : '';
  return `<section class="card race-clock race-clock--no-flag countdown"${root}>
  <header class="race-clock__head">
    <img class="race-clock__logo" src="${logoPath}" alt="Baja SAE Brasil">
    <h1 class="race-clock__title">${escapeHtml(countdown.sessionName)}</h1>
  </header>
  <div class="race-clock__body">
    <span class="race-clock__caption">LARGADA EM</span>
    <span class="race-clock__time">${countdown.remainingText}</span>
    <span class="race-clock__laps countdown__start">ÀS ${countdown.startTimeText}</span>
  </div>
</section>`;
}

// ---------------------------------------------------------------- message ticker

/**
 * The strip's bar carrying one production message per page, with the strip's clock block,
 * which is optional (withClock: false when the race clock card is up, or between sessions).
 */
export function renderMessageTicker(
  messages,
  session,
  pageNumber,
  { withRoot = true, withClock = true } = {},
) {
  const root = withRoot ? ' data-graphic="message-ticker"' : '';
  const noClockClass = withClock ? '' : ' message-ticker--no-clock';
  const clock = withClock ? `\n${renderStripClock(session)}` : '';
  return `<section class="lower-strip message-ticker${noClockClass}"${root}>${clock}
  <div class="message-ticker__pages">
    <div class="pill pill--head message-ticker__label"><span class="caption">AVISO</span></div>
    <div class="pill message-ticker__message">${escapeHtml(messages[pageNumber - 1])}</div>
  </div>
  <div class="card lower-strip__page">${pageNumber}/${messages.length}</div>
</section>`;
}

// ---------------------------------------------------------------- sponsor roll, corner

/** The corner roll's sponsor cell: one sponsor's mark and name under the sponsor line. */
export function renderSponsorRollCornerCell(bug, sponsor) {
  return `<div class="sponsor-roll-corner__sponsor">
    <span class="caption">${escapeHtml(sponsor.levelHeading)}</span>
    ${renderLogo(sponsor.logo, 'sponsor-bug__sponsor-logo')}
  </div>`;
}

/** The bug's card with one sponsor's level and logo in place of the sponsor line. */
export function renderSponsorRollCorner(bug, sponsor, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="sponsor-roll-corner"' : '';
  return `<section class="card sponsor-bug sponsor-roll-corner"${root}>
  <img class="sponsor-bug__logo" src="${logoPath}" alt="Baja SAE Brasil">
  <span class="sponsor-bug__label">${escapeHtml(bug.eventLabel)}</span>
  ${renderSponsorRollCornerCell(bug, sponsor)}
</section>`;
}
