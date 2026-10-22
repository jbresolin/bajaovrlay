// The two graphics that reveal in steps (BAJAOVRLAY-43): the elimination bracket, one step
// per "Next", and the podium, one place per "Next" (3rd, 2nd, 1st). The generator writes one
// page per step; the step is on the root (data-step), and what a step has not reached is
// left out of the bracket or kept invisible on the podium, so nothing already shown moves
// when the next step comes.
import { renderBoardHead } from './slateBoards.mjs';
import { escapeHtml, winIcon } from './slateVocabulary.mjs';

// ---------------------------------------------------------------- bracket: the steps

// A bracket is shown in steps. A round with more than four matches is a board: a list of
// its matches, two a row, matchesPerPage (32) a page, so a round of 64 is one page and a
// round of 128 two. The last rounds, from the quarter-finals (four matches) down, are the
// tree, revealed one round per step. An 8-car bracket is therefore three tree steps; a
// 64-car one three boards and three tree steps; a 128-car one four boards (its first round
// in two pages) and the tree. Everything is derived from the rounds and their matches.
const treeRoundMaxMatches = 4;

/** Lists the steps of a bracket: the boards of the big rounds, then the tree's rounds. */
export function planBracketSteps(rounds, matchesPerPage) {
  const steps = [];
  const treeRounds = [];
  rounds.forEach((round) => {
    if (round.matches.length <= treeRoundMaxMatches) {
      treeRounds.push(round);
      return;
    }
    const pageCount = Math.ceil(round.matches.length / matchesPerPage);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const firstIndex = (pageNumber - 1) * matchesPerPage;
      steps.push({
        kind: 'board',
        round,
        pageNumber,
        pageCount,
        matches: round.matches.slice(firstIndex, firstIndex + matchesPerPage),
      });
    }
  });
  treeRounds.forEach((round, index) => {
    steps.push({ kind: 'tree', rounds: treeRounds, roundsShown: index + 1 });
  });
  return steps;
}

// ---------------------------------------------------------------- bracket: a car's pill

// A match's result is modular, and the match says which kind it is by what it carries: a
// count of wins per car when it is best of N (bestOf), a time per car when it was a timed
// run, or nothing but the winner's mark when a win has no number. "—" while undecided.
function renderBracketResult(car, match) {
  const decided = match.winnerCarNumber !== undefined;
  const isWinner = decided && car.carNumber === match.winnerCarNumber;
  let kind = 'time';
  let content = '—';
  if (match.bestOf !== undefined) {
    kind = 'score';
    content = car.wins === undefined ? '—' : String(car.wins);
  } else if (car.timeText !== '') {
    content = car.timeText;
  } else if (decided) {
    kind = 'win';
    content = isWinner ? winIcon : '';
  }
  return `<span class="bracket-car__result bracket-car__result--${kind}">${content}</span>`;
}

function renderBracketCar(car, match, extraClass = '') {
  const decided = match.winnerCarNumber !== undefined;
  let mark = '';
  if (decided) mark = car.carNumber === match.winnerCarNumber ? ' data-winner' : ' data-loser';
  const classes = ['pill', 'bracket-car', extraClass].filter(Boolean).join(' ');
  return `      <div class="${classes}" data-row${mark}>
        <span class="chip">${car.carNumber}</span>
        <span class="bracket-car__team"><span class="bracket-car__name">${escapeHtml(car.teamName)}</span><span class="bracket-car__school">${escapeHtml(car.schoolName)}</span></span>
        ${renderBracketResult(car, match)}
      </div>`;
}

/** One match as two pills, stacked in the tree or side by side on a board. */
export function renderBracketMatch(match, { layout = 'tree', style = '' } = {}) {
  const classes = layout === 'board' ? 'bracket-board__match' : 'bracket__match';
  const carClass = layout === 'board' ? 'bracket-car--board' : '';
  const styleAttribute = style ? ` style="${style}"` : '';
  return `    <div class="${classes}"${styleAttribute} data-match="${match.matchId}">
${renderBracketCar(match.carA, match, carClass)}
${renderBracketCar(match.carB, match, carClass)}
    </div>`;
}

// ---------------------------------------------------------------- bracket: a round board

// Two matches a row, read down the left column then the right, like a draw sheet.
function renderBracketBoard(brackets, step, stepNumber, stepCount, root) {
  const rowsPerColumn = Math.ceil(step.matches.length / 2);
  const pageWords = step.pageCount > 1 ? ` · página ${step.pageNumber}/${step.pageCount}` : '';
  const matches = step.matches
    .map((match) => renderBracketMatch(match, { layout: 'board' }))
    .join('\n');
  return `<section class="board bracket"${root} data-step="${stepNumber}">
${renderBoardHead(brackets.title, `${step.round.name}${pageWords}`, `${stepNumber}/${stepCount}`)}
  <div class="bracket-board" style="--bracket-board-rows: ${rowsPerColumn}">
${matches}
  </div>
</section>`;
}

// ---------------------------------------------------------------- bracket: the tree

