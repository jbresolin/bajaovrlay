// The boards of the catalogue (BAJAOVRLAY-43): the full-screen graphics on the fullscreen
// layer. Each is a head card (logo, title, a line at the right) over pills like the towers'
// or a body card, so a board is the column's language across the whole stage. The bracket
// and the podium, which reveal in steps, are in slateSteps.mjs.
import { logoPath } from './slateTemplates.mjs';
import { escapeHtml, placeholderMark, scheduleIcons } from './slateVocabulary.mjs';

/** The head every board starts with: the logo, the title, a subtitle, a line at the right. */
export function renderBoardHead(title, subtitle = '', aside = '') {
  const subtitleHtml = subtitle
    ? `\n    <span class="caption board__subtitle">${escapeHtml(subtitle)}</span>`
    : '';
  const asideHtml = aside ? `\n    <span class="board__aside">${escapeHtml(aside)}</span>` : '';
  return `  <header class="card board__head">
    <img class="board__logo" src="${logoPath}" alt="Baja SAE Brasil">
    <h1 class="board__title">${escapeHtml(title)}</h1>${subtitleHtml}${asideHtml}
  </header>`;
}

// ---------------------------------------------------------------- standings

function renderStandingsHead(columns) {
  const cells = columns
    .map(
      (column) =>
        `      <span class="caption standings-head__${column.key}">${column.label}</span>`,
    )
    .join('\n');
  return `    <header class="pill pill--head standings-head">
${cells}
    </header>`;
}

function renderStandingsRow(entry, eventColumns) {
  const leader = entry.rank === 1 ? ' data-leader' : '';
  const points = eventColumns
    .map(
      (column) =>
        `\n        <span class="row__points">${entry.pointsByEventText[column.key]}</span>`,
    )
    .join('');
  return `      <li class="pill row--standings" data-row${leader}>
        <span class="row__pos">${entry.rank}</span>
        <span class="chip">${entry.carNumber}</span>
        <span class="row__team"><span class="row__team-name">${escapeHtml(entry.teamName)}</span><span class="row__school">${escapeHtml(entry.schoolName)}</span></span>${points}
        <span class="row__total">${entry.pointsText}</span>
      </li>`;
}

const fixedStandingsColumns = [
  { key: 'pos', label: 'POS', width: 'var(--column-pos)' },
  { key: 'car', label: 'Nº', width: 'var(--chip-width)' },
  { key: 'team', label: 'EQUIPE', width: 'minmax(0, 1fr)' },
];

/** The rows of one page of the overall standings (the motion demo swaps them page by page). */
export function renderStandingsPageRows(standings, pageNumber, rowsPerPage) {
  const firstIndex = (pageNumber - 1) * rowsPerPage;
  const rows = standings.entries.slice(firstIndex, firstIndex + rowsPerPage);
  return rows.map((entry) => renderStandingsRow(entry, standings.eventColumns)).join('\n');
}

/** "1/3 · 1º A 20º": the head's page line for one page of the overall standings. */
export function writeStandingsPageAside(standings, pageNumber, rowsPerPage) {
  const pageCount = Math.ceil(standings.entries.length / rowsPerPage);
  const firstIndex = (pageNumber - 1) * rowsPerPage;
  const lastIndex = Math.min(firstIndex + rowsPerPage, standings.entries.length);
  return `${pageNumber}/${pageCount} · ${firstIndex + 1}º A ${lastIndex}º`;
}

/**
 * The overall standings: one row per team with its points per event and the total, in
 * pages of rowsPerPage (20: three pages for 60 teams, the tower's page size).
 */
export function renderStandingsBoard(
  standings,
  eventName,
  pageNumber,
  rowsPerPage,
  { withRoot = true } = {},
) {
  const root = withRoot ? ' data-graphic="standings"' : '';
  const columns = [
    ...fixedStandingsColumns,
    ...standings.eventColumns.map((column) => ({ ...column, width: 'var(--col-points)' })),
    { key: 'total', label: 'TOTAL', width: 'var(--col-total)' },
  ];
  const grid = columns.map((column) => column.width).join(' ');
  const aside = writeStandingsPageAside(standings, pageNumber, rowsPerPage);
  return `<section class="board standings"${root} style="--standings-columns: ${grid}" data-page="${pageNumber}">
${renderBoardHead(standings.title, eventName, aside)}
  <div class="board__table">
${renderStandingsHead(columns)}
    <ol class="board__rows">
${renderStandingsPageRows(standings, pageNumber, rowsPerPage)}
    </ol>
  </div>
</section>`;
}

