// Builds docs/design/sample-data.json from the real data of the 30th Baja SAE Brasil in
// docs/design/sample_data (BAJAOVRLAY-43): the teams and their logos, the enduro's passes, the
// overall scores, the enduro penalties, the Super Prime bracket and the sponsors' logos. Every
// number is already written the way it goes on air (pt-BR, tenths cut, as docs/00-concept.md
// §8 rules) by enduroTiming.js, so no page disagrees with another on a number; the choices
// on top of the data (the moment the static pages show, the teams some cards use, what no
// export carries) are in sampleFixtures.mjs. Run from the repo root, after prepareLogos.mjs
// when a logo changed:
//   node docs/design/tools/buildSampleData.mjs
import './enduroTiming.js';

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as prettier from 'prettier';

import { findBestBattle } from './sampleBattle.mjs';
import { readEnduroPasses } from './sampleEnduroPasses.mjs';
import {
  battleFixture,
  countdownFixture,
  eventFixture,
  messageFixtures,
  noticePenaltyCars,
  qrFixture,
  scheduleFixture,
  sponsorLevels,
  sponsorNames,
  teamCardFixtures,
} from './sampleFixtures.mjs';
import { buildPlaceholderQrModules } from './samplePlaceholderQr.mjs';
import {
  overallScoreParts,
  readOverallStandings,
  readPenalties,
  readTeams,
} from './sampleResults.mjs';
import { readSuperPrime } from './sampleSuperPrime.mjs';

const timing = globalThis.enduroTiming;
const designFolder = resolve('docs/design');
const outputFile = resolve(designFolder, 'sample-data.json');
const logos = JSON.parse(
  readFileSync(resolve(designFolder, 'sample_data/logos/logos.json'), 'utf8'),
);

/** A logo for a page: its path from docs/design, its size and the surface it needs. */
function describeLogo(logo, name) {
  if (logo === undefined) return undefined;
  return {
    path: `sample_data/${logo.file}`,
    width: logo.width,
    height: logo.height,
    surface: logo.surface,
    name,
  };
}

// ---------------------------------------------------------------- teams

const teams = readTeams();
const describeTeam = (carNumber) => {
  const team = teams.get(carNumber);
  if (team === undefined) throw new Error(`Car ${carNumber} is not in teams.csv.`);
  return {
    carNumber,
    teamName: team.teamName,
    teamShortName: team.teamShortName,
    schoolName: team.schoolName,
    city: `${team.city} · ${team.state}`,
    logo: describeLogo(logos.teams[String(carNumber)], team.teamName),
  };
};

// ---------------------------------------------------------------- the enduro

const enduro = readEnduroPasses();
const staticMomentMs = enduro.startMs + eventFixture.staticMomentAfterStartMs;
const statusLabels = {
  running: 'Em prova',
  inPit: 'No box',
  stopped: 'Quebrado',
  retired: 'Abandonou',
};
const flagLabels = {
  pre: 'PRÉ-LARGADA',
  green: 'VERDE',
  yellow: 'AMARELA',
  checkered: 'QUADRICULADA',
};

/** "domingo, 30 de março de 2025": the day of the passes, for a board's head. */
const dateText = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(enduro.dayStartMs));

function describeSession(atMs, flagOverride) {
  const session = timing.sessionAt(
    enduro.passes,
    atMs,
    enduro.startMs,
    eventFixture.sessionDurationMs,
  );
  const flag = flagOverride ?? session.flag;
  return {
    eventName: eventFixture.eventName,
    sessionName: eventFixture.sessionName,
    flag,
    flagLabel: flagLabels[flag],
    clockCaption: 'TEMPO RESTANTE',
    timeRemaining: timing.formatRemainingClock(session.remainingMs),
    lapsCompletedByLeader: session.lapsCompletedByLeader,
    lapsLabel: timing.writeLapsLabel(session.lapsCompletedByLeader),
    dateText,
    timeOfDayText: timing.formatTimeOfDay(atMs),
  };
}

const describeEntry = (entry) => ({
  ...describeTeam(entry.carNumber),
  position: entry.position,
  laps: entry.laps,
  status: entry.status,
  statusLabel: statusLabels[entry.status],
  gapText: timing.formatGapToLeader(entry),
  intervalText: timing.formatInterval(entry),
  lastLapText: timing.formatLapTimeOnAir(entry.lastLapMs),
  bestLapText: timing.formatLapTimeOnAir(entry.bestLapMs),
  bestLapNumber: entry.bestLapNumber,
});

