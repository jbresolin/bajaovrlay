// Builds docs/design/sample-data.json from the real samples in packages/shared, with every
// number already written the way it goes on air (pt-BR, gaps and laps to the tenth, cut and
// never rounded, as docs/00-concept.md §8 rules). The mock-ups copy these strings verbatim,
// so no page ever disagrees with another on a number. What no canonical shape carries yet
// (cities, notices, the schedule, messages, sponsors) comes from sampleFixtures.mjs, with each
// car's team looked up here by its number. Run from the repo root:
//   node docs/design/tools/buildSampleData.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';

import { buildBracket64 } from './sampleBracket64.mjs';
import {
  battleFixture,
  bracket64Fixture,
  countdownFixture,
  messageFixtures,
  noticeFixtures,
  qrFixture,
  scheduleFixture,
  sponsorFixtures,
  teamCardFixtures,
} from './sampleFixtures.mjs';
import { buildPlaceholderQrModules } from './samplePlaceholderQr.mjs';

const toolsFolder = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolsFolder, '../../..');
const samplesFolder = resolve(repoRoot, 'packages/shared/src/dataShapes/samples');
const outputFile = resolve(toolsFolder, '../sample-data.json');

const readSample = (name) => JSON.parse(readFileSync(resolve(samplesFolder, name), 'utf8'));
const sessionGreen = readSample('session.enduro-green.json');
const sessionYellow = readSample('session.enduro-yellow.json');
const positions = readSample('positions.enduro-lap-34.json');
const standings = readSample('standings.overall.json');
const brackets = readSample('brackets.suspension.json');

// --- formatting rules, copied from the product (clockFormatting.ts, timingScreenText.ts) ---

/** A countdown rounds partial seconds up; "1:16:00", dropping the hours while zero. */
function formatRemainingClock(clockTimeMs) {
  const wholeSeconds = Math.ceil(Math.max(0, clockTimeMs) / 1000);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours === 0 ? `${minutes}:${ss}` : `${hours}:${mm}:${ss}`;
}

/** 12 399 ms reads "12,3": tenths, cut, decimal comma. */
function writeSecondsToTheTenthCut(durationMs) {
  const wholeTenths = Math.floor(durationMs / 100);
  const wholeSeconds = Math.floor(wholeTenths / 10);
  const tenthDigit = wholeTenths % 10;
  return `${wholeSeconds},${tenthDigit}`;
}

