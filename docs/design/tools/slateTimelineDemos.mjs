// The two timelines (BAJAOVRLAY-43): pages that replay the real results, so the graphics can
// be judged at any moment of the day rather than only at the static pages' one. The enduro
// timeline runs the race clock, the towers and the fastest-lap notice from the lap passes
// (enduro_passes.xlsx); the Super Prime timeline decides the real bracket match by match
// (super_prime.md). This file draws their stage, templates and data; the browser side is
// timelineEnduro.js and timelineSuperPrime.js. slateMotionDemos.mjs lists them last.
import { renderBoardHead } from './slateBoards.mjs';
import { renderTemplate } from './slateMotionDemoParts.mjs';
import { renderFastestLap } from './slateNotices.mjs';
import {
  planBracketSteps,
  renderBracketBoardBody,
  renderBracketTreeBody,
  writeBracketStepSubtitle,
} from './slateSteps.mjs';
import {
  renderCompactTower,
  renderDetailedTower,
  renderFlagBand,
  renderRaceClock,
  sample,
} from './slateTemplates.mjs';
import { flagWords } from './slateVocabulary.mjs';

// The detailed tower's columns the passes can fill: no pit stops or status in the export.
const enduroDetailedColumns = ['gap', 'interval', 'last-lap', 'best-lap'];
const timelineGroup = 'Linha do tempo';

function buildEnduroTimeline(options) {
  const { compactRows } = options;
  const everyCar = sample.positions;
  return {
    fileName: 'motion-enduro-linha-do-tempo.html',
    group: timelineGroup,
    variant: 'Enduro real: relógio, torres e melhor volta',
    demoName: 'enduro-timeline',
    scriptFiles: ['enduroTiming.js', 'timelineEnduro.js'],
    actions: ['enter', 'exit', 'view', 'page'],
    timelineActions: [
      'start',
      'minuteBack',
      'passBack',
      'playPause',
      'passForward',
      'minuteForward',
      'end',
      'speed',
    ],
    stage: [
      renderRaceClock(sample.session),
      renderCompactTower(everyCar, sample.session),
      renderDetailedTower(everyCar, sample.session, { columns: enduroDetailedColumns }),
      renderFastestLap(sample.fastestLap),
    ].join('\n'),
    templates: ['pre', 'green', 'checkered'].map((flag) =>
      renderTemplate(`band-${flag}`, renderFlagBand(flag, flagWords[flag])),
    ),
    config: { ...sample.enduroTimeline, rowsPerPage: compactRows },
  };
}

// ---------------------------------------------------------------- Super Prime

// Where each slot's car comes from: nowhere in the first round (the draw), the winner of the
// previous round's match 2m − 1 (slot a) or 2m (slot b), and for the third-place match the
// loser of each semifinal; the same rule sampleSuperPrime.mjs placed the cars by.
function listSlotSources(rounds) {
  const sourcesByMatchId = new Map();
  const semifinal = rounds.find((round) => round.name === 'Semifinal');
  rounds.forEach((round, roundIndex) => {
    round.matches.forEach((match, matchIndex) => {
      let sources = { a: null, b: null };
      if (round.isThirdPlace) {
        sources = {
          a: { matchId: semifinal.matches[0].matchId },
          b: { matchId: semifinal.matches[1].matchId },
        };
      } else if (roundIndex > 0) {
        const previousMatches = rounds[roundIndex - 1].matches;
        sources = {
          a: { matchId: previousMatches[matchIndex * 2].matchId },
          b: { matchId: previousMatches[matchIndex * 2 + 1].matchId },
        };
      }
      sourcesByMatchId.set(match.matchId, sources);
    });
  });
  return sourcesByMatchId;
}

const carWords = (car) => `${car.carNumber} ${car.teamShortName ?? car.teamName}`;

function writeMatchWords(round, match) {
  const winner = match.carA.carNumber === match.winnerCarNumber ? match.carA : match.carB;
  const walkoverWords = match.walkover ? ' por W.O.' : '';
  return `${round.name}: ${carWords(match.carA)} × ${carWords(match.carB)} · vence ${carWords(winner)}${walkoverWords}`;
}

// The order the day ran: round by round, the third-place match just before the final; a bye
// is no step (it is decided by the draw, step 0).
function listMatchSteps(rounds) {
  const thirdPlaceRound = rounds.find((round) => round.isThirdPlace);
  const final = rounds.find((round) => round.name === 'Final');
  const orderedRounds = rounds.filter((round) => !round.isThirdPlace);
  if (thirdPlaceRound !== undefined)
    orderedRounds.splice(orderedRounds.indexOf(final), 0, thirdPlaceRound);
  return orderedRounds.flatMap((round) =>
    round.matches
      .filter((match) => match.carB !== undefined)
      .map((match) => ({ matchId: match.matchId, words: writeMatchWords(round, match) })),
  );
}

function buildSuperPrimeTimeline() {
  const { brackets } = sample;
  const bracketSteps = planBracketSteps(brackets.rounds, 32);
  const views = [];
  const viewByMatchId = new Map();
  const templates = [];
  bracketSteps.forEach((step, index) => {
    if (step.kind === 'board') {
      const viewId = `board-${index + 1}`;
      views.push({
        id: viewId,
        template: `view-${viewId}`,
        subtitle: writeBracketStepSubtitle(step),
      });
      templates.push(renderTemplate(`view-${viewId}`, renderBracketBoardBody(step)));
      step.matches.forEach((match) => viewByMatchId.set(match.matchId, viewId));
      return;
    }
    if (views.some((view) => view.id === 'tree')) return;
    views.push({ id: 'tree', template: 'view-tree', subtitle: '' });
    templates.push(
      renderTemplate(
        'view-tree',
        renderBracketTreeBody(step.rounds, step.rounds.length, step.thirdPlaceRound, true),
      ),
    );
    [...step.rounds, step.thirdPlaceRound]
      .filter((round) => round !== undefined)
      .forEach((round) =>
        round.matches.forEach((match) => viewByMatchId.set(match.matchId, 'tree')),
      );
  });
  const sourcesByMatchId = listSlotSources(brackets.rounds);
  const matches = brackets.rounds.flatMap((round) =>
    round.matches.map((match) => ({
      id: match.matchId,
      view: viewByMatchId.get(match.matchId),
      isBye: match.carB === undefined,
      sources: sourcesByMatchId.get(match.matchId),
    })),
  );
  const byeCount = matches.filter((match) => match.isBye).length;
  const steps = [
    {
      matchId: null,
      words: `o sorteio: ${byeCount} carros passam por W.O. sem adversário; Próximo decide o primeiro jogo`,
    },
    ...listMatchSteps(brackets.rounds),
  ];
  return {
    fileName: 'motion-super-prime-linha-do-tempo.html',
    group: timelineGroup,
    variant: 'Super Prime real: jogo a jogo, do sorteio à final',
    demoName: 'super-prime-timeline',
    scriptFiles: ['timelineSuperPrime.js'],
    actions: ['enter', 'exit'],
    timelineActions: ['start', 'previous', 'next', 'end'],
    stage: `<section class="board bracket" data-graphic="bracket">
${renderBoardHead(brackets.title, views[0].subtitle, `0/${steps.length - 1}`)}
  <div class="bracket__body"></div>
</section>`,
    templates,
    config: { matches, views, steps },
  };
}

/** The two timelines, enduro first. */
export function listTimelineDemos(options) {
  return [buildEnduroTimeline(options), buildSuperPrimeTimeline()];
}
