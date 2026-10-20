// Writes every .html page of the "placar" direction beside itself from ../../sample-data.json,
// so no row is ever typed by hand and a fix regenerates every page at once. Run from the repo
// root: node docs/design/directions/placar/generatePages.mjs
import { readFileSync, writeFileSync } from 'node:fs';

// Paths are URLs relative to this script, so the generator runs from any working directory.
const sampleDataUrl = new URL('../../sample-data.json', import.meta.url);
const sample = JSON.parse(readFileSync(sampleDataUrl, 'utf8'));

// Layout budget (see README.md "Tower rows"): the compact tower runs from y 258 to y 1026 in
// 32px rows, the detailed tower from y 258 to y 1018 in 38px rows.
const COMPACT_ROWS = 24;
const DETAILED_ROWS = 20;
const STRIP_CARS_PER_PAGE = 10;

// Flag words beyond the two in sample-data.json come from the product's own pt-BR catalogue
// (packages/graphics/race-clock/src/ptBR.ts), so the sheet shows the words that go on air.
const flagWords = {
  pre: 'PRÉ-LARGADA',
  green: sample.session.flagLabel,
  yellow: sample.sessionYellow.flagLabel,
  red: 'VERMELHA',
  checkered: 'QUADRICULADA',
  finished: 'ENCERRADA',
};
const flagOrder = ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'];
// What each state means, for the reference sheet's labels (pt-BR only: the token keys above
// never appear on a sheet).
const flagStateLabels = {
  pre: 'antes da largada',
  green: 'bandeira verde',
  yellow: 'bandeira amarela',
  red: 'bandeira vermelha',
  checkered: 'bandeira quadriculada',
  finished: 'prova encerrada',
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Status icons: inline SVG, three different shapes, drawn with paths only (no <text>) so the
// glyph stays a glyph and the layout checker never reads it as small text.
const statusIcons = {
  inPit: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="No box"><rect x="1.5" y="1.5" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.25 14.75V5.25h3.25a2.6 2.6 0 0 1 0 5.2H7.25" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  stopped: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="Parado"><path d="M10 2.2 18.7 17.4H1.3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 7.6v4.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="14.8" r="1.3" fill="currentColor"/></svg>`,
  retired: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="Abandonou"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.6 15.4 15.4 4.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};
// The sheet names the shape beside the word, because shape (not colour) carries the meaning.
const statusShapeWords = { inPit: 'P num quadrado', stopped: 'triângulo', retired: 'círculo cortado' };
const statusIconLargeViewBox = (name) => statusIcons[name].replace('class="status-icon"', 'class="status-icon status-icon--large"');

function pageShell(title, bodyHtml, script = '') {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>placar — ${title}</title>
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

// ---------------------------------------------------------------- race clock

function renderFlagBand(flag, word) {
  return `<div class="flag-band flag-surface" data-flag="${flag}"><span class="flag-word">${escapeHtml(word)}</span></div>`;
}

function renderRaceClock(session, flag = session.flag, word = session.flagLabel) {
  return `<section class="race-clock plate" data-graphic="race-clock">
  <div class="race-clock__board spine">
    <div class="race-clock__session">${escapeHtml(session.sessionName)}</div>
    <div class="race-clock__time-row">
      <div class="race-clock__time">${session.timeRemaining}</div>
      <div class="race-clock__details">
        <div class="race-clock__caption">${escapeHtml(session.clockCaption)}</div>
        <div class="race-clock__laps">${escapeHtml(session.lapsLabel)}</div>
      </div>
    </div>
  </div>
  <div class="race-clock__flag">${renderFlagBand(flag, word)}</div>
</section>`;
}

// ---------------------------------------------------------------- towers

// Every row has an empty 16px cue lane right after its position cell: the ▲ / ▼ of a position
// change (motion.md) is drawn there, so it never sits on top of a two-digit position.
function renderCompactRow(car) {
  const leader = car.position === 1 ? ' data-leader' : '';
  return `    <li class="tower-row" data-row data-status="${car.status}"${leader}>
      <span class="tower-row__position">${car.position}</span>
      <span class="tower-row__cue"></span>
      <span class="tower-row__number">${car.carNumber}</span>
      <span class="tower-row__team">${escapeHtml(car.teamName)}</span>
      <span class="tower-row__laps">${car.laps}</span>
      <span class="tower-row__status">${statusIcons[car.status] ?? ''}</span>
    </li>`;
}

function renderCompactTower(cars, session, { withRoot = true } = {}) {
  const open = withRoot
    ? `<section class="tower tower--compact" data-graphic="positions-compact">`
    : `<section class="tower tower--compact">`;
  return `${open}
  <header class="tower__header">
    <span class="caption">POSIÇÕES</span>
    <span class="caption">VOLTA ${session.lapsCompletedByLeader}</span>
  </header>
  <ol class="tower__rows">
${cars.map(renderCompactRow).join('\n')}
  </ol>
</section>`;
}

const detailedHeaderCells = [
  ['position', 'POS'],
  ['cue', ''],
  ['number', 'Nº'],
  ['team', 'EQUIPE'],
  ['laps', 'VOLTAS'],
  ['gap', 'DIF.'],
  ['interval', 'INTERV.'],
  ['last-lap', 'ÚLT. VOLTA'],
  ['best-lap', 'MELHOR'],
  ['pit-stops', 'ABAST.'],
  ['status', ''],
];

function renderDetailedRow(car) {
  const leader = car.position === 1 ? ' data-leader' : '';
  return `    <li class="detail-row" data-row data-status="${car.status}"${leader}>
      <span class="detail-row__position">${car.position}</span>
      <span class="detail-row__cue"></span>
      <span class="detail-row__number">${car.carNumber}</span>
      <span class="detail-row__team"><span class="detail-row__team-name">${escapeHtml(car.teamName)}</span><span class="detail-row__school">${escapeHtml(car.schoolName)}</span></span>
      <span class="detail-row__laps">${car.laps}</span>
      <span class="detail-row__gap">${escapeHtml(car.gapText)}</span>
      <span class="detail-row__interval">${escapeHtml(car.intervalText)}</span>
      <span class="detail-row__last-lap">${escapeHtml(car.lastLapText)}</span>
      <span class="detail-row__best-lap">${escapeHtml(car.bestLapText)}</span>
      <span class="detail-row__pit-stops">${car.pitStops}</span>
      <span class="detail-row__status">${statusIcons[car.status] ?? ''}</span>
    </li>`;
}

function renderDetailedTower(cars, { withRoot = true } = {}) {
  const open = withRoot
    ? `<section class="tower tower--detailed" data-graphic="positions-detailed">`
    : `<section class="tower tower--detailed">`;
  const header = detailedHeaderCells
    .map(([column, label]) => `    <span class="detail-head__cell detail-head__cell--${column} caption">${label}</span>`)
    .join('\n');
  return `${open}
  <header class="tower__header detail-head">
${header}
  </header>
  <ol class="tower__rows">
${cars.map(renderDetailedRow).join('\n')}
  </ol>
</section>`;
}

// ---------------------------------------------------------------- lower strip

function renderStripCar(car) {
  const leader = car.position === 1 ? ' data-leader' : '';
  return `    <li class="strip-car" data-row data-status="${car.status}"${leader}>
      <div class="strip-car__head"><span class="strip-car__position">${car.position}</span><span class="strip-car__number">${car.carNumber}</span></div>
      <div class="strip-car__school">${escapeHtml(car.schoolName)}</div>
    </li>`;
}

function renderStripPage(cars) {
  return `  <ol class="lower-strip__cars">
${cars.map(renderStripCar).join('\n')}
  </ol>`;
}

function renderLowerStrip(cars, session, pageNumber, pageCount) {
  return `<section class="lower-strip plate spine" data-graphic="lower-strip">
  <div class="lower-strip__clock">
    <div class="lower-strip__session-and-time">
      <div class="lower-strip__session">${escapeHtml(session.sessionName)}</div>
      <div class="lower-strip__time">${session.timeRemaining}</div>
    </div>
    <div class="flag-cell flag-surface" data-flag="${session.flag}"><span class="flag-word">${escapeHtml(session.flagLabel)}</span></div>
  </div>
  <div class="lower-strip__pages">
${renderStripPage(cars)}
  </div>
  <div class="lower-strip__page-indicator">${pageNumber}/${pageCount}</div>
</section>`;
}

// ---------------------------------------------------------------- lower third and bug

function renderLowerThird(person) {
  const team = person.team
    ? `\n    <span class="lower-third__team">${escapeHtml(person.team)}</span>`
    : '';
  return `<section class="lower-third" data-graphic="lower-third">
  <div class="lower-third__name plate spine">${escapeHtml(person.name)}</div>
  <div class="lower-third__row">
    <span class="lower-third__role">${escapeHtml(person.role)}</span>${team}
  </div>
</section>`;
}

function renderSponsorBug(bug) {
  return `<section class="sponsor-bug spine" data-graphic="sponsor-bug">
  <div class="sponsor-bug__logo-cell plate"><img class="sponsor-bug__logo" src="../../../brand/logo-branca.png" alt="Baja SAE Brasil"></div>
  <div class="sponsor-bug__label">${escapeHtml(bug.eventLabel)}</div>
  <div class="sponsor-bug__sponsor plate">
    <span class="caption">${escapeHtml(bug.sponsorLine)}</span>
    <span class="sponsor-bug__sponsor-name">${escapeHtml(bug.sponsorName)}</span>
  </div>
</section>`;
}

// ---------------------------------------------------------------- reference sheets

function renderSheetFlags() {
  const cells = flagOrder
    .map((flag) => {
      const session = flag === 'yellow' ? sample.sessionYellow : sample.session;
      return `  <div class="sheet__cell">
    <div class="sheet__label">${flagStateLabels[flag]}</div>
${renderRaceClock(session, flag, flagWords[flag]).replace(' data-graphic="race-clock"', '')}
  </div>`;
    })
    .join('\n');
  return `<div class="sheet">
  <div class="sheet__title">placar · bandeiras — o relógio nos seis estados (folha de referência, não vai ao ar)</div>
  <div class="sheet__grid sheet__grid--flags">
${cells}
  </div>
</div>`;
}

function renderSheetStatus() {
  const byCar = (carNumber) => sample.positions.find((car) => car.carNumber === carNumber);
  const statusCars = [byCar(69), byCar(65), byCar(96)];
  const iconCells = statusCars
    .map((car) => `    <div class="sheet__icon-cell plate">
      <div class="sheet__icon-frame">${statusIconLargeViewBox(car.status)}</div>
      <div class="sheet__icon-caption"><span class="sheet__icon-label">${escapeHtml(car.statusLabel)}</span><span class="caption">${statusShapeWords[car.status]}</span></div>
    </div>`)
    .join('\n');
  return `<div class="sheet">
  <div class="sheet__title">placar · situação do carro — ícones e linhas reais (folha de referência, não vai ao ar)</div>
  <div class="sheet__icons">
${iconCells}
  </div>
  <div class="sheet__rows">
    <div class="sheet__cell">
      <div class="sheet__label">torre compacta · carros 69, 65 e 96</div>
${renderCompactTower(statusCars, sample.session, { withRoot: false })}
    </div>
    <div class="sheet__cell">
      <div class="sheet__label">torre detalhada · carros 69, 65 e 96</div>
${renderDetailedTower(statusCars, { withRoot: false })}
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------- motion demo

// The demo's script lives beside this file (motion-demo.js) and is loaded by a relative
// <script src>, so the page still loads nothing from the network.
function renderMotionDemo() {
  const pageOne = sample.positions.slice(0, STRIP_CARS_PER_PAGE);
  const pageTwo = sample.positions.slice(STRIP_CARS_PER_PAGE, STRIP_CARS_PER_PAGE * 2);
  const pageCount = Math.ceil(sample.positions.length / STRIP_CARS_PER_PAGE);
  const body = `<div class="demo-stage" data-demo="tower-set">
${renderRaceClock(sample.session)}
${renderCompactTower(sample.positions.slice(0, COMPACT_ROWS), sample.session)}
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
<div class="demo-caption plate"><span class="caption">demo de movimento</span><span class="demo-caption__step" id="demo-step">…</span></div>`;
  const script = `<script src="motion-demo.js"></script>
`;
  return pageShell('motion demo', body, script);
}

// ---------------------------------------------------------------- write everything

const compactCars = sample.positions.slice(0, COMPACT_ROWS);
const detailedCars = sample.positions.slice(0, DETAILED_ROWS);
const stripCars = sample.positions.slice(0, STRIP_CARS_PER_PAGE);
const stripPageCount = Math.ceil(sample.positions.length / STRIP_CARS_PER_PAGE);

const pages = {
  'race-clock.html': pageShell('race clock', renderRaceClock(sample.session)),
  'positions-compact.html': pageShell('positions compact', renderCompactTower(compactCars, sample.session)),
  'positions-detailed.html': pageShell('positions detailed', renderDetailedTower(detailedCars)),
  'lower-strip.html': pageShell('lower strip', renderLowerStrip(stripCars, sample.session, 1, stripPageCount)),
  'lower-third.html': pageShell('lower third', renderLowerThird(sample.people[0])),
  'sponsor-bug.html': pageShell('sponsor bug', renderSponsorBug(sample.sponsorBug)),
  'combo-tower.html': pageShell(
    'combo tower',
    [renderRaceClock(sample.session), renderCompactTower(compactCars, sample.session), renderSponsorBug(sample.sponsorBug)].join('\n'),
  ),
  'combo-strip.html': pageShell(
    'combo strip',
    [renderLowerStrip(stripCars, sample.session, 1, stripPageCount), renderLowerThird(sample.people[0])].join('\n'),
  ),
  'sheet-flags.html': pageShell('sheet flags', renderSheetFlags()),
  'sheet-status.html': pageShell('sheet status', renderSheetStatus()),
  'motion-demo.html': renderMotionDemo(),
};

for (const [fileName, html] of Object.entries(pages)) {
  writeFileSync(new URL(fileName, import.meta.url), html);
}
console.log(`wrote ${Object.keys(pages).length} pages beside generatePages.mjs`);
console.log(`compact rows ${COMPACT_ROWS}, detailed rows ${DETAILED_ROWS}, strip ${STRIP_CARS_PER_PAGE} cars/page (${stripPageCount} pages)`);