/** A lap time on air: "4:38,2" (minutes, seconds, one tenth, cut). */
function formatLapTimeOnAir(lapTimeMs) {
  const wholeTenths = Math.floor(lapTimeMs / 100);
  const totalSeconds = Math.floor(wholeTenths / 10);
  const tenthDigit = wholeTenths % 10;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds},${tenthDigit}`;
}

/** "+12,3 s", "+1 volta", "+2 voltas", or "" when the source does not know (the leader). */
function formatGapToLeader(entry) {
  if (entry.gapToLeaderLaps !== undefined) {
    return entry.gapToLeaderLaps === 1 ? '+1 volta' : `+${entry.gapToLeaderLaps} voltas`;
  }
  if (entry.gapToLeaderMs !== undefined) {
    return `+${writeSecondsToTheTenthCut(entry.gapToLeaderMs)} s`;
  }
  return '';
}

/** The interval to the car ahead is always a time: "+6,6 s"; "" when unknown. */
function formatInterval(entry) {
  if (entry.intervalMs === undefined) {
    return '';
  }
  return `+${writeSecondsToTheTenthCut(entry.intervalMs)} s`;
}

/** A change of interval: "−0,7" when the gap shrank, "+0,7" when it grew, "0,0" when it held. */
function formatIntervalChange(nowMs, oneLapAgoMs) {
  const changeMs = nowMs - oneLapAgoMs;
  let sign = '';
  if (changeMs < 0) sign = '−';
  if (changeMs > 0) sign = '+';
  return `${sign}${writeSecondsToTheTenthCut(Math.abs(changeMs))}`;
}

/** Points on air keep one decimal with a comma: 646.9 reads "646,9", 64 reads "64,0". */
function formatPoints(points) {
  return points.toFixed(1).replace('.', ',');
}

/** The date of a moment in pt-BR, for a board's head: "sábado, 20 de março de 2027". */
function formatDateInPtBR(momentMs) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(momentMs));
}

const statusLabels = {
  running: 'Em prova',
  inPit: 'No box',
  stopped: 'Quebrado', // João's wording (PR #19): a stopped car is a broken car
  retired: 'Abandonou',
  disqualified: 'Desclassificado',
  notStarted: 'Não largou',
};

const flagLabels = {
  pre: 'PRÉ-LARGADA',
  green: 'VERDE',
  yellow: 'AMARELA',
  red: 'VERMELHA',
  checkered: 'QUADRICULADA',
  finished: 'ENCERRADA',
};

// The dynamic events in the order a standings table lists them, with their column captions.
const eventColumns = [
  { key: 'acceleration', label: 'Aceleração', shortLabel: 'ACEL.' },
  { key: 'speed', label: 'Velocidade', shortLabel: 'VELOC.' },
  { key: 'traction', label: 'Tração', shortLabel: 'TRAÇÃO' },
  { key: 'suspension', label: 'Suspensão', shortLabel: 'SUSP.' },
  { key: 'maneuverability', label: 'Manobrabilidade', shortLabel: 'MANOBR.' },
  { key: 'enduro', label: 'Enduro', shortLabel: 'ENDURO' },
];

const scheduleStatusLabels = { done: 'Concluída', live: 'Em andamento', next: 'A seguir' };

function describeSession(session) {
  const laps = session.lapsCompletedByLeader;
  return {
    eventName: session.eventName,
    sessionName: session.sessionName,
    flag: session.state,
    flagLabel: flagLabels[session.state],
    clockCaption: 'TEMPO RESTANTE',
    timeRemaining: formatRemainingClock(session.clock.referenceTimeMs),
    lapsCompletedByLeader: laps,
    lapsLabel: laps === 1 ? '1 VOLTA' : `${laps} VOLTAS`,
    dateText: formatDateInPtBR(session.updatedAtMs),
  };
}

const entries = positions.entries.map((entry) => ({
  position: entry.position,
  carNumber: entry.carNumber,
  teamName: entry.teamName,
  schoolName: entry.schoolName,
  laps: entry.laps,
  status: entry.status,
  statusLabel: statusLabels[entry.status],
  gapText: formatGapToLeader(entry),
  intervalText: formatInterval(entry),
  lastLapText: entry.lastLapMs === undefined ? '' : formatLapTimeOnAir(entry.lastLapMs),
  bestLapText: entry.bestLapMs === undefined ? '' : formatLapTimeOnAir(entry.bestLapMs),
  pitStops: entry.pitStops ?? 0,
}));

/** The on-air entry of a car a fixture names by its number; a wrong number fails loudly. */
function entryOfCar(carNumber) {
  const entry = entries.find((candidate) => candidate.carNumber === carNumber);
  if (entry === undefined) {
    throw new Error(`No car ${carNumber} in the positions sample.`);
  }
  return entry;
}

const fastest = positions.entries
  .filter((entry) => entry.bestLapMs !== undefined)
  .sort((a, b) => a.bestLapMs - b.bestLapMs)[0];

// --- standings: the overall table with points per event, and one event's table derived
// from it (a canonical per-event standings would come with scope "enduro"; the sample holds
// only the overall scope, so the enduro column is ranked here, tied teams sharing a rank).

function describeStandingsEntry(entry) {
  return {
    rank: entry.rank,
    carNumber: entry.carNumber,
    teamName: entry.teamName,
    schoolName: entry.schoolName,
    pointsText: formatPoints(entry.points),
    pointsByEventText: Object.fromEntries(
      eventColumns.map((column) => {
        const points = entry.pointsByEvent?.[column.key];
        return [column.key, points === undefined ? '—' : formatPoints(points)];
      }),
    ),
  };
}

function rankOneEvent(eventKey) {
  const ranked = [...standings.entries]
    .filter((entry) => entry.pointsByEvent?.[eventKey] !== undefined)
    .sort((a, b) => b.pointsByEvent[eventKey] - a.pointsByEvent[eventKey]);
  let rank = 0;
  let previousPoints = null;
  return ranked.map((entry, index) => {
    const points = entry.pointsByEvent[eventKey];
    if (points !== previousPoints) {
      rank = index + 1;
      previousPoints = points;
    }
    return {
      rank,
      carNumber: entry.carNumber,
      teamName: entry.teamName,
      schoolName: entry.schoolName,
      pointsText: formatPoints(points),
    };
  });
}

// --- brackets: every time written as a lap time; the winner left out until decided.

function describeBracketCar(car) {
  return {
    carNumber: car.carNumber,
    teamName: car.teamName,
    schoolName: car.schoolName,
    timeText: car.timeMs === undefined ? '' : formatLapTimeOnAir(car.timeMs),
  };
}

const bracketRounds = brackets.rounds.map((round) => ({
  name: round.name,
  matches: round.matches.map((match) => ({
    matchId: match.matchId,
    carA: describeBracketCar(match.carA),
    carB: describeBracketCar(match.carB),
    winnerCarNumber: match.winnerCarNumber,
  })),
}));

// --- the 64-slot bracket (sampleBracket64.mjs): the positions sample's 60 cars seeded by
// their place; the four slots past the field are empty, so the top four seeds get a bye.

const seededField = entries.map((entry) => ({
  carNumber: entry.carNumber,
  teamName: entry.teamName,
  schoolName: entry.schoolName,
}));

// --- the battle card: the two cars of the fixture, the interval between them as the
// positions sample gives it, and the three trends from the interval a lap ago.

const behindEntry = positions.entries.find(
  (entry) => entry.carNumber === battleFixture.behindCarNumber,
);
/** A change under a tenth (what the screen can show) is steady; else closing or opening. */
function trendOfChange(changeMs) {
  if (Math.abs(changeMs) < 100) return 'steady';
  return changeMs < 0 ? 'closing' : 'opening';
}

// The battle's readings lap by lap for the demo's Atualizar: a lap ago, now, then later laps.
const battleReadingsMs = [
  battleFixture.intervalOneLapAgoMs.closing,
  behindEntry.intervalMs,
  ...battleFixture.laterIntervalsMs,
];
const battle = {
  ahead: entryOfCar(battleFixture.aheadCarNumber),
  behind: entryOfCar(battleFixture.behindCarNumber),
  gapText: `+${writeSecondsToTheTenthCut(behindEntry.intervalMs)}`,
  trends: Object.fromEntries(
    Object.entries(battleFixture.intervalOneLapAgoMs).map(([trend, oneLapAgoMs]) => [
      trend,
      formatIntervalChange(behindEntry.intervalMs, oneLapAgoMs),
    ]),
  ),
  updates: battleReadingsMs.slice(1).map((readingMs, index) => {
    const trend = trendOfChange(readingMs - battleReadingsMs[index]);
    const changeText = formatIntervalChange(readingMs, battleReadingsMs[index]);
    return { gapText: `+${writeSecondsToTheTenthCut(readingMs)}`, trend, changeText };
  }),
};

const sampleData = {
  about:
    'Generated by docs/design/tools/buildSampleData.mjs from packages/shared/src/dataShapes/samples and sampleFixtures.mjs. Strings are final on-air text (pt-BR). Do not edit by hand.',
  session: describeSession(sessionGreen),
  sessionYellow: describeSession(sessionYellow),
  positions: entries,
  fastestLap: {
    carNumber: fastest.carNumber,
    teamName: fastest.teamName,
    schoolName: fastest.schoolName,
    bestLapText: formatLapTimeOnAir(fastest.bestLapMs),
    lap: fastest.laps,
  },
  standingsTop5: standings.entries.slice(0, 5).map((entry) => ({
    rank: entry.rank,
    carNumber: entry.carNumber,
    teamName: entry.teamName,
    schoolName: entry.schoolName,
    pointsText: formatPoints(entry.points),
  })),
  standings: {
    scope: standings.scope,
    title: 'Classificação geral',
    eventColumns: eventColumns.map((column) => ({ key: column.key, label: column.shortLabel })),
    entries: standings.entries.map(describeStandingsEntry),
  },
  standingsEnduro: {
    scope: 'enduro',
    title: 'Classificação · Enduro',
    entries: rankOneEvent('enduro'),
  },
  brackets: {
    title: 'Eliminatórias · Suspensão',
    rounds: bracketRounds,
  },
  bracket64: buildBracket64(seededField, bracket64Fixture),
  podium: {
    title: `Pódio · ${sessionGreen.sessionName}`,
    places: entries.slice(0, 3),
  },
  teamCards: {
    withMedia: {
      ...entryOfCar(teamCardFixtures.withMedia.carNumber),
      ...teamCardFixtures.withMedia,
    },
    withoutMedia: {
      ...entryOfCar(teamCardFixtures.withoutMedia.carNumber),
      ...teamCardFixtures.withoutMedia,
    },
  },
  battle,
  notices: Object.fromEntries(
    Object.entries(noticeFixtures).map(([name, notice]) => [
      name,
      { ...entryOfCar(notice.carNumber), ...notice },
    ]),
  ),
  countdown: {
    sessionName: countdownFixture.sessionName,
    startTimeText: countdownFixture.startTimeText,
    remainingText: formatRemainingClock(countdownFixture.remainingMs),
    remainingSeconds: Math.ceil(countdownFixture.remainingMs / 1000),
  },
  schedule: scheduleFixture.map((slot) => ({
    ...slot,
    statusLabel: scheduleStatusLabels[slot.status],
  })),
  messages: messageFixtures,
  sponsors: sponsorFixtures.map((name) => ({ name, initial: name.slice(-1) })),
  qr: { ...qrFixture, modules: buildPlaceholderQrModules(25) },
  people: [
    { name: 'Mariana Costa', role: 'Capitã da equipe', team: 'Acauã Baja · Mauá', carNumber: 31 },
    { name: 'Carlos Henrique Lima', role: 'Diretor de prova', team: '' },
    { name: 'Rafael Nogueira', role: 'Narrador', team: '' },
  ],
  sponsorBug: {
    eventLabel: 'ENDURO',
    sponsorLine: 'Apresentado por',
    sponsorName: 'Metalúrgica Serrana',
    note: 'The sponsor name is a fictional placeholder: no sponsor artwork exists in the repo. The logo is the event logo from docs/brand/.',
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
  `wrote ${outputFile}: ${entries.length} cars, leader on lap ${sampleData.session.lapsCompletedByLeader}, ${standings.entries.length} teams in the standings, ${bracketRounds.length} bracket rounds`,
);