function renderEventStandingsRow(entry) {
  const leader = entry.rank === 1 ? ' data-leader' : '';
  return `        <li class="pill row--standings" data-row${leader}>
          <span class="row__pos">${entry.rank}</span>
          <span class="chip">${entry.carNumber}</span>
          <span class="row__team"><span class="row__team-name">${escapeHtml(entry.teamName)}</span><span class="row__school">${escapeHtml(entry.schoolName)}</span></span>
          <span class="row__total">${entry.pointsText}</span>
        </li>`;
}

/**
 * One event's standings: every team at once in three columns of rowsPerColumn, since each
 * team has one number; tied teams share a rank.
 */
export function renderStandingsEventBoard(
  standings,
  eventName,
  rowsPerColumn,
  { withRoot = true } = {},
) {
  const root = withRoot ? ' data-graphic="standings-por-prova"' : '';
  const columns = [
    ...fixedStandingsColumns,
    { key: 'total', label: 'PONTOS', width: 'var(--col-points)' },
  ];
  const grid = columns.map((column) => column.width).join(' ');
  const columnCount = Math.ceil(standings.entries.length / rowsPerColumn);
  const tables = [];
  for (let index = 0; index < columnCount; index += 1) {
    const rows = standings.entries.slice(index * rowsPerColumn, (index + 1) * rowsPerColumn);
    tables.push(`    <div class="board__table">
${renderStandingsHead(columns)}
      <ol class="board__rows">
${rows.map(renderEventStandingsRow).join('\n')}
      </ol>
    </div>`);
  }
  return `<section class="board standings standings--columns"${root} style="--standings-columns: ${grid}">
${renderBoardHead(standings.title, eventName, `${standings.entries.length} EQUIPES`)}
  <div class="standings__columns">
${tables.join('\n')}
  </div>
</section>`;
}

// ---------------------------------------------------------------- sessions board

/** A slot's state cell: its shape and its word, its colour set by its own data-status. */
export function renderSessionStatus(status, statusLabel) {
  return `<span class="session-row__status" data-status="${status}">${scheduleIcons[status]}<span>${escapeHtml(statusLabel)}</span></span>`;
}

/** The day's schedule: one pill per slot with its time, name and state. */
export function renderSessionsBoard(schedule, session, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="sessions-board"' : '';
  const rows = schedule
    .map(
      (slot) => `    <li class="pill session-row" data-row data-status="${slot.status}">
      <span class="session-row__time">${slot.timeText}</span>
      <span class="session-row__name">${escapeHtml(slot.sessionName)}</span>
      ${renderSessionStatus(slot.status, slot.statusLabel)}
    </li>`,
    )
    .join('\n');
  return `<section class="board board--narrow sessions-board"${root}>
${renderBoardHead('Programação do dia', session.eventName, session.dateText)}
  <ol class="board__rows">
${rows}
  </ol>
</section>`;
}

// ---------------------------------------------------------------- intermission board

function renderTopFiveRow(entry) {
  const leader = entry.rank === 1 ? ' data-leader' : '';
  return `        <li class="pill row--standings" data-row${leader}>
          <span class="row__pos">${entry.rank}</span>
          <span class="chip">${entry.carNumber}</span>
          <span class="row__team"><span class="row__team-name">${escapeHtml(entry.teamName)}</span><span class="row__school">${escapeHtml(entry.schoolName)}</span></span>
          <span class="row__total">${entry.pointsText}</span>
        </li>`;
}

/**
 * For a break: what is next with its countdown, the top five overall and the sponsors. The
 * top five and the sponsor line are optional (an empty list leaves the part out): before the
 * first standings exist, or with no sponsor to show, the next session fills the board.
 */
