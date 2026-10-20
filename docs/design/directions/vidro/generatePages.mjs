// Writes every HTML page of the "vidro" direction (the single graphics, the combos, the two
// reference sheets and the motion demo) beside itself from ../../sample-data.json, so no row
// is ever typed by hand. Run from the repo root: node docs/design/directions/vidro/generatePages.mjs
import { readFileSync, writeFileSync } from 'node:fs';

// Every graphic is rendered by one function; the single pages, the combo pages, the
// reference sheets and the motion demo all call the same function, so the markup never
// drifts between them. tokens.css, styles.css, README.md and motion.md are written by hand.
const data = JSON.parse(readFileSync(new URL('../../sample-data.json', import.meta.url), 'utf8'));

// Row counts measured against the title-safe area (see README.md "Tower rows" and "The
// lower strip").
const COMPACT_ROW_COUNT = 22;
const DETAILED_ROW_COUNT = 18;
const STRIP_CARS_PER_PAGE = 4;
// The strip's room (y 950..1026) covers the compact tower's last two rows, so when both are
// on air the operator takes the tower with 20 rows; the motion demo does the same.
const COMPACT_ROWS_UNDER_STRIP = 2;

// The green and yellow words come from the sample; the other four states have no sample
// row, so their words are copied from the race-clock package's pt-BR catalogue
// (packages/graphics/race-clock/src/ptBR.ts), the one source the product already has.
const flagWords = {
  pre: 'PRÉ-LARGADA',
  green: data.session.flagLabel,
  yellow: data.sessionYellow.flagLabel,
  red: 'VERMELHA',
  checkered: 'QUADRICULADA',
  finished: 'ENCERRADA',
};

// How the reference sheet names each state (pt-BR only: the sheet is read by João, not by
// the code, so no token key appears on it).
const flagStateNames = {
  pre: 'Pré-largada',
  green: 'Bandeira verde',
  yellow: 'Bandeira amarela',
  red: 'Bandeira vermelha',
  checkered: 'Bandeira quadriculada',
  finished: 'Prova encerrada',
};

// Operator-facing column labels (pt-BR, from the design contract), not data.
const labels = {
  positions: 'POSIÇÕES',
  lap: 'VOLTA',
  pos: 'POS',
  carNumber: 'Nº',
  team: 'EQUIPE',
  laps: 'VOLTAS',
  gap: 'DIF.',
  interval: 'INTERV.',
  lastLap: 'ÚLT. VOLTA',
  bestLap: 'MELHOR',
  pitStops: 'ABAST.',
};

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ---------- Small parts ----------

// The strip's pill carries its word at the strip's 28px floor (`.flag-pill--strip`).
function renderFlagPill(flag, isForStrip = false) {
  const sizeClass = isForStrip ? ' flag-pill--strip' : '';
  return `<span class="flag-pill${sizeClass}" data-flag="${flag}"><span class="flag-word">${escapeHtml(flagWords[flag])}</span></span>`;
}

// Three different shapes in a fixed column: the shape carries the meaning, never the colour.
function renderStatusIcon(status, label, extraClass = '') {
  // aria-label instead of a <title> child: a <title> is a 16px text node to the layout checker.
  const open = `<svg class="status-icon${extraClass}" viewBox="0 0 20 20" role="img" aria-label="${escapeHtml(label)}">`;
  if (status === 'inPit') {
    return `${open}<rect x="1.5" y="1.5" width="17" height="17" rx="4"/><path d="M7.5 14.5V5.5h3.25a2.75 2.75 0 0 1 0 5.5H7.5"/></svg>`;
  }
  if (status === 'stopped') {
    return `${open}<path d="M10 2.5 18.5 17h-17z"/><path d="M10 7.5v4"/><circle cx="10" cy="14.25" r="1" fill="currentColor" stroke="none"/></svg>`;
  }
  if (status === 'retired') {
    return `${open}<circle cx="10" cy="10" r="8"/><path d="m4.6 4.6 10.8 10.8"/></svg>`;
  }
  return '';
}

// The leader has no gap and no interval. An em dash anchors the two columns on row 1; two
// blank cells there read as missing data.
function renderGapCell(text, { isMuted = false } = {}) {
  if (text === '') {
    return `<span class="cell-number cell-muted number">—</span>`;
  }
  const mutedClass = isMuted ? ' cell-muted' : '';
  return `<span class="cell-number${mutedClass} number">${escapeHtml(text)}</span>`;
}

// ---------- Graphics ----------

