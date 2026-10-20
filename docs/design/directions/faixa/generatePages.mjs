// Writes every .html of the "faixa" direction beside itself from ../../sample-data.json, so no
// row is typed by hand and a fix regenerates every page (the combo pages reuse the single
// pages' functions). Run from the repo root: node docs/design/directions/faixa/generatePages.mjs
import { readFileSync, writeFileSync } from 'node:fs';

// Paths are relative to this script, so it runs from anywhere; fs takes URL objects directly.
const data = JSON.parse(readFileSync(new URL('../../sample-data.json', import.meta.url), 'utf8'));

// Row counts measured against the title-safe area (see README.md, "Tower rows").
const COMPACT_ROWS = 23;
const DETAILED_ROWS = 20;
// Equal cells, one fifth of the car area each; the same number is --strip-cars-per-page in
// tokens.css (README.md, "The lower strip").
const STRIP_CARS_PER_PAGE = 5;

// The words for the four flag states the sample does not label come from the product's own
// pt-BR catalog: packages/graphics/race-clock/src/ptBR.ts. Green and yellow come from the data.
const flagWords = {
  pre: 'PRÉ-LARGADA',
  green: data.session.flagLabel,
  yellow: data.sessionYellow.flagLabel,
  red: 'VERMELHA',
  checkered: 'QUADRICULADA',
  finished: 'ENCERRADA',
};