// Tree geometry, in the stage's pixels (the board's width by --board-stage-height, under the
// head): the rounds share the width with a gap for the lines between them; a round's matches
// share the height, each centred in its slot, so a match sits between the two it comes from.
const stageWidth = 1728;
const stageHeight = 900;
const columnGap = 96;
const roundNameRoom = 32 + 8;
const carRowHeight = 48;
const matchHeight = carRowHeight * 2 + 3;

function placeRounds(rounds) {
  const columnWidth = Math.round((stageWidth - columnGap * (rounds.length - 1)) / rounds.length);
  return rounds.map((round, roundIndex) => {
    const left = roundIndex * (columnWidth + columnGap);
    const slotHeight = (stageHeight - roundNameRoom) / round.matches.length;
    const matches = round.matches.map((match, matchIndex) => {
      const top = Math.round(
        roundNameRoom + matchIndex * slotHeight + (slotHeight - matchHeight) / 2,
      );
      return { match, top, middle: top + Math.round(matchHeight / 2) };
    });
    return { round, left, width: columnWidth, matches };
  });
}

// The lines from each match to the match it feeds in the next round: out of the pill, half
// way across the gap, up or down to the next match's middle, into it.
function renderBracketLines(placedRounds) {
  const paths = [];
  placedRounds.slice(0, -1).forEach((column, roundIndex) => {
    const nextColumn = placedRounds[roundIndex + 1];
    column.matches.forEach((placed, matchIndex) => {
      const target = nextColumn.matches[Math.floor(matchIndex / 2)];
      if (target === undefined) return;
      const xOut = column.left + column.width;
      const xHalf = xOut + columnGap / 2;
      paths.push(
        `<path d="M${xOut} ${placed.middle}H${xHalf}V${target.middle}H${nextColumn.left}"/>`,
      );
    });
  });
  return paths.join('');
}

// The tree at one step: every round's name from its first step, the matches of the rounds
// reached so far, and the lines between them.
function renderBracketTree(brackets, step, stepNumber, stepCount, root) {
  const placedRounds = placeRounds(step.rounds);
  const shownRounds = placedRounds.slice(0, step.roundsShown);
  const names = placedRounds
    .map(
      (column) =>
        `    <div class="pill pill--head bracket__round-name" style="left: ${column.left}px; width: ${column.width}px"><span class="caption">${escapeHtml(column.round.name)}</span></div>`,
    )
    .join('\n');
  const matches = shownRounds
    .flatMap((column) =>
      column.matches.map((placed) =>
        renderBracketMatch(placed.match, {
          style: `left: ${column.left}px; top: ${placed.top}px; width: ${column.width}px`,
        }),
      ),
    )
    .join('\n');
  return `<section class="board bracket"${root} data-step="${stepNumber}">
${renderBoardHead(brackets.title, '', `${stepNumber}/${stepCount}`)}
  <div class="board__stage">
    <svg class="bracket__lines" viewBox="0 0 ${stageWidth} ${stageHeight}" aria-hidden="true">${renderBracketLines(shownRounds)}</svg>
${names}
${matches}
  </div>
</section>`;
}

/**
 * The bracket at one step (from 1): a round board for a big round, or the tree with the
 * rounds reached so far. A decided match marks its winner (green chip) and dims its loser.
 */
export function renderBracket(brackets, stepNumber, { withRoot = true, matchesPerPage = 32 } = {}) {
  const root = withRoot ? ' data-graphic="bracket"' : '';
  const steps = planBracketSteps(brackets.rounds, matchesPerPage);
  const step = steps[stepNumber - 1];
  if (step === undefined) {
    throw new Error(`The bracket has ${steps.length} steps, not ${stepNumber}.`);
  }
  if (step.kind === 'board') {
    return renderBracketBoard(brackets, step, stepNumber, steps.length, root);
  }
  return renderBracketTree(brackets, step, stepNumber, steps.length, root);
}

// ---------------------------------------------------------------- podium

// Step 1 reveals 3rd, step 2 adds 2nd, step 3 adds 1st; on screen they stand 2nd, 1st, 3rd.
const revealOrder = [3, 2, 1];
const standingOrder = [2, 1, 3];

/** The podium at one step: three cards on one baseline, the revealed ones visible. */
export function renderPodium(podium, step, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="podium"' : '';
  const revealed = revealOrder.slice(0, step);
  const places = standingOrder
    .map((position) => {
      const place = podium.places.find((candidate) => candidate.position === position);
      const mark = revealed.includes(position) ? ' data-revealed' : '';
      return `      <div class="card podium-place podium-place--${position}" data-row${mark}>
        <span class="podium-place__pos">${position}º</span>
        <span class="chip chip--large">${place.carNumber}</span>
        <span class="podium-place__name">${escapeHtml(place.teamName)}</span>
        <span class="podium-place__school">${escapeHtml(place.schoolName)}</span>
      </div>`;
    })
    .join('\n');
  return `<section class="board podium"${root} data-step="${step}">
${renderBoardHead(podium.title, '', `${step}/3`)}
  <div class="board__stage">
    <div class="podium__places">
${places}
    </div>
  </div>
</section>`;
}