function renderRaceClock(session, { onAir = true, flag = session.flag } = {}) {
  const root = onAir ? ' data-graphic="race-clock"' : '';
  return `<section class="glass race-clock"${root}>
  <div class="clock-session"><span class="live-dot"></span><span class="caption-lg truncate">${escapeHtml(session.sessionName)}</span></div>
  <div class="clock-caption caption">${escapeHtml(session.clockCaption)}</div>
  <div class="clock-time number">${escapeHtml(session.timeRemaining)}</div>
  <div class="clock-foot"><span class="clock-laps number">${escapeHtml(session.lapsLabel)}</span>${renderFlagPill(flag)}</div>
</section>`;
}

function renderCompactRow(car) {
  const leaderClass = car.position === 1 ? ' row--leader' : '';
  return `    <div class="row${leaderClass}" data-row data-status="${car.status}">
      <span class="row-pos number">${car.position}</span>
      <span class="row-car number">${car.carNumber}</span>
      <span class="row-name truncate">${escapeHtml(car.teamName)}</span>
      <span class="row-laps number">${car.laps}</span>
      <span class="row-status">${renderStatusIcon(car.status, car.statusLabel)}</span>
    </div>`;
}

function renderCompactTower(cars, session, { onAir = true } = {}) {
  const root = onAir ? ' data-graphic="positions-compact"' : '';
  return `<section class="glass tower tower--compact"${root}>
  <header class="tower-header"><span class="caption-lg">${labels.positions}</span><span class="caption-lg number">${labels.lap} ${session.lapsCompletedByLeader}</span></header>
${cars.map(renderCompactRow).join('\n')}
</section>`;
}

function renderDetailedRow(car) {
  const leaderClass = car.position === 1 ? ' row--leader' : '';
  return `    <div class="row${leaderClass}" data-row data-status="${car.status}">
      <span class="row-pos number">${car.position}</span>
      <span class="row-car number">${car.carNumber}</span>
      <span class="row-team"><span class="row-name truncate">${escapeHtml(car.teamName)}</span><span class="row-school">${escapeHtml(car.schoolName)}</span></span>
      <span class="cell-number cell-strong number">${car.laps}</span>
      ${renderGapCell(car.gapText)}
      ${renderGapCell(car.intervalText, { isMuted: true })}
      <span class="cell-number number">${escapeHtml(car.lastLapText)}</span>
      <span class="cell-number cell-muted number">${escapeHtml(car.bestLapText)}</span>
      <span class="cell-number cell-muted number">${car.pitStops}</span>
      <span class="row-status">${renderStatusIcon(car.status, car.statusLabel)}</span>
    </div>`;
}

function renderDetailedTower(cars, { onAir = true } = {}) {
  const root = onAir ? ' data-graphic="positions-detailed"' : '';
  return `<section class="glass tower tower--detailed"${root}>
  <header class="tower-header">
    <span class="caption hdr-right">${labels.pos}</span>
    <span class="caption hdr-center">${labels.carNumber}</span>
    <span class="caption">${labels.team}</span>
    <span class="caption hdr-right">${labels.laps}</span>
    <span class="caption hdr-right">${labels.gap}</span>
    <span class="caption hdr-right">${labels.interval}</span>
    <span class="caption hdr-right">${labels.lastLap}</span>
    <span class="caption hdr-right">${labels.bestLap}</span>
    <span class="caption hdr-right">${labels.pitStops}</span>
    <span></span>
  </header>
${cars.map(renderDetailedRow).join('\n')}
</section>`;
}

// The leader's cell gets the green position pill, like the leader row of the towers.
function renderStripCell(car) {
  const leaderClass = car.position === 1 ? ' strip-cell--leader' : '';
  return `      <div class="strip-cell${leaderClass}" data-row data-status="${car.status}">
        <span class="strip-pos number">${car.position}</span>
        <span class="strip-car number">${car.carNumber}</span>
        <span class="strip-school truncate">${escapeHtml(car.schoolName)}</span>
      </div>`;
}