const staticPositions = timing.positionsAt(enduro.passes, staticMomentMs);
const entries = staticPositions.map(describeEntry);
const finalEntries = timing.positionsAt(enduro.passes, enduro.lastCrossingMs).map(describeEntry);
const fastestEntry = staticPositions
  .filter((entry) => entry.bestLapMs !== undefined)
  .sort((first, second) => first.bestLapMs - second.bestLapMs)[0];

// The battle: the pair that ran closest for the most laps (sampleBattle.mjs), shown as the
// positions stood when it began; Atualizar walks its next laps, each with its change.
function buildBattle() {
  const battle = findBestBattle(enduro.passes, timing.minimumLapTimeMs, battleFixture.withinMs);
  const startedAtMs = battle.laps[0].crossedAtMs;
  const positionsThen = timing.positionsAt(enduro.passes, startedAtMs);
  const entryOf = (carNumber) => positionsThen.find((entry) => entry.carNumber === carNumber);
  const readings = battle.laps
    .slice(0, battleFixture.laterReadingsCount + 1)
    .map((lap) => lap.gapMs);
  const writeChange = (fromMs, toMs) => {
    const changeMs = toMs - fromMs;
    let sign = '';
    if (changeMs < 0) sign = '−';
    if (changeMs > 0) sign = '+';
    return `${sign}${timing.writeSecondsToTheTenthCut(Math.abs(changeMs))}`;
  };
  const trendOf = (changeMs) => {
    if (Math.abs(changeMs) < 100) return 'steady';
    return changeMs < 0 ? 'closing' : 'opening';
  };
  const firstGapMs = readings[0];
  const sheetChangeMs = battleFixture.sheetTrendChangeMs;
  return {
    ahead: describeEntry(entryOf(battle.aheadCar)),
    behind: describeEntry(entryOf(battle.behindCar)),
    startedAtText: timing.formatTimeOfDay(startedAtMs),
    gapText: `+${timing.writeSecondsToTheTenthCut(firstGapMs)}`,
    trends: {
      closing: writeChange(firstGapMs + sheetChangeMs, firstGapMs),
      opening: writeChange(firstGapMs - sheetChangeMs, firstGapMs),
      steady: '',
    },
    updates: readings.map((readingMs, index) => ({
      gapText: `+${timing.writeSecondsToTheTenthCut(readingMs)}`,
      trend: index === 0 ? 'steady' : trendOf(readingMs - readings[index - 1]),
      changeText: index === 0 ? '' : writeChange(readings[index - 1], readingMs),
    })),
  };
}

// ---------------------------------------------------------------- standings

const overall = readOverallStandings();
const writePoints = (points) => {
  if (points === undefined) return '—';
  const text = String(Math.round(points * 100) / 100).replace('.', ',');
  return points < 0 ? text.replace('-', '−') : text;
};
const standingsEntries = overall.map((row) => ({
  ...describeTeam(row.carNumber),
  rank: row.rank,
  pointsText: row.isDisqualified ? 'DESCL.' : writePoints(row.points),
  pointsByEventText: Object.fromEntries(
    overallScoreParts.map((part) => [part.key, writePoints(row.pointsByPart[part.key])]),
  ),
  isDisqualified: row.isDisqualified,
}));

// One part's table, from the overall export's column: the teams that scored, tied teams
// sharing a rank (the export has no per-event standings of its own).
function rankOnePart(partKey) {
  const scored = overall
    .filter((row) => (row.pointsByPart[partKey] ?? 0) > 0)
    .sort((first, second) => second.pointsByPart[partKey] - first.pointsByPart[partKey]);
  let rank = 0;
  let previousPoints = null;
  return scored.map((row, index) => {
    const points = row.pointsByPart[partKey];
    if (points !== previousPoints) {
      rank = index + 1;
      previousPoints = points;
    }
    return { ...describeTeam(row.carNumber), rank, pointsText: writePoints(points) };
  });
}

// ---------------------------------------------------------------- notices and sponsors

const penalties = readPenalties();
function describePenaltyNotice(carNumber) {
  const penalty = penalties.find((row) => row.carNumber === carNumber);
  return {
    carNumber,
    teamName: penalty.schoolName,
    schoolName: '',
    kind: 'penalty',
    reason: penalty.reason,
    penalty: `+${penalty.penaltyTime}`,
    sector: penalty.sector === 'PRÉ' ? 'ANTES DA LARGADA' : `SETOR ${penalty.sector}`,
  };
}

const levelOrder = sponsorLevels.map((level) => level.key);
const sponsors = Object.entries(logos.sponsors)
  .map(([key, logo]) => ({
    key,
    name: sponsorNames[key] ?? key,
    level: logo.level,
    levelHeading: sponsorLevels.find((level) => level.key === logo.level)?.heading ?? logo.level,
    logo: describeLogo(logo, sponsorNames[key] ?? key),
  }))
  .sort(
    (first, second) =>
      levelOrder.indexOf(first.level) - levelOrder.indexOf(second.level) ||
      first.name.localeCompare(second.name),
  );

