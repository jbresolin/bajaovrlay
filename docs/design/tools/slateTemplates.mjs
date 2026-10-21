// The markup every "slate" direction shares. The directions compared at the gate of PR #19
// (ardosia, grafite, marinho) were siblings of the existing scoreboard
// (placarbaja.juansalles.com.br): the same graphics, the same elements in the same order, so
// a direction is its tokens.css, its styles.css and a few numbers (rows, cars per strip
// page), never its own copy of this file. A direction's generatePages.mjs calls buildPages()
// with those numbers and writes the result.
import {
  escapeHtml,
  flagOrder,
  flagStateLabels,
  flagWords,
  largeIcon,
  sample,
  statusIcons,
  statusShapeWords,
} from './slateVocabulary.mjs';

export { flagWords, sample };

const logoPath = '../../../brand/logo-branca.png';

function pageShell(direction, title, bodyHtml, script = '') {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${direction} — ${title}</title>
<link rel="stylesheet" href="../../fonts/fonts.css">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="styles.css">
</head>
<body>
${bodyHtml}
${script}</body>
</html>
`;
}

// ---------------------------------------------------------------- race clock (the header card)

// The checkered band carries no word (João's gate on PR #19): the pattern says it, and the
// word stays in the markup only as the band's accessible name.
function renderFlagWord(flag, word) {
  if (flag === 'checkered') {
    return '';
  }
  return `<span class="flag-word">${escapeHtml(word)}</span>`;
}

export function renderFlagBand(flag, word) {
  const label = flag === 'checkered' ? ` aria-label="${escapeHtml(word)}"` : '';
  return `<div class="race-clock__flag flag-surface" data-flag="${flag}"${label}>${renderFlagWord(flag, word)}</div>`;
}

export function renderFlagPill(flag, word, extraClass = '') {
  const label = flag === 'checkered' ? ` aria-label="${escapeHtml(word)}"` : '';
  const classes = ['flag-surface', 'flag-pill', extraClass].filter(Boolean).join(' ');
  return `<span class="${classes}" data-flag="${flag}"${label}>${renderFlagWord(flag, word)}</span>`;
}

// The existing scoreboard's header (logo + session name) becomes the race clock: the same
// head, then the time with its caption and the leader's laps, then the flag band. The band
// is optional (João's gate on PR #19): a session with no flag state shows the clock without it.
export function renderRaceClock(
  session,
  flag = session.flag,
  word = session.flagLabel,
  { withRoot = true, withFlag = true } = {},
) {
  const root = withRoot ? ' data-graphic="race-clock"' : '';
  const noFlagClass = withFlag ? '' : ' race-clock--no-flag';
  const band = withFlag ? `\n  ${renderFlagBand(flag, word)}` : '';
  return `<section class="card race-clock${noFlagClass}"${root}>
  <header class="race-clock__head">
    <img class="race-clock__logo" src="${logoPath}" alt="Baja SAE Brasil">
    <h1 class="race-clock__title">${escapeHtml(session.sessionName)}</h1>
  </header>
  <div class="race-clock__body">
    <span class="race-clock__caption">${escapeHtml(session.clockCaption)}</span>
    <span class="race-clock__time">${session.timeRemaining}</span>
    <span class="race-clock__laps">${escapeHtml(session.lapsLabel)}</span>
  </div>${band}
</section>`;
}

// ---------------------------------------------------------------- towers

// Every row has an empty cue lane right after its position: the ▲ / ▼ of a position change
// (motion.md) is drawn there, so it never sits on top of a two-digit position.
function renderCompactRow(car) {
  const leader = car.position === 1 ? ' data-leader' : '';
  return `    <li class="pill row" data-row data-status="${car.status}"${leader}>
      <span class="row__pos">${car.position}</span>
      <span class="row__cue"></span>
      <span class="row__car chip">${car.carNumber}</span>
      <span class="row__team">${escapeHtml(car.teamName)}</span>
      <span class="row__laps">${car.laps}</span>
      <span class="row__status">${statusIcons[car.status] ?? ''}</span>
    </li>`;
}

const compactColumns = [
  ['pos', 'POS'],
  ['cue', ''],
  ['car', 'Nº'],
  ['team', 'EQUIPE'],
  ['laps', 'VOLTAS'],
  ['status', ''],
];

export function renderCompactTower(cars, session, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="positions-compact"' : '';
  const header = compactColumns
    .map(([column, label]) => `    <span class="caption compact-head__${column}">${label}</span>`)
    .join('\n');
  return `<section class="tower tower--compact"${root}>
  <header class="pill pill--head tower__head compact-head">
${header}
  </header>
  <ol class="tower__rows">
${cars.map(renderCompactRow).join('\n')}
  </ol>
</section>`;
}

const detailedColumns = [
  ['pos', 'POS'],
  ['cue', ''],
  ['car', 'Nº'],
  ['team', 'EQUIPE'],
  ['laps', 'VOLTAS'],
  ['gap', 'DIF.'],
  ['interval', 'INTERV.'],
  ['last-lap', 'ÚLT. VOLTA'],
  ['best-lap', 'MELHOR'],
  ['pit-stops', 'ABAST.'],
  ['status', ''],
];

// The gap rule (docs/00-concept.md §8) writes "+19,0 s"; a direction set in a caps-only face
// cannot show a lowercase unit, so it asks for the tower's gaps without it ("+19,0").
let writeGap = (text) => text;

function renderDetailedRow(car) {
  const leader = car.position === 1 ? ' data-leader' : '';
  return `    <li class="pill row row--detailed" data-row data-status="${car.status}"${leader}>
      <span class="row__pos">${car.position}</span>
      <span class="row__cue"></span>
      <span class="row__car chip">${car.carNumber}</span>
      <span class="row__team"><span class="row__team-name">${escapeHtml(car.teamName)}</span><span class="row__school">${escapeHtml(car.schoolName)}</span></span>
      <span class="row__laps">${car.laps}</span>
      <span class="row__gap">${escapeHtml(writeGap(car.gapText))}</span>
      <span class="row__interval">${escapeHtml(writeGap(car.intervalText))}</span>
      <span class="row__last-lap">${escapeHtml(car.lastLapText)}</span>
      <span class="row__best-lap">${escapeHtml(car.bestLapText)}</span>
      <span class="row__pit-stops">${car.pitStops}</span>
      <span class="row__status">${statusIcons[car.status] ?? ''}</span>
    </li>`;
}

export function renderDetailedTower(cars, session, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="positions-detailed"' : '';
  const header = detailedColumns
    .map(([column, label]) => `    <span class="caption detail-head__${column}">${label}</span>`)
    .join('\n');
  return `<section class="tower tower--detailed"${root}>
  <header class="pill pill--head tower__head detail-head">
${header}
  </header>
  <ol class="tower__rows">
${cars.map(renderDetailedRow).join('\n')}
  </ol>
</section>`;
}

// ---------------------------------------------------------------- lower strip

// A strip cell is the compact row's first three cells (position, car chip, name) with the
// school as the short name, each cell its own pill like the tower rows.
function renderStripCar(car) {
  const leader = car.position === 1 ? ' data-leader' : '';
  return `    <li class="pill strip-car" data-row data-status="${car.status}"${leader}>
      <span class="strip-car__pos">${car.position}º</span>
      <span class="strip-car__car chip">${car.carNumber}</span>
      <span class="strip-car__school">${escapeHtml(car.schoolName)}</span>
    </li>`;
}

export function renderStripPage(cars) {
  return `  <ol class="lower-strip__cars">
${cars.map(renderStripCar).join('\n')}
  </ol>`;
}

export function renderLowerStrip(cars, session, pageNumber, pageCount, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="lower-strip"' : '';
  return `<section class="lower-strip"${root}>
  <div class="card lower-strip__clock">
    <span class="lower-strip__time">${session.timeRemaining}</span>
    ${renderFlagPill(session.flag, session.flagLabel, 'lower-strip__flag')}
  </div>
  <div class="lower-strip__pages">
${renderStripPage(cars)}
  </div>
  <div class="card lower-strip__page">${pageNumber}/${pageCount}</div>
</section>`;
}

// ---------------------------------------------------------------- lower third and bug

export function renderLowerThird(person) {
  const chip = person.carNumber
    ? `<span class="chip lower-third__car">${person.carNumber}</span>`
    : '';
  const team = person.team
    ? `<span class="lower-third__team">${escapeHtml(person.team)}</span>`
    : '';
  return `<section class="lower-third" data-graphic="lower-third">
  <div class="card lower-third__name">${escapeHtml(person.name)}</div>
  <div class="card lower-third__role">${chip}<span class="lower-third__role-text">${escapeHtml(person.role)}</span>${team}</div>
</section>`;
}

export function renderSponsorBug(bug) {
  return `<section class="card sponsor-bug" data-graphic="sponsor-bug">
  <img class="sponsor-bug__logo" src="${logoPath}" alt="Baja SAE Brasil">
  <span class="sponsor-bug__label">${escapeHtml(bug.eventLabel)}</span>
  <span class="sponsor-bug__sponsor"><span class="caption">${escapeHtml(bug.sponsorLine)}</span><span class="sponsor-bug__sponsor-name">${escapeHtml(bug.sponsorName)}</span></span>
</section>`;
}

// ---------------------------------------------------------------- reference sheets

function renderSheetFlags(direction) {
  const clocks = flagOrder
    .map((flag) => {
      const session = flag === 'yellow' ? sample.sessionYellow : sample.session;
      return `    <div class="sheet__cell">
      <div class="sheet__label">${flagStateLabels[flag]}</div>
${renderRaceClock(session, flag, flagWords[flag], { withRoot: false })}
    </div>`;
    })
    .join('\n');
  const pills = flagOrder.map((flag) => renderFlagPill(flag, flagWords[flag])).join('\n      ');
  const withoutFlag = `    <div class="sheet__cell">
      <div class="sheet__label">sem bandeira (a faixa é opcional)</div>
${renderRaceClock(sample.session, sample.session.flag, sample.session.flagLabel, { withRoot: false, withFlag: false })}
    </div>`;
  return `<div class="sheet">
  <div class="sheet__title">${direction} · bandeiras — o relógio nos seis estados e sem bandeira (folha de referência, não vai ao ar)</div>
  <div class="sheet__grid sheet__grid--flags">
${clocks}
${withoutFlag}
  </div>
  <div class="sheet__label">a pílula da faixa inferior nos seis estados</div>
  <div class="card sheet__pills">
      ${pills}
  </div>
</div>`;
}

function renderSheetStatus(direction) {
  const byCar = (carNumber) => sample.positions.find((car) => car.carNumber === carNumber);
  const statusCars = [byCar(69), byCar(65), byCar(96)];
  const icons = statusCars
    .map(
      (car) => `    <div class="card sheet__icon-cell">
      <div class="sheet__icon-frame">${largeIcon(car.status)}</div>
      <div class="sheet__icon-caption"><span class="sheet__icon-label">${escapeHtml(car.statusLabel)}</span><span class="caption">${statusShapeWords[car.status]}</span></div>
    </div>`,
    )
    .join('\n');
  return `<div class="sheet">
  <div class="sheet__title">${direction} · situação do carro — três formas numa coluna fixa; a forma carrega o significado, nunca só a cor (folha de referência, não vai ao ar)</div>
  <div class="sheet__icons">
${icons}
  </div>
  <div class="sheet__rows">
    <div class="sheet__cell">
      <div class="sheet__label">linhas da torre compacta · carro 69 no box, 65 quebrado, 96 abandonou (linha esmaecida)</div>
${renderCompactTower(statusCars, sample.session, { withRoot: false })}
    </div>
    <div class="sheet__cell">
      <div class="sheet__label">as mesmas linhas na torre detalhada</div>
${renderDetailedTower(statusCars, sample.session, { withRoot: false })}
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------- motion demo

function renderMotionDemo(direction, options) {
  const { compactRows, stripCarsPerPage } = options;
  const pageOne = sample.positions.slice(0, stripCarsPerPage);
  const pageTwo = sample.positions.slice(stripCarsPerPage, stripCarsPerPage * 2);
  const pageCount = Math.ceil(sample.positions.length / stripCarsPerPage);
  const body = `<div class="demo-stage" data-demo="tower-set">
${renderRaceClock(sample.session)}
${renderCompactTower(sample.positions.slice(0, compactRows), sample.session)}
${renderSponsorBug(sample.sponsorBug)}
</div>
<div class="demo-stage" data-demo="strip-set">
${renderLowerStrip(pageOne, sample.session, 1, pageCount)}
${renderLowerThird(sample.people[0])}
</div>
<template id="strip-page-two">
${renderStripPage(pageTwo)}
</template>
<template id="strip-page-one">
${renderStripPage(pageOne)}
</template>
<template id="yellow-flag-band">
${renderFlagBand(sample.sessionYellow.flag, sample.sessionYellow.flagLabel)}
</template>
<template id="green-flag-band">
${renderFlagBand(sample.session.flag, sample.session.flagLabel)}
</template>
<template id="cue-up"><svg class="cue" viewBox="0 0 14 10" aria-hidden="true"><path d="M7 0 14 10H0Z" fill="currentColor"/></svg></template>
<template id="cue-down"><svg class="cue" viewBox="0 0 14 10" aria-hidden="true"><path d="M0 0h14L7 10Z" fill="currentColor"/></svg></template>
<div class="card demo-caption"><span class="caption">demo de movimento</span><span class="demo-caption__step" id="demo-step">…</span></div>`;
  // The demo script is shared by the three directions and reads every timing from tokens.css.
  const script = `<script src="../../tools/slateMotionDemo.js"></script>
`;
  return pageShell(direction, 'motion demo', body, script);
}

// ---------------------------------------------------------------- everything

/**
 * Builds every page of one direction: a map of file name to HTML. Options: name (the folder
 * name), compactRows, detailedRows, stripCarsPerPage, and gapUnit ('s' keeps "+19,0 s",
 * 'none' writes "+19,0" for a caps-only face).
 */
export function buildPages(options) {
  const { name, compactRows, detailedRows, stripCarsPerPage, gapUnit = 's' } = options;
  writeGap = gapUnit === 'none' ? (text) => text.replace(/ s$/, '') : (text) => text;
  const compactCars = sample.positions.slice(0, compactRows);
  const detailedCars = sample.positions.slice(0, detailedRows);
  const stripCars = sample.positions.slice(0, stripCarsPerPage);
  const stripPageCount = Math.ceil(sample.positions.length / stripCarsPerPage);
  const shell = (title, body) => pageShell(name, title, body);

  return {
    'race-clock.html': shell('race clock', renderRaceClock(sample.session)),
    'race-clock-sem-bandeira.html': shell(
      'race clock without the flag',
      renderRaceClock(sample.session, sample.session.flag, sample.session.flagLabel, {
        withFlag: false,
      }),
    ),
    'positions-compact.html': shell(
      'positions compact',
      renderCompactTower(compactCars, sample.session),
    ),
    'positions-detailed.html': shell(
      'positions detailed',
      renderDetailedTower(detailedCars, sample.session),
    ),
    'lower-strip.html': shell(
      'lower strip',
      renderLowerStrip(stripCars, sample.session, 1, stripPageCount),
    ),
    'lower-third.html': shell('lower third', renderLowerThird(sample.people[0])),
    'sponsor-bug.html': shell('sponsor bug', renderSponsorBug(sample.sponsorBug)),
    'combo-tower.html': shell(
      'combo tower',
      [
        renderRaceClock(sample.session),
        renderCompactTower(compactCars, sample.session),
        renderSponsorBug(sample.sponsorBug),
      ].join('\n'),
    ),
    'combo-strip.html': shell(
      'combo strip',
      [
        renderLowerStrip(stripCars, sample.session, 1, stripPageCount),
        renderLowerThird(sample.people[0]),
      ].join('\n'),
    ),
    'sheet-flags.html': shell('sheet flags', renderSheetFlags(name)),
    'sheet-status.html': shell('sheet status', renderSheetStatus(name)),
    'motion-demo.html': renderMotionDemo(name, options),
  };
}