// The strip shows one page of STRIP_CARS_PER_PAGE cars. With `withPageLayers`, the motion
// demo gets the first two pages stacked so it can crossfade between them.
function renderLowerStrip(session, cars, { withPageLayers = false } = {}) {
  const pageCount = Math.ceil(cars.length / STRIP_CARS_PER_PAGE);
  const pageOne = cars.slice(0, STRIP_CARS_PER_PAGE);
  const pageTwo = cars.slice(STRIP_CARS_PER_PAGE, STRIP_CARS_PER_PAGE * 2);
  const cells = withPageLayers
    ? `    <div class="strip-page" data-page="1">\n${pageOne.map(renderStripCell).join('\n')}\n    </div>\n    <div class="strip-page strip-page--hidden" data-page="2">\n${pageTwo.map(renderStripCell).join('\n')}\n    </div>`
    : pageOne.map(renderStripCell).join('\n');
  // The capsule is the time and the flag pill only: the session name would be the one
  // string under the strip's 28px floor, and the clock card already carries it.
  return `<section class="glass lower-strip" data-graphic="lower-strip">
  <div class="strip-clock">
    <span class="strip-time number">${escapeHtml(session.timeRemaining)}</span>
    ${renderFlagPill(session.flag, true)}
  </div>
  <div class="strip-cells">
${cells}
  </div>
  <div class="strip-pages number"><span class="strip-page-index">1</span>/${pageCount}</div>
</section>`;
}

function renderLowerThird(person) {
  const teamLine = person.team === '' ? '' : `\n  <div class="lt-team"><span class="truncate">${escapeHtml(person.team)}</span></div>`;
  return `<section class="glass lower-third" data-graphic="lower-third">
  <div class="lt-name truncate">${escapeHtml(person.name)}</div>
  <div class="lt-role truncate">${escapeHtml(person.role)}</div>${teamLine}
</section>`;
}

function renderSponsorBug(sponsor) {
  return `<section class="glass-light sponsor-bug" data-graphic="sponsor-bug">
  <img class="bug-logo" src="../../../brand/logo-colorida.png" alt="Baja SAE Brasil">
  <div class="bug-text"><span class="bug-line">${escapeHtml(sponsor.sponsorLine)}</span><span class="bug-name">${escapeHtml(sponsor.sponsorName)}</span></div>
</section>`;
}

// ---------- Pages ----------

function renderPage(title, body, { extraHead = '', script = '' } = {}) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="../../fonts/fonts.css">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="styles.css">${extraHead}
</head>
<body>
${body}${script}
</body>
</html>
`;
}

function sheetItem(left, top, inner) {
  return `<div class="sheet-item" style="left:${left}px;top:${top}px">\n${inner}\n</div>`;
}

function renderFlagSheet() {
  const states = ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'];
  const columns = [96, 600, 1104];
  const rows = [80, 352];
  const cards = states.map((flag, index) => {
    const session = flag === 'yellow' ? data.sessionYellow : data.session;
    const left = columns[index % 3];
    const top = rows[Math.floor(index / 3)];
    const inner = `${renderRaceClock(session, { onAir: false, flag })}\n<div class="sheet-label">${escapeHtml(flagStateNames[flag])}</div>`;
    return sheetItem(left, top, inner);
  });
  const stripPills = states.map((flag) => renderFlagPill(flag, true)).join('\n  ');
  const pillRow = sheetItem(96, 664, `<div class="sheet-label" style="margin:0 0 12px">Pílula da faixa inferior (palavra de 28px)</div>\n<div class="glass" style="display:flex;gap:16px;padding:20px;width:max-content">\n  ${stripPills}\n</div>`);
  return renderPage(
    'vidro — bandeiras',
    `<div class="sheet">\n<div class="sheet-title">Relógio de prova — os seis estados de bandeira</div>\n${cards.join('\n')}\n${pillRow}\n</div>`,
  );
}

function renderStatusSheet() {
  const byCarNumber = (carNumber) => data.positions.find((car) => car.carNumber === carNumber);
  const sampleCars = [byCarNumber(69), byCarNumber(65), byCarNumber(96)];
  const shapeNotes = { inPit: 'P em quadrado arredondado', stopped: 'triângulo', retired: 'círculo com barra' };
  const icons = sampleCars.map((car, index) =>
    sheetItem(96 + index * 232, 72, `<div class="glass sheet-icon">${renderStatusIcon(car.status, car.statusLabel, ' status-icon--large')}<div class="sheet-label">${escapeHtml(car.statusLabel)}<br>${shapeNotes[car.status]}</div></div>`),
  );
  const compact = sheetItem(96, 328, `<div class="sheet-label" style="margin:0 0 12px">Linhas compactas: carro 69 no box, carro 65 parado, carro 96 abandonou (esmaecido)</div>\n${renderCompactTower(sampleCars, data.session, { onAir: false })}`);
  const detailed = sheetItem(96, 560, `<div class="sheet-label" style="margin:0 0 12px">Linhas detalhadas, os mesmos três carros</div>\n${renderDetailedTower(sampleCars, { onAir: false })}`);
  return renderPage(
    'vidro — status',
    `<div class="sheet">\n<div class="sheet-title">Ícones de status — forma e posição carregam o significado</div>\n${icons.join('\n')}\n${compact}\n${detailed}\n</div>`,
  );
}

function renderMotionDemo() {
  const demoRowCount = COMPACT_ROW_COUNT - COMPACT_ROWS_UNDER_STRIP;
  const body = [
    renderRaceClock(data.session),
    renderCompactTower(data.positions.slice(0, demoRowCount), data.session),
    renderLowerStrip(data.session, data.positions, { withPageLayers: true }),
    renderLowerThird(data.people[0]),
    `<aside class="glass demo-note">
  <div class="caption">demo de movimento · repete a cada 9 s</div>
  <ol class="demo-list">
    <li>0,0 s — entrada: relógio, ${demoRowCount} linhas da torre (escalonadas 14 ms), faixa, lower third</li>
    <li>1,8 s — troca de bandeira: transição de cor 250 ms + pulso de escala</li>
    <li>3,2 s — troca P3/P4: FLIP 450 ms, brilho verde em quem subiu, azul em quem desceu</li>
    <li>4,8 s — página 1 → 2 da faixa: crossfade 300 ms com deslize de 8 px</li>
    <li>6,4 s — bandeira volta ao verde</li>
    <li>7,6 s — saída: 200 ms ease-in, depois reinicia</li>
  </ol>
  <div class="demo-footnote">A torre tem ${demoRowCount} linhas aqui, não ${COMPACT_ROW_COUNT}: a faixa ocupa y 950..1026, onde ficariam as linhas ${demoRowCount + 1} e ${COMPACT_ROW_COUNT}, e o operador tira essas duas quando a faixa está no ar.</div>
