// The boards of the catalogue (BAJAOVRLAY-43): the full-screen graphics on the fullscreen
// layer. Each is a head card (logo, title, a line at the right) over pills like the towers'
// or a body card, so a board is the column's language across the whole stage. The bracket
// and the podium, which reveal in steps, are in slateSteps.mjs.
import { logoPath } from './slateTemplates.mjs';
import { escapeHtml, renderLogo, scheduleIcons } from './slateVocabulary.mjs';

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

// A disqualified team keeps its row, dimmed like a retired car, with no rank and "DESCL." as
// its total (the export ranks all four disqualified teams 51º, tied).
function renderStandingsRow(entry, eventColumns) {
  const leader = entry.rank === 1 ? ' data-leader' : '';
  const disqualified = entry.isDisqualified ? ' data-disqualified' : '';
  const rank = entry.isDisqualified ? '—' : entry.rank;
  const points = eventColumns
    .map(
      (column) =>
        `\n        <span class="row__points">${entry.pointsByEventText[column.key]}</span>`,
    )
    .join('');
  return `      <li class="pill row--standings" data-row${leader}${disqualified}>
        <span class="row__pos">${rank}</span>
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

/** How many logos the intermission's sponsor line holds at once. */
export const intermissionSponsorsPerLine = 4;

/**
 * One page of the intermission's sponsor line: its level's heading ("PATROCÍNIO DIAMANTE",
 * "APOIO", "REALIZAÇÃO") and up to four logos of that level. On air the line turns through
 * every page (planSponsorPages), each held its level's time.
 */
export function renderIntermissionSponsorLine(page) {
  const sponsorCells = page.sponsors
    .map((sponsor) => `    ${renderLogo(sponsor.logo, 'intermission__sponsor')}`)
    .join('\n');
  return `  <div class="card intermission__sponsors" data-level="${page.level}">
    <span class="caption">${escapeHtml(page.levelHeading)}</span>
${sponsorCells}
  </div>`;
}

/**
 * For a break: what is next with its countdown, the top five overall and the sponsors. The
 * top five and the sponsor line are optional (an empty list leaves the part out): before the
 * first standings exist, or with no sponsor to show, the next session fills the board. The
 * sponsor line shows the first page of the sponsors; the motion demo turns through the rest.
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
  const sponsorLine =
    sponsors.length > 0
      ? `\n${renderIntermissionSponsorLine(planSponsorPages(sponsors, intermissionSponsorsPerLine)[0])}`
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

/**
 * The sponsors' pages, for the sponsor roll and the intermission's sponsor line: one level
 * at a time, in the order the sponsors come (Diamante, Ouro, Prata, Apoio, then Realização),
 * a level with more sponsors than a page holds taking several pages, so a Diamante sponsor
 * never shares a page with an Apoio one. A level that takes several pages shares its sponsors
 * evenly between them (nine on pages of four make 3 + 3 + 3, not 4 + 4 + 1), so no sponsor is
 * left alone on a page. Each page carries its level, which sets its hold.
 */
export function planSponsorPages(sponsors, sponsorsPerPage) {
  const levels = [];
  sponsors.forEach((sponsor) => {
    const lastLevel = levels.at(-1);
    if (lastLevel !== undefined && lastLevel.level === sponsor.level) {
      lastLevel.sponsors.push(sponsor);
      return;
    }
    levels.push({ level: sponsor.level, levelHeading: sponsor.levelHeading, sponsors: [sponsor] });
  });
  const pages = [];
  levels.forEach((level) => {
    const pageCount = Math.ceil(level.sponsors.length / sponsorsPerPage);
    const perPage = Math.ceil(level.sponsors.length / pageCount);
    for (let first = 0; first < level.sponsors.length; first += perPage) {
      const pageSponsors = level.sponsors.slice(first, first + perPage);
      pages.push({ level: level.level, levelHeading: level.levelHeading, sponsors: pageSponsors });
    }
  });
  return pages;
}

/** One page of the sponsor roll's tiles, as the grid the motion demo swaps page by page. */
export function renderSponsorRollGrid(sponsors, pageNumber, sponsorsPerPage) {
  const page = planSponsorPages(sponsors, sponsorsPerPage)[pageNumber - 1];
  const tiles = page.sponsors
    .map(
      (sponsor) => `    <div class="card sponsor-tile">
      ${renderLogo(sponsor.logo, 'sponsor-tile__logo')}
    </div>`,
    )
    .join('\n');
  return `  <div class="sponsor-roll__grid">
${tiles}
  </div>`;
}

/** The head's line for a sponsor roll page: its level's heading ("Patrocínio Diamante"). */
export function writeSponsorPageSubtitle(sponsors, pageNumber, sponsorsPerPage) {
  return planSponsorPages(sponsors, sponsorsPerPage)[pageNumber - 1].levelHeading;
}

/** The sponsors in tiles, one level a page; the page cycles on air (motion.md). */
export function renderSponsorRollBoard(
  sponsors,
  pageNumber,
  sponsorsPerPage,
  { withRoot = true } = {},
) {
  const root = withRoot ? ' data-graphic="sponsor-roll"' : '';
  const pageCount = planSponsorPages(sponsors, sponsorsPerPage).length;
  const subtitle = writeSponsorPageSubtitle(sponsors, pageNumber, sponsorsPerPage);
  return `<section class="board board--narrow sponsor-roll"${root} data-page="${pageNumber}">
${renderBoardHead('Patrocinadores', subtitle, `${pageNumber}/${pageCount}`)}
${renderSponsorRollGrid(sponsors, pageNumber, sponsorsPerPage)}
</section>`;
}