function escapeHtml(text) {
  return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// ---- Status icons: inline SVG, three different shapes, navy, 20px in a fixed column ----------
const statusIcons = {
  inPit: (label) =>
    `<svg class="status-pit" viewBox="0 0 20 20" role="img" aria-label="${escapeHtml(label)}">` +
    `<rect x="1.5" y="1.5" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"/>` +
    `<path d="M7.5 15.5V4.5h3.8a2.9 2.9 0 0 1 0 5.8H7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>` +
    `</svg>`,
  stopped: (label) =>
    `<svg class="status-stopped" viewBox="0 0 20 20" role="img" aria-label="${escapeHtml(label)}">` +
    `<path d="M10 2.2 18.8 17.4H1.2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M10 7.6v4.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="10" cy="14.8" r="1.3" fill="currentColor"/>` +
    `</svg>`,
  retired: (label) =>
    `<svg class="status-retired" viewBox="0 0 20 20" role="img" aria-label="${escapeHtml(label)}">` +
    `<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/>` +
    `<path d="M4.6 15.4 15.4 4.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>` +
    `</svg>`,
};

// The mark after a moved position (motion.md): inline SVG like the status icons, because Saira
// has no triangle glyph and a text character would come from a fallback font.
const moveMarks = {
  up: '<svg class="move-mark" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9.2 8.5H.8z" fill="currentColor"/></svg>',
  down: '<svg class="move-mark" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5.8 1.5h8.4z" fill="currentColor"/></svg>',
};

function renderStatusCell(row) {
  const icon = statusIcons[row.status];
  return `<div class="cell-status">${icon ? icon(row.statusLabel) : ''}</div>`;
}

// ---- Page shell ----------------------------------------------------------------------------
function pageShell(title, body) {
  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    '<link rel="stylesheet" href="../../fonts/fonts.css">',
    '<link rel="stylesheet" href="tokens.css">',
    '<link rel="stylesheet" href="styles.css">',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// ---- Race clock ----------------------------------------------------------------------------
function renderRaceClock(session, flagState, flagWord, inlineStyle = '') {
  const style = inlineStyle ? ` style="${inlineStyle}"` : '';
  return [
    `<div class="plate race-clock" data-graphic="race-clock"${style}>`,
    `  <div class="ribbon ribbon-flush"><span>${escapeHtml(session.sessionName)}</span></div>`,
    '  <div class="clock-body">',
    `    <div class="clock-time">${escapeHtml(session.timeRemaining)}</div>`,
    '    <div class="clock-side">',
    `      <div class="caption">${escapeHtml(session.clockCaption)}</div>`,
    `      <div class="clock-laps">${escapeHtml(session.lapsLabel)}</div>`,
    '    </div>',
    '  </div>',
    `  <div class="ribbon ribbon-flush flag-band" data-flag="${flagState}"><span class="flag-word">${escapeHtml(flagWord)}</span></div>`,
    '</div>',
  ].join('\n');
}

// ---- Towers --------------------------------------------------------------------------------
function rowClasses(row, extra = '') {
  const classes = ['row'];
  if (row.position === 1) classes.push('is-leader');
  if (extra) classes.push(extra);
  return classes.join(' ');
}

function renderCompactRow(row, extraClass = '', moveDirection = '', extraAttributes = '') {
  const mark = moveDirection ? moveMarks[moveDirection] : '';
  return [
    `<div class="${rowClasses(row, extraClass)}" data-row data-status="${row.status}"${extraAttributes}>`,
    `  <div class="cell-position">${row.position}${mark}</div>`,
    `  <div class="cell-number">${row.carNumber}</div>`,
    `  <div class="cell-name">${escapeHtml(row.teamName)}</div>`,
    `  <div class="cell-laps">${row.laps}</div>`,
    `  ${renderStatusCell(row)}`,
    '</div>',
  ].join('\n');
}

function renderDetailedRow(row) {
  return [
    `<div class="${rowClasses(row)}" data-row data-status="${row.status}">`,
    `  <div class="cell-position">${row.position}</div>`,
    `  <div class="cell-number">${row.carNumber}</div>`,
    `  <div class="cell-team"><span class="team-name">${escapeHtml(row.teamName)}</span><span class="team-school">${escapeHtml(row.schoolName)}</span></div>`,
    `  <div class="cell-num is-strong">${row.laps}</div>`,
    `  <div class="cell-num">${escapeHtml(row.gapText)}</div>`,
    `  <div class="cell-num is-muted">${escapeHtml(row.intervalText)}</div>`,
    `  <div class="cell-num">${escapeHtml(row.lastLapText)}</div>`,
    `  <div class="cell-num is-strong">${escapeHtml(row.bestLapText)}</div>`,
    `  <div class="cell-num is-muted">${row.pitStops}</div>`,
    `  ${renderStatusCell(row)}`,
    '</div>',
  ].join('\n');
}

function renderCompactTower(session, rows, inlineStyle = '') {
  const style = inlineStyle ? ` style="${inlineStyle}"` : '';
  return [
    `<div class="plate tower positions-compact" data-graphic="positions-compact"${style}>`,
    `  <div class="ribbon ribbon-flush"><span>Posições</span><span class="ribbon-sub">Volta ${session.lapsCompletedByLeader}</span></div>`,
    '  <div class="rows">',
    rows.map((row) => renderCompactRow(row)).join('\n'),
    '  </div>',
    '</div>',
  ].join('\n');
}

function renderDetailedTower(session, rows, inlineStyle = '') {
  const style = inlineStyle ? ` style="${inlineStyle}"` : '';
  return [
    `<div class="plate tower positions-detailed" data-graphic="positions-detailed"${style}>`,
    '  <div class="ribbon ribbon-flush detailed-head">',
    `    <div class="head-title"><span>Posições</span><span class="ribbon-sub">Volta ${session.lapsCompletedByLeader}</span></div>`,
    '    <div class="head-caption">Voltas</div>',
    '    <div class="head-caption">Dif.</div>',
    '    <div class="head-caption">Interv.</div>',
    '    <div class="head-caption">Últ. volta</div>',
    '    <div class="head-caption">Melhor</div>',
    '    <div class="head-caption">Abast.</div>',
    '    <div class="head-caption"></div>',
    '  </div>',
    '  <div class="rows">',
    rows.map((row) => renderDetailedRow(row)).join('\n'),
    '  </div>',
    '</div>',
  ].join('\n');
}

// ---- Lower strip ---------------------------------------------------------------------------
// The block holds the time and the flag cell only. No session name: the shared rule puts every
// strip text at 28 px, and a 28 px name over the 44 px time does not fit the 69 px between the strip's top edge and the rule (the block carries no stripe).
function renderStripClock(session, flagState, flagWord) {
  return [
    '  <div class="strip-clock">',
    `    <div class="strip-time">${escapeHtml(session.timeRemaining)}</div>`,
    `    <div class="strip-flag" data-flag="${flagState}"><span>${escapeHtml(flagWord)}</span></div>`,
    '  </div>',
  ].join('\n');
}

function renderStripCar(row) {
  const leader = row.position === 1 ? ' is-leader' : '';
  return (
    `    <div class="strip-car${leader}" data-row>` +
    `<span class="strip-position">${row.position}</span>` +
    `<span class="strip-number">${row.carNumber}</span>` +
    `<span class="strip-school">${escapeHtml(row.schoolName)}</span>` +
    '</div>'
  );
}

function renderLowerStrip(session, flagState, flagWord, pageIndex) {
  const pageCount = Math.ceil(data.positions.length / STRIP_CARS_PER_PAGE);
  const start = (pageIndex - 1) * STRIP_CARS_PER_PAGE;
  const cars = data.positions.slice(start, start + STRIP_CARS_PER_PAGE);
  return [
    '<div class="plate lower-strip" data-graphic="lower-strip">',
    renderStripClock(session, flagState, flagWord),
    `  <div class="strip-cars" data-page="${pageIndex}">`,
    cars.map((row) => renderStripCar(row)).join('\n'),
    '  </div>',
    `  <div class="strip-page">${pageIndex}/${pageCount}</div>`,
    '</div>',
  ].join('\n');
}

// ---- Lower third ---------------------------------------------------------------------------
function renderLowerThird(person) {
  const badge = person.carNumber ? `<span class="team-badge">${person.carNumber}</span>` : '';
  const teamLine = person.team ? `  <div class="person-team">${badge}<span>${escapeHtml(person.team)}</span></div>` : '';
  return [
    '<div class="plate lower-third" data-graphic="lower-third">',
    `  <div class="person-name">${escapeHtml(person.name)}</div>`,
    `  <div class="ribbon ribbon-float person-role"><span>${escapeHtml(person.role)}</span></div>`,
    teamLine,
    '</div>',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ---- Sponsor bug ---------------------------------------------------------------------------
function renderSponsorBug(bug) {
  return [
    '<div class="sponsor-bug" data-graphic="sponsor-bug">',
    '  <div class="plate">',
    '    <img class="sponsor-logo" src="../../../brand/logo-colorida.png" alt="Baja SAE Brasil">',
    `    <div class="caption sponsor-line">${escapeHtml(bug.sponsorLine)}</div>`,
    `    <div class="sponsor-name">${escapeHtml(bug.sponsorName)}</div>`,
    '  </div>',
    '</div>',
  ].join('\n');
}

// ---- Reference sheets ----------------------------------------------------------------------
function label(text, left, top, isTitle = false) {
  const cls = isTitle ? 'sheet-label sheet-title' : 'sheet-label';
  return `<div class="${cls}" style="left:${left}px;top:${top}px">${escapeHtml(text)}</div>`;
}

function renderFlagSheet() {
  const states = ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'];
  const columns = [96, 580, 1064];
  const rowTops = [130, 420];
  const parts = [label('Bandeiras — o relógio nos seis estados e o bloco do relógio na faixa inferior', 96, 54, true)];
  states.forEach((state, index) => {
    const left = columns[index % 3];
    const top = rowTops[Math.floor(index / 3)];
    const session = state === 'yellow' ? data.sessionYellow : data.session;
    parts.push(label(flagWords[state], left, top - 40));
    parts.push(renderRaceClock(session, state, flagWords[state], `left:${left}px;top:${top}px`));
  });
  parts.push(label('O bloco do relógio na faixa inferior, nos mesmos seis estados', 96, 680));
  // The block grows with its flag word (QUADRICULADA makes it the widest, see README "The lower
  // strip"), so these columns are spaced for the widest block, not for the on-air minimum.
  const stripColumns = [96, 600, 1104];
  states.forEach((state, index) => {
    const session = state === 'yellow' ? data.sessionYellow : data.session;
    const left = stripColumns[index % 3];
    const top = 730 + Math.floor(index / 3) * 92;
    parts.push(`<div class="sheet-strip-clock" style="left:${left}px;top:${top}px">${renderStripClock(session, state, flagWords[state])}</div>`);
  });
  parts.push(label('Amarela usa a segunda sessão da amostra (1:06:48, 36 voltas). As cores de bandeira são um conjunto próprio, igual nas três direções, nunca as da marca.', 96, 920));
  return pageShell('Faixa — bandeiras', parts.join('\n'));
}

function renderStatusSheet() {
  const byCar = (carNumber) => data.positions.find((row) => row.carNumber === carNumber);
  const samples = [
    { row: byCar(69), shape: 'Um "P" num quadrado' },
    { row: byCar(65), shape: 'Um triângulo com "!"' },
    { row: byCar(96), shape: 'Um círculo com uma barra' },
  ];
  const parts = [label('Estado do carro — três formas, coluna fixa; a forma carrega o significado, nunca só a cor', 96, 54, true)];
  samples.forEach(({ row, shape }, index) => {
    const left = 96 + index * 224;
    parts.push(
      `<div class="plate sheet-icon-plate" style="left:${left}px;top:110px">` +
        statusIcons[row.status](row.statusLabel) +
        `<div class="status-label">${escapeHtml(row.statusLabel)}</div>` +
        `<div class="caption">${escapeHtml(shape)}</div>` +
        '</div>',
    );
  });
  const sampleRows = samples.map((sample) => sample.row);
  parts.push(label('Linhas da torre compacta (carro 69 no box, 65 parado, 96 abandonou: o texto a 70%, o ícone não)', 96, 360));
  parts.push(renderCompactTower(data.session, sampleRows, 'top:400px'));
  parts.push(label('As mesmas linhas na torre detalhada', 96, 560));
  parts.push(renderDetailedTower(data.session, sampleRows, 'top:600px'));
  // The 2 s highlight after a position change: the moved car's cell flips green (up) or blue
  // (down). Positions 13 and 14 are on the sheet because 50 of the 60 cars have two digits, and
  // the two-digit position with its mark is what sizes the 52px cell.
  const topFour = data.positions.slice(0, 4);
  const byPosition = (position) => data.positions.find((row) => row.position === position);
  parts.push(label('Célula de posição: líder (verde), normal (azul-marinho), subiu (verde com seta para cima por 2 s), desceu (azul com seta para baixo por 2 s)', 96, 780));
  parts.push(label('13 e 14: posição de dois dígitos com a seta, o caso que dimensiona a célula de 52 px', 560, 900));
  parts.push(
    [
      '<div class="plate positions-compact" style="left:96px;top:820px">',
      '  <div class="rows">',
      renderCompactRow(topFour[0]),
      renderCompactRow(topFour[1]),
      renderCompactRow(topFour[2], 'is-moved-up', 'up'),
      renderCompactRow(topFour[3], 'is-moved-down', 'down'),
      renderCompactRow(byPosition(13), 'is-moved-up', 'up'),
      renderCompactRow(byPosition(14), 'is-moved-down', 'down'),
      '  </div>',
      '</div>',
    ].join('\n'),
  );
  parts.push(label('Ícone a 120 px acima e a 20 px nas linhas; mesma geometria, azul-marinho em todos os estados.', 800, 110));
  return pageShell('Faixa — estado do carro', parts.join('\n'));
}


// ---- Motion demo (not on air): the same markup with CSS keyframes on a 14 s loop ------------
function renderDemoSwapRow(row, otherRow, direction, index) {
  // A row that trades places with its neighbour: the cell shows the old number, then the new
  // one with its arrow for 2 s, exactly as motion.md describes.
  const mark = moveMarks[direction];
  return [
    `<div class="row demo-swap-${direction}" data-row data-status="${row.status}" style="--i:${index}">`,
    `  <div class="cell-position"><span class="pos-now">${row.position}</span><span class="pos-next">${otherRow.position}${mark}</span></div>`,
    `  <div class="cell-number">${row.carNumber}</div>`,
    `  <div class="cell-name">${escapeHtml(row.teamName)}</div>`,
    `  <div class="cell-laps">${row.laps}</div>`,
    `  ${renderStatusCell(row)}`,
    '</div>',
  ].join('\n');
}

// The angled wipe every plate enters and leaves with. The polygon starts 40px outside the plate
// so the box shadow is revealed with it, and its moving edge is the 12° edge: every plate sets
// --wipe-run to (its height + 80px) × tan 12°, so the edge has the ribbons' slope (motion.md).
// The hidden polygon keeps the same slanted edge, pushed left of the plate, so the slope never
// changes while the edge travels. Percentages are seconds of the 14 s loop / 14.
function wipeKeyframes(name, inStart, inEnd) {
  const farLeft = 'calc(-40px - var(--wipe-run))';
  const hidden = `clip-path: polygon(${farLeft} -40px, -40px -40px, ${farLeft} calc(100% + 40px), ${farLeft} calc(100% + 40px));`;
  const shown = `clip-path: polygon(${farLeft} -40px, calc(100% + 40px + var(--wipe-run)) -40px, calc(100% + 40px) calc(100% + 40px), ${farLeft} calc(100% + 40px));`;
  return [
    `  @keyframes ${name} {`,
    `    0%, ${inStart} { ${hidden} animation-timing-function: var(--ease-out); }`,
    `    ${inEnd}, 78.571% { ${shown} animation-timing-function: var(--ease-in); }`,
    `    80.143%, 100% { ${hidden} }`,
    '  }',
  ].join('\n');
}

function renderMotionDemo() {
  const session = data.session;
  const demoRows = data.positions.slice(0, 8);
  const rows = demoRows.map((row, index) => {
    if (row.position === 2) return renderDemoSwapRow(row, demoRows[2], 'down', index);
    if (row.position === 3) return renderDemoSwapRow(row, demoRows[1], 'up', index);
    return renderCompactRow(row, '', '', ` style="--i:${index}"`);
  });
  const tower = [
    '<div class="plate tower positions-compact" data-graphic="positions-compact">',
    `  <div class="ribbon ribbon-flush"><span>Posições</span><span class="ribbon-sub">Volta ${session.lapsCompletedByLeader}</span></div>`,
    '  <div class="rows">',
    rows.join('\n'),
    '  </div>',
    '</div>',
  ].join('\n');

  // The clock carries a second, incoming flag band (yellow) that slides in at 3 s.
  const clock = renderRaceClock(session, session.flag, session.flagLabel).replace(
    '</div>\n</div>',
    `</div>\n  <div class="demo-flag-slot"><div class="ribbon ribbon-flush flag-band demo-flag-incoming" data-flag="${data.sessionYellow.flag}"><span class="flag-word">${escapeHtml(data.sessionYellow.flagLabel)}</span></div></div>\n</div>`,
  );

  const pageCount = Math.ceil(data.positions.length / STRIP_CARS_PER_PAGE);
  const pageOne = data.positions.slice(0, STRIP_CARS_PER_PAGE);
  const pageTwo = data.positions.slice(STRIP_CARS_PER_PAGE, STRIP_CARS_PER_PAGE * 2);
  const strip = [
    '<div class="plate lower-strip" data-graphic="lower-strip">',
    renderStripClock(session, session.flag, session.flagLabel),
    '  <div class="strip-cars-stack">',
    '  <div class="strip-cars" data-page="1">',
    pageOne.map((row) => renderStripCar(row)).join('\n'),
    '  </div>',
    '  <div class="strip-cars is-incoming" data-page="2">',
    pageTwo.map((row) => renderStripCar(row)).join('\n'),
    '  </div>',
    '  </div>',
    `  <div class="strip-page"><span class="page-now">1/${pageCount}</span><span class="page-next">2/${pageCount}</span></div>`,
    '</div>',
  ].join('\n');

  const demoStyle = `
<style>
  /* Demo-only choreography on one 14 s loop. Percentages are seconds / 14. */
  .stage-note { left: 600px; top: 300px; }
  /* The incoming band lives in a slot clipped at the plate's left edge, so it slides in from
     under the edge instead of appearing beside the plate. The slot is as wide as the band
     plus its overhang, so the angled cap still clears the plate on the right. */
  .demo-flag-slot { --band: calc(var(--flag-band-height) + var(--rule-height)); position: absolute; left: 0; bottom: 0; height: var(--band); width: calc(100% + var(--band) * var(--skew-tangent)); overflow: hidden; }
  .demo-flag-slot .flag-band { width: 100%; }
  .strip-cars-stack { position: relative; flex: 1; min-width: 0; }
  /* The incoming page is painted twice (gradient over colour): one layer of the .96 white let
     the old page's names show through faintly while the wipe crossed them. */
  .strip-cars-stack .strip-cars { position: absolute; inset: 0; background: linear-gradient(var(--panel-base), var(--panel-base)) var(--panel-base); }
  .strip-page { position: relative; }
  .strip-page .page-next, .pos-next { position: absolute; opacity: 0; }
  .cell-position { position: relative; }

  /* --wipe-run per plate: (plate height + the two 40px margins) × tan 12°, from the tokens that
     make each height (motion.md): clock 253px → 53.8, 8-row tower 385 → 81.9, bug 284 → 60.4,
     strip 152 → 32.3, lower third 245 → 52.1 (52px and 28px are the name's and the team line's
     line-heights in styles.css). */
  .race-clock { --wipe-run: calc((var(--stripe-height) + var(--ribbon-height) + var(--clock-body-height) + var(--flag-band-height) + var(--rule-height) + 80px) * var(--skew-tangent)); }
  .positions-compact { --wipe-run: calc((var(--stripe-height) + var(--ribbon-height) + 8 * var(--row-height-compact) + var(--rule-height) + 80px) * var(--skew-tangent)); }
  .sponsor-bug { --wipe-run: calc((var(--sponsor-bug-height) + 80px) * var(--skew-tangent)); }
  .lower-strip { --wipe-run: calc((var(--strip-height) + 80px) * var(--skew-tangent)); }
  .lower-third { --wipe-run: calc((var(--stripe-height) + var(--space-3) + 52px + var(--space-2) + var(--ribbon-height-small) + var(--space-2) + 28px + var(--space-3) + var(--rule-height) + 80px) * var(--skew-tangent)); }

  /* Every entrance is 300ms (--motion-in): clock 0 s, tower 0.1 s, strip 0.2 s, bug 0.3 s, and
     the lower third 1 s after the strip, at 1.2 s. Every exit is 220ms (--motion-out) at 11 s. */
${wipeKeyframes('demo-wipe-clock', '0%', '2.143%')}
${wipeKeyframes('demo-wipe-tower', '0.714%', '2.857%')}
${wipeKeyframes('demo-wipe-bug', '2.143%', '4.286%')}
${wipeKeyframes('demo-wipe-strip', '1.429%', '3.571%')}
${wipeKeyframes('demo-wipe-third', '8.571%', '10.714%')}
  .race-clock { animation: demo-wipe-clock 14s infinite; }
  .positions-compact { animation: demo-wipe-tower 14s infinite; }
  .sponsor-bug { animation: demo-wipe-bug 14s infinite; }
  .lower-strip { animation: demo-wipe-strip 14s infinite; }
  .lower-third { animation: demo-wipe-third 14s infinite; }

  @keyframes demo-row-deal { 0%, 2.857% { opacity: 0; transform: translateY(-8px); animation-timing-function: var(--ease-out); } 5%, 100% { opacity: 1; transform: translateY(0); } }
  .positions-compact .row { animation: demo-row-deal 14s both infinite; animation-delay: calc(var(--i) * var(--motion-row-stagger)); }

  @keyframes demo-row-down { 0%, 2.857% { opacity: 0; transform: translateY(-8px); animation-timing-function: var(--ease-out); } 5%, 35.714% { opacity: 1; transform: translateY(0); animation-timing-function: var(--ease-in-out); } 38.429%, 100% { opacity: 1; transform: translateY(var(--row-height-compact)); } }
  @keyframes demo-row-up { 0%, 2.857% { opacity: 0; transform: translateY(-8px); animation-timing-function: var(--ease-out); } 5%, 35.714% { opacity: 1; transform: translateY(0); animation-timing-function: var(--ease-in-out); } 38.429%, 100% { opacity: 1; transform: translateY(calc(-1 * var(--row-height-compact))); } }
  .row.demo-swap-down { animation-name: demo-row-down; }
  .row.demo-swap-up { animation-name: demo-row-up; }

  @keyframes demo-cell-up { 0%, 35.714% { background: var(--panel-ribbon); } 38.429%, 52.857% { background: var(--position-up); } 54%, 100% { background: var(--panel-ribbon); } }
  @keyframes demo-cell-down { 0%, 35.714% { background: var(--panel-ribbon); } 38.429%, 52.857% { background: var(--position-down); } 54%, 100% { background: var(--panel-ribbon); } }
  .demo-swap-up .cell-position { animation: demo-cell-up 14s infinite; }
  .demo-swap-down .cell-position { animation: demo-cell-down 14s infinite; }
  @keyframes demo-fade-out { 0%, 35.714% { opacity: 1; } 38.429%, 100% { opacity: 0; } }
  @keyframes demo-fade-in { 0%, 35.714% { opacity: 0; } 38.429%, 100% { opacity: 1; } }
  @keyframes demo-mark { 0%, 35.714% { opacity: 0; } 38.429%, 52.857% { opacity: 1; } 54%, 100% { opacity: 0; } }
  .pos-now { animation: demo-fade-out 14s infinite; }
  .pos-next { animation: demo-fade-in 14s infinite; display: inline-flex; align-items: center; gap: var(--move-mark-gap); }
  .pos-next .move-mark { animation: demo-mark 14s infinite; }

  @keyframes demo-flag-slide { 0%, 21.429% { transform: translateX(-110%); animation-timing-function: var(--ease-out); } 23.571%, 100% { transform: translateX(0); } }
  .demo-flag-incoming { animation: demo-flag-slide 14s infinite; }

  /* The page wipe (400ms, 8.0 to 8.4 s) has the 12° edge too: run = the car area's 69px × tan 12°. */
  .lower-strip { --page-wipe-run: calc((var(--strip-height) - var(--rule-height)) * var(--skew-tangent)); }
  @keyframes demo-page-wipe { 0%, 57.143% { clip-path: polygon(0 0, 0 0, calc(-1 * var(--page-wipe-run)) 100%, 0 100%); animation-timing-function: var(--ease-in-out); } 60%, 100% { clip-path: polygon(0 0, calc(100% + var(--page-wipe-run)) 0, 100% 100%, 0 100%); } }
  .strip-cars.is-incoming { animation: demo-page-wipe 14s infinite; }
  @keyframes demo-page-now { 0%, 57.143% { opacity: 1; } 60%, 100% { opacity: 0; } }
  @keyframes demo-page-next { 0%, 57.143% { opacity: 0; } 60%, 100% { opacity: 1; } }
  .page-now { animation: demo-page-now 14s infinite; }
  .page-next { animation: demo-page-next 14s infinite; }
</style>`;

  const note = label('Demo de movimento, 14 s em loop: entrada 0–1,5 s · bandeira 3 s · troca de posição 5 s · página da faixa 8 s · saída 11 s', 600, 300);
  const body = [note.replace('class="sheet-label"', 'class="sheet-label stage-note"'), clock, tower, renderSponsorBug(data.sponsorBug), strip, renderLowerThird(data.people[0])].join('\n');
  return pageShell('Faixa — demo de movimento', body).replace('</head>', `${demoStyle}\n</head>`);
}

// ---- Pages ---------------------------------------------------------------------------------
const session = data.session;
const compactRows = data.positions.slice(0, COMPACT_ROWS);
const detailedRows = data.positions.slice(0, DETAILED_ROWS);
const person = data.people[0];

const raceClock = renderRaceClock(session, session.flag, session.flagLabel);
const compactTower = renderCompactTower(session, compactRows);
const detailedTower = renderDetailedTower(session, detailedRows);
const lowerStrip = renderLowerStrip(session, session.flag, session.flagLabel, 1);
const lowerThird = renderLowerThird(person);
const sponsorBug = renderSponsorBug(data.sponsorBug);

const pages = {
  'race-clock.html': pageShell('Faixa — relógio de prova', raceClock),
  'positions-compact.html': pageShell('Faixa — posições (compacta)', compactTower),
  'positions-detailed.html': pageShell('Faixa — posições (detalhada)', detailedTower),
  'lower-strip.html': pageShell('Faixa — faixa inferior', lowerStrip),
  'lower-third.html': pageShell('Faixa — terço inferior', lowerThird),
  'sponsor-bug.html': pageShell('Faixa — selo do patrocinador', sponsorBug),
  'combo-tower.html': pageShell('Faixa — relógio, torre e selo', [raceClock, compactTower, sponsorBug].join('\n')),
  'combo-strip.html': pageShell('Faixa — faixa inferior e terço inferior', [lowerStrip, lowerThird].join('\n')),
  'sheet-flags.html': renderFlagSheet(),
  'sheet-status.html': renderStatusSheet(),
  'motion-demo.html': renderMotionDemo(),
};

for (const [fileName, html] of Object.entries(pages)) {
  writeFileSync(new URL(fileName, import.meta.url), html);
}
console.log(`wrote ${Object.keys(pages).length} pages beside generatePages.mjs`);
console.log(`compact rows ${COMPACT_ROWS}, detailed rows ${DETAILED_ROWS}, strip ${STRIP_CARS_PER_PAGE}/page over ${Math.ceil(data.positions.length / STRIP_CARS_PER_PAGE)} pages`);