</aside>`,
  ].join('\n');
  const extraHead = `
<style>
  .demo-note { position: absolute; right: var(--safe-x); top: var(--safe-y); max-width: 760px; padding: 16px 20px; }
  /* Demo only: the tower and the lower third never share the air, so keep them apart here. */
  [data-graphic='lower-third'] { left: 596px; }
  .demo-list { margin: 8px 0 0; padding-left: 24px; font-size: 20px; line-height: 28px; color: var(--text); }
  .demo-footnote { margin-top: 8px; font-size: 20px; line-height: 28px; color: var(--text-muted); }
</style>`;
  const script = `
<script>
(() => {
  const styles = getComputedStyle(document.documentElement);
  const ms = (token) => Number.parseFloat(styles.getPropertyValue(token));
  const easeOut = styles.getPropertyValue('--ease-out').trim();
  const easeIn = styles.getPropertyValue('--ease-in').trim();
  const easeSwap = styles.getPropertyValue('--ease-swap').trim();
  const glowUp = styles.getPropertyValue('--accent-glow-up').trim();
  const glowDown = styles.getPropertyValue('--accent-glow-down').trim();

  const clock = document.querySelector('[data-graphic="race-clock"]');
  const tower = document.querySelector('[data-graphic="positions-compact"]');
  const strip = document.querySelector('[data-graphic="lower-strip"]');
  const lowerThird = document.querySelector('[data-graphic="lower-third"]');
  const pills = [...document.querySelectorAll('.flag-pill')];
  const pages = [...strip.querySelectorAll('.strip-page')];
  const pageIndex = strip.querySelector('.strip-page-index');
  const flagWords = ${JSON.stringify({ green: flagWords.green, yellow: flagWords.yellow })};

  const inFrames = [
    { opacity: 0, transform: 'translateY(12px)', filter: 'blur(6px)' },
    { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
  ];
  const outFrames = [
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(8px)' },
  ];
  const enter = (element, delay = 0) =>
    element.animate(inFrames, { duration: ms('--motion-in'), easing: easeOut, delay, fill: 'both' });
  const leave = (element, delay = 0) =>
    element.animate(outFrames, { duration: ms('--motion-out'), easing: easeIn, delay, fill: 'both' });
  const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

  function rows() { return [...tower.querySelectorAll('[data-row]')]; }

  function enterAll() {
    enter(clock);
    rows().forEach((row, index) => enter(row, 60 + index * ms('--motion-stagger')));
    enter(strip, 100);
    enter(lowerThird, 200);
  }

  function leaveAll() {
    leave(clock);
    rows().forEach((row) => leave(row));
    leave(strip);
    leave(lowerThird);
  }

  function setFlag(flag) {
    for (const pill of pills) {
      pill.dataset.flag = flag;
      pill.querySelector('.flag-word').textContent = flagWords[flag];
      pill.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
        { duration: ms('--motion-flag'), easing: easeOut },
      );
    }
  }

  // FLIP: the lower row moves up one slot; position numbers stay with the slot.
  function swapWithRowBelow(upperIndex, animate = true) {
    const list = rows();
    const upper = list[upperIndex];
    const lower = list[upperIndex + 1];
    const upperTop = upper.getBoundingClientRect().top;
    const lowerTop = lower.getBoundingClientRect().top;
    upper.parentNode.insertBefore(lower, upper);
    const upperPos = upper.querySelector('.row-pos');
    const lowerPos = lower.querySelector('.row-pos');
    const text = upperPos.textContent;
    upperPos.textContent = lowerPos.textContent;
    lowerPos.textContent = text;
    if (!animate) return;
    const delta = lowerTop - upperTop;
    const swap = { duration: ms('--motion-swap'), easing: easeSwap };
    lower.animate([{ transform: 'translateY(' + delta + 'px)' }, { transform: 'translateY(0)' }], swap);
    upper.animate([{ transform: 'translateY(' + -delta + 'px)' }, { transform: 'translateY(0)' }], swap);
    const glow = { duration: ms('--motion-glow'), easing: easeOut };
    lower.animate([{ backgroundColor: glowUp }, { backgroundColor: glowUp, offset: 0.5 }, { backgroundColor: 'transparent' }], glow);
    upper.animate([{ backgroundColor: glowDown }, { backgroundColor: glowDown, offset: 0.5 }, { backgroundColor: 'transparent' }], glow);
  }

  function showPage(index) {
    const page = ms('--motion-strip-page');
    pages.forEach((layer, layerIndex) => {
      const isNext = layerIndex === index;
      layer.classList.remove('strip-page--hidden');
      layer.animate(
        isNext
          ? [{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'translateX(0)' }]
          : [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(-8px)' }],
        { duration: page, easing: easeOut, fill: 'both' },
      );
    });
    pageIndex.textContent = String(index + 1);
  }

  async function loop() {
    for (;;) {
      enterAll();
      await wait(1800);
      setFlag('yellow');
      await wait(1400);
      swapWithRowBelow(2);
      await wait(1600);
      showPage(1);
      await wait(1600);
      setFlag('green');
      await wait(1200);
      leaveAll();
      await wait(800);
      swapWithRowBelow(2, false);
      showPage(0);
    }
  }
  loop();
})();
</script>`;
  return renderPage('vidro — motion demo', body, { extraHead, script });
}

// ---------- Write everything ----------

const compactCars = data.positions.slice(0, COMPACT_ROW_COUNT);
const detailedCars = data.positions.slice(0, DETAILED_ROW_COUNT);
const person = data.people[0];

const pages = {
  'race-clock.html': renderPage('vidro — relógio de prova', renderRaceClock(data.session)),
  'positions-compact.html': renderPage('vidro — posições (compacta)', renderCompactTower(compactCars, data.session)),
  'positions-detailed.html': renderPage('vidro — posições (detalhada)', renderDetailedTower(detailedCars)),
  'lower-strip.html': renderPage('vidro — faixa inferior', renderLowerStrip(data.session, data.positions)),
  'lower-third.html': renderPage('vidro — lower third', renderLowerThird(person)),
  'sponsor-bug.html': renderPage('vidro — bug do patrocinador', renderSponsorBug(data.sponsorBug)),
  'combo-tower.html': renderPage(
    'vidro — relógio + torre + bug',
    [renderRaceClock(data.session), renderCompactTower(compactCars, data.session), renderSponsorBug(data.sponsorBug)].join('\n'),
  ),
  'combo-strip.html': renderPage(
    'vidro — faixa + lower third',
    [renderLowerStrip(data.session, data.positions), renderLowerThird(person)].join('\n'),
  ),
  'sheet-flags.html': renderFlagSheet(),
  'sheet-status.html': renderStatusSheet(),
  'motion-demo.html': renderMotionDemo(),
};

for (const [fileName, html] of Object.entries(pages)) {
  writeFileSync(new URL(fileName, import.meta.url), html);
}
console.log(`${Object.keys(pages).length} pages written beside generatePages.mjs`);
console.log(`compact rows ${COMPACT_ROW_COUNT}, detailed rows ${DETAILED_ROW_COUNT}, strip ${STRIP_CARS_PER_PAGE} per page (${Math.ceil(data.positions.length / STRIP_CARS_PER_PAGE)} pages)`);