export function renderIntermissionBoard(
  session,
  countdown,
  topFive,
  sponsors,
  { withRoot = true } = {},
) {
  const root = withRoot ? ' data-graphic="intermission-board"' : '';
  const grid = 'var(--column-pos) var(--chip-width) minmax(0, 1fr) var(--col-points)';
  const hasTopFive = topFive.length > 0;
  const bodyClass = hasTopFive
    ? 'intermission__body'
    : 'intermission__body intermission__body--single';
  const table = hasTopFive
    ? `
    <div class="board__table" style="--standings-columns: ${grid}">
      <header class="pill pill--head intermission__top-head"><span class="caption">CLASSIFICAÇÃO GERAL · 5 PRIMEIROS</span></header>
      <ol class="board__rows">
${topFive.map(renderTopFiveRow).join('\n')}
      </ol>
    </div>`
    : '';
  const sponsorCells = sponsors
    .map(
      (sponsor) =>
        `    <span class="intermission__sponsor">${placeholderMark(sponsor.initial, sponsor.name)}<span>${escapeHtml(sponsor.name)}</span></span>`,
    )
    .join('\n');
  const sponsorLine =
    sponsors.length > 0
      ? `
  <div class="card intermission__sponsors">
    <span class="caption">PATROCÍNIO</span>
${sponsorCells}
  </div>`
      : '';
  return `<section class="board board--narrow intermission"${root}>
${renderBoardHead('Intervalo', session.eventName, session.dateText)}
  <div class="${bodyClass}">
    <div class="card intermission__next">
      <span class="caption">A SEGUIR</span>
      <span class="intermission__session">${escapeHtml(countdown.sessionName)}</span>
      <span class="intermission__countdown">${countdown.remainingText}</span>
      <span class="intermission__start">LARGADA ÀS ${countdown.startTimeText}</span>
    </div>${table}
  </div>${sponsorLine}
</section>`;
}

// ---------------------------------------------------------------- countdown board

/** The waiting screen: the session to come, the time to its start, the start time. */
export function renderCountdownBoard(countdown, session, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="countdown-board"' : '';
  return `<section class="board board--narrow countdown-board"${root}>
${renderBoardHead('Próxima sessão', session.eventName, session.dateText)}
  <div class="card countdown-board__body">
    <span class="countdown-board__session">${escapeHtml(countdown.sessionName)}</span>
    <span class="countdown-board__time">${countdown.remainingText}</span>
    <span class="countdown-board__start">LARGADA ÀS ${countdown.startTimeText}</span>
  </div>
</section>`;
}

// ---------------------------------------------------------------- sponsor roll, full

/** One page of the sponsor roll's tiles, as the grid the motion demo swaps page by page. */
export function renderSponsorRollGrid(sponsors, pageNumber, sponsorsPerPage) {
  const firstIndex = (pageNumber - 1) * sponsorsPerPage;
  const tiles = sponsors
    .slice(firstIndex, firstIndex + sponsorsPerPage)
    .map(
      (sponsor) => `    <div class="card sponsor-tile">
      ${placeholderMark(sponsor.initial, sponsor.name)}
      <span class="sponsor-tile__name">${escapeHtml(sponsor.name)}</span>
    </div>`,
    )
    .join('\n');
  return `  <div class="sponsor-roll__grid">
${tiles}
  </div>`;
}

/** The sponsors in tiles, sponsorsPerPage a page; the page cycles on air (motion.md). */
export function renderSponsorRollBoard(
  sponsors,
  pageNumber,
  sponsorsPerPage,
  { withRoot = true } = {},
) {
  const root = withRoot ? ' data-graphic="sponsor-roll"' : '';
  const pageCount = Math.ceil(sponsors.length / sponsorsPerPage);
  return `<section class="board board--narrow sponsor-roll"${root} data-page="${pageNumber}">
${renderBoardHead('Patrocinadores', '', `${pageNumber}/${pageCount}`)}
${renderSponsorRollGrid(sponsors, pageNumber, sponsorsPerPage)}
</section>`;
}
