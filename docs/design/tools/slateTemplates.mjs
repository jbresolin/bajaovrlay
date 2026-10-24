// The on-air graphics' markup, shared by every "slate" direction. The directions compared at
// the gate of PR #19 (ardosia, grafite, marinho) were siblings of the existing scoreboard
// (placarbaja.juansalles.com.br): the same graphics, the same elements in the same order, so
// a direction is its tokens.css, its styles.css and a few numbers (rows, cars per strip
// page), never its own copy of this file. slateSheets.mjs draws the reference sheets with
// these builders and slatePages.mjs assembles the pages a generatePages.mjs writes. The
// catalogue of pass 2 (BAJAOVRLAY-43) builds on these in slateNotices.mjs, slateCards.mjs,
// slateBoards.mjs and slateSteps.mjs.
import {
  escapeHtml,
  flagOrder,
  flagStateLabels,
  flagWords,
  largeIcon,
  renderLogo,
  sample,
  statusIcons,
  statusShapeWords,
} from './slateVocabulary.mjs';

export { flagOrder, flagStateLabels, flagWords, largeIcon, sample, statusShapeWords };

/** The event logo every head shows, relative to a direction's page. */
export const logoPath = '../../../brand/logo-branca.png';

export function pageShell(direction, title, bodyHtml, script = '') {
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
export function renderCompactRow(car) {
  const leader = car.position === 1 ? ' data-leader' : '';
  // The compact tower names a team by its short name (the entity library's equipe_curto) when
  // it has one: the column fits about sixteen caps, and full names run to thirty.
  const teamName = car.teamShortName ?? car.teamName;
  return `    <li class="pill row" data-row data-car="${car.carNumber}" data-status="${car.status}"${leader}>
      <span class="row__pos">${car.position}</span>
      <span class="row__cue"></span>
      <span class="row__car chip">${car.carNumber}</span>
      <span class="row__team">${escapeHtml(teamName)}</span>
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

// Every column the detailed tower can show, in order. The first five are always on; the rest
// are optional (João's question on PR #19): an event without lap timing turns the time columns
// off, one without a refuel count turns ABAST. off, and a tower without status icons drops the
// status column. The canonical positions shape carries pitStops (every pit entry, PARADAS) and
// no refuel count yet, so ABAST. is off by default and shows "—" when on.
const detailedColumnRegistry = [
  { key: 'pos', label: 'POS', width: 'var(--col-pos)', always: true },
  { key: 'cue', label: '', width: 'var(--column-cue)', always: true },
  { key: 'car', label: 'Nº', width: 'var(--chip-width)', always: true },
  { key: 'team', label: 'EQUIPE', width: 'var(--col-team)', always: true },
  { key: 'laps', label: 'VOLTAS', width: 'var(--col-laps)', always: true },
  { key: 'gap', label: 'DIF.', width: 'var(--col-gap)' },
  { key: 'interval', label: 'INTERV.', width: 'var(--col-interval)' },
  { key: 'last-lap', label: 'ÚLT. VOLTA', width: 'var(--col-last-lap)' },
  { key: 'best-lap', label: 'MELHOR', width: 'var(--col-best-lap)' },
  { key: 'pit-stops', label: 'PARADAS', width: 'var(--col-pit-stops)' },
  { key: 'refuels', label: 'ABAST.', width: 'var(--col-refuels)' },
  { key: 'status', label: '', width: 'var(--column-status)' },
];
export const defaultDetailedColumns = [
  'gap',
  'interval',
  'last-lap',
  'best-lap',
  'pit-stops',
  'status',
];

// The gap rule (docs/00-concept.md §8) writes "+19,0 s"; a direction set in a caps-only face
// cannot show a lowercase unit, so it asks for the tower's gaps without it ("+19,0").
let writeGap = (text) => text;

/** Chooses how gaps are written: 's' keeps "+19,0 s", 'none' writes "+19,0" (a caps-only face). */
export function setGapUnit(gapUnit) {
  writeGap = gapUnit === 'none' ? (text) => text.replace(/ s$/, '') : (text) => text;
}

// "—" is the on-air mark for a value the source does not know (never a 0 or a blank cell).
const unknown = '—';

function renderDetailedCell(column, car) {
  switch (column.key) {
    case 'pos':
      return `<span class="row__pos">${car.position}</span>`;
    case 'cue':
      return '<span class="row__cue"></span>';
    case 'car':
      return `<span class="row__car chip">${car.carNumber}</span>`;
    case 'team':
      return `<span class="row__team"><span class="row__team-name">${escapeHtml(car.teamName)}</span><span class="row__school">${escapeHtml(car.schoolName)}</span></span>`;
    case 'laps':
      return `<span class="row__laps">${car.laps}</span>`;
    case 'gap':
      return `<span class="row__gap">${escapeHtml(writeGap(car.gapText))}</span>`;
    case 'interval':
      return `<span class="row__interval">${escapeHtml(writeGap(car.intervalText))}</span>`;
    case 'last-lap':
      return `<span class="row__last-lap">${escapeHtml(car.lastLapText)}</span>`;
    case 'best-lap':
      return `<span class="row__best-lap">${escapeHtml(car.bestLapText)}</span>`;
    case 'pit-stops':
      return `<span class="row__pit-stops">${car.pitStops ?? unknown}</span>`;
    case 'refuels':
      return `<span class="row__refuels">${car.refuels ?? unknown}</span>`;
    case 'status':
      return `<span class="row__status">${statusIcons[car.status] ?? ''}</span>`;
    default:
      return '';
  }
}

function selectDetailedColumns(optionalKeys) {
  return detailedColumnRegistry.filter(
    (column) => column.always || optionalKeys.includes(column.key),
  );
}

function renderDetailedRow(car, columns) {
  const leader = car.position === 1 ? ' data-leader' : '';
  const cells = columns.map((column) => `      ${renderDetailedCell(column, car)}`).join('\n');
  return `    <li class="pill row row--detailed" data-row data-car="${car.carNumber}" data-status="${car.status}"${leader}>
${cells}
    </li>`;
}

// The tower's grid and width follow the columns shown: both are written on the element from
// the width tokens, so a column turned off takes its width with it.
export function renderDetailedTower(
  cars,
  session,
  { withRoot = true, columns = defaultDetailedColumns } = {},
) {
  const root = withRoot ? ' data-graphic="positions-detailed"' : '';
  const shown = selectDetailedColumns(columns);
  const gridTemplate = shown
    .map((column) => (column.key === 'team' ? 'minmax(0, 1fr)' : column.width))
    .join(' ');
  const width = `calc(${shown.map((column) => column.width).join(' + ')} + 2 * var(--row-padding))`;
  const header = shown
    .map((column) => `    <span class="caption detail-head__${column.key}">${column.label}</span>`)
    .join('\n');
  return `<section class="tower tower--detailed"${root} style="--detail-columns: ${gridTemplate}; width: ${width}">
  <header class="pill pill--head tower__head detail-head">
${header}
  </header>
  <ol class="tower__rows">
${cars.map((car) => renderDetailedRow(car, shown)).join('\n')}
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
      <span class="strip-car__school">${escapeHtml(car.teamShortName ?? car.schoolName)}</span>
    </li>`;
}

export function renderStripPage(cars) {
  return `  <ol class="lower-strip__cars">
${cars.map(renderStripCar).join('\n')}
  </ol>`;
}

/** The strip's clock block (time and flag pill), shared with the message ticker. */
export function renderStripClock(session) {
  return `  <div class="card lower-strip__clock">
    <span class="lower-strip__time">${session.timeRemaining}</span>
    ${renderFlagPill(session.flag, session.flagLabel, 'lower-strip__flag')}
  </div>`;
}

export function renderLowerStrip(cars, session, pageNumber, pageCount, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="lower-strip"' : '';
  return `<section class="lower-strip"${root}>
${renderStripClock(session)}
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
  <span class="sponsor-bug__sponsor"><span class="caption">${escapeHtml(bug.sponsorLine)}</span>${renderLogo(bug.sponsor.logo, 'sponsor-bug__sponsor-logo')}</span>
</section>`;
}