// ---------------------------------------------------------------- everything

const timedSample = JSON.parse(
  readFileSync(resolve('packages/shared/src/dataShapes/samples/brackets.suspension.json'), 'utf8'),
).rounds[0].matches[0];

const sampleData = {
  about:
    'Generated by docs/design/tools/buildSampleData.mjs from the real data in docs/design/sample_data and the choices in sampleFixtures.mjs. Strings are final on-air text (pt-BR). Do not edit by hand.',
  session: describeSession(staticMomentMs),
  sessionYellow: describeSession(enduro.startMs + eventFixture.yellowMomentAfterStartMs, 'yellow'),
  positions: entries,
  fastestLap: {
    ...describeTeam(fastestEntry.carNumber),
    bestLapText: timing.formatLapTimeOnAir(fastestEntry.bestLapMs),
    lap: fastestEntry.bestLapNumber,
  },
  standingsTop5: standingsEntries.slice(0, 5),
  standings: {
    scope: 'overall',
    title: 'Classificação geral',
    eventColumns: overallScoreParts.map((part) => ({ key: part.key, label: part.label })),
    entries: standingsEntries,
  },
  standingsEnduro: {
    scope: 'enduro',
    title: 'Classificação · Enduro',
    entries: rankOnePart('enduro'),
  },
  brackets: readSuperPrime(teams),
  bracketTimedSample: {
    ...timedSample,
    carA: { ...timedSample.carA, timeText: timing.formatLapTimeOnAir(timedSample.carA.timeMs) },
    carB: { ...timedSample.carB, timeText: timing.formatLapTimeOnAir(timedSample.carB.timeMs) },
  },
  podium: { title: `Pódio · ${eventFixture.sessionName}`, places: finalEntries.slice(0, 3) },
  teamCards: {
    withMedia: {
      ...describeTeam(teamCardFixtures.withMedia.carNumber),
      photoPath: teamCardFixtures.withMedia.photoPath,
    },
    withoutMedia: { ...describeTeam(teamCardFixtures.withoutMedia.carNumber), logo: undefined },
  },
  battle: buildBattle(),
  notices: Object.fromEntries(
    Object.entries(noticePenaltyCars).map(([name, carNumber]) => [
      name,
      describePenaltyNotice(carNumber),
    ]),
  ),
  countdown: {
    sessionName: countdownFixture.sessionName,
    startTimeText: countdownFixture.startTimeText,
    remainingText: timing.formatRemainingClock(countdownFixture.remainingMs),
    remainingSeconds: Math.ceil(countdownFixture.remainingMs / 1000),
  },
  schedule: scheduleFixture.map((slot) => ({
    ...slot,
    statusLabel: { done: 'Concluída', live: 'Em andamento', next: 'A seguir' }[slot.status],
  })),
  messages: messageFixtures,
  sponsors,
  qr: { ...qrFixture, modules: buildPlaceholderQrModules(25) },
  people: [
    { name: 'Mariana Costa', role: 'Capitã da equipe', team: 'Baja UFMG · UFMG', carNumber: 2 },
    { name: 'Carlos Henrique Lima', role: 'Diretor de prova', team: '' },
    { name: 'Rafael Nogueira', role: 'Narrador', team: '' },
  ],
  sponsorBug: { eventLabel: 'ENDURO', sponsorLine: 'Apresentado por', sponsor: sponsors[0] },
  enduroTimeline: {
    startMs: enduro.startMs,
    durationMs: eventFixture.sessionDurationMs,
    lastCrossingMs: enduro.lastCrossingMs,
    staticMomentMs,
    passes: enduro.passes,
    fastestLapEvents: timing.listFastestLapEvents(enduro.passes),
    teams: Object.fromEntries(
      [...new Set(enduro.passes.map((pass) => pass[0]))].map((carNumber) => [
        carNumber,
        describeTeam(carNumber),
      ]),
    ),
  },
};

// Formatted with the repo's Prettier, so `pnpm lint` passes on the file exactly as written.
const prettierConfig = (await prettier.resolveConfig(outputFile)) ?? {};
const json = await prettier.format(JSON.stringify(sampleData, null, 2), {
  ...prettierConfig,
  filepath: outputFile,
});
writeFileSync(outputFile, json);
console.log(
  `wrote ${outputFile}: ${entries.length} cars at ${sampleData.session.timeOfDayText}, ${standingsEntries.length} teams in the standings, ${sampleData.brackets.rounds.length} Super Prime rounds, ${sponsors.length} sponsors`,
);
