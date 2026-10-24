// The two graphics that reveal in steps (BAJAOVRLAY-43): the elimination bracket, one step
// per "Next", and the podium, one place per "Next" (3rd, 2nd, 1st). The generator writes one
// page per step; the step is on the root (data-step), and what a step has not reached is
// left out of the bracket or kept invisible on the podium, so nothing already shown moves
// when the next step comes.
import { renderBoardHead } from './slateBoards.mjs';
import { escapeHtml, renderLogo, winIcon } from './slateVocabulary.mjs';

// ---------------------------------------------------------------- bracket: the steps

// A bracket is shown in steps. A round with more than four matches is a board: a draw sheet
// of its matches, one card each, in two columns, matchesPerPage (32) a page, so a round of 64
// is one page and a round of 128 two. The last rounds, from the quarter-finals (four matches) down, are the
// tree, revealed one round per step. An 8-car bracket is therefore three tree steps; a
// 64-car one three boards and three tree steps; a 128-car one four boards (its first round
// in two pages) and the tree. Everything is derived from the rounds and their matches.
const treeRoundMaxMatches = 4;

/**
 * Lists the steps of a bracket: the boards of the big rounds, then the tree's rounds. A
 * third-place match (a round with isThirdPlace) is not a column of the tree: it sits under
 * the final, in the final's column, and gets its own step just before the final's, as it
 * runs before the final.
 */
export function planBracketSteps(rounds, matchesPerPage) {
  const steps = [];
  const treeRounds = [];
  const thirdPlaceRound = rounds.find((round) => round.isThirdPlace);
  rounds.forEach((round) => {
    if (round.isThirdPlace) return;
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
    const isFinal = index === treeRounds.length - 1;
    const treeStep = { kind: 'tree', rounds: treeRounds, thirdPlaceRound, roundsShown: index + 1 };
    if (isFinal && thirdPlaceRound !== undefined) {
      steps.push({ ...treeStep, roundsShown: index, isThirdPlaceShown: true });
    }
    steps.push({ ...treeStep, isThirdPlaceShown: isFinal && thirdPlaceRound !== undefined });
  });
  return steps;
}

// ---------------------------------------------------------------- bracket: a car and its result

// A match's result is modular, and the match says which kind it is by what it carries: a
// count of wins per car when it is best of N (bestOf), a time per car when it was a timed
// run, or nothing but the winner's mark when a win has no number. A walkover overrides all
// three: the winner advanced without racing (the opponent did not run, or there was none),
// so the winner carries the "W.O." tag and the other car "—". "—" on both while undecided.
function renderBracketResult(car, match) {
  const decided = match.winnerCarNumber !== undefined;
  const isWinner = decided && car.carNumber === match.winnerCarNumber;
  let kind = 'time';
  let content = '—';
  if (match.walkover) {
    kind = 'walkover';
    content = isWinner ? '<span class="walkover-tag">W.O.</span>' : '—';
  } else if (match.bestOf !== undefined) {
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

/** ' data-winner', ' data-loser' or nothing (undecided), for a car of a match. */
function markWinnerOrLoser(car, match) {
  if (match.winnerCarNumber === undefined) return '';
  return car.carNumber === match.winnerCarNumber ? ' data-winner' : ' data-loser';
}

// A round board's card has half the width of a tree pill for each car, so it names a team by
// its short name when it has one ("Piratas Cerrado", not "Kaizen Piratas do Cerrado").
function renderBracketTeam(car, { isShort = false } = {}) {
  const teamName = isShort ? (car.teamShortName ?? car.teamName) : car.teamName;
  return `<span class="bracket-car__team"><span class="bracket-car__name">${escapeHtml(teamName)}</span><span class="bracket-car__school">${escapeHtml(car.schoolName)}</span></span>`;
}

// The empty slot of a bye: no chip, no team, a dashed outline, so it can never be read as a
// car; the car facing it carries the W.O. tag.
const emptySlotWords = 'SEM ADVERSÁRIO';

// ---------------------------------------------------------------- bracket: a match in the tree

// Each car carries its slot (data-slot "a" or "b"), so the Super Prime timeline can show a slot
// whose car is not known yet.
function renderTreeCar(car, match, slot) {
  if (car === undefined) {
    return `      <div class="bracket-car bracket-car--empty" data-slot="${slot}"><span class="bracket-empty">${emptySlotWords}</span></div>`;
  }
  return `      <div class="pill bracket-car" data-row data-slot="${slot}"${markWinnerOrLoser(car, match)}>
        <span class="chip">${car.carNumber}</span>
        ${renderBracketTeam(car)}
        ${renderBracketResult(car, match)}
      </div>`;
}

// ---------------------------------------------------------------- bracket: a match on a board

// On a board a match is one card: the two cars face each other across a "×", chips on the
// outer edges and the results meeting in the middle, read like a football score line
// ("2 × 1", "W.O. × —"), so who runs against whom is never in doubt.
function renderFixtureSide(car, match, side) {
  const sideClass = `bracket-fixture__side bracket-fixture__side--${side}`;
  const slot = side === 'left' ? 'a' : 'b';
  if (car === undefined) {
    return `      <div class="${sideClass} bracket-fixture__side--empty" data-slot="${slot}"><span class="bracket-empty">${emptySlotWords}</span></div>`;
  }
  const chip = `<span class="chip">${car.carNumber}</span>`;
  const team = renderBracketTeam(car, { isShort: true });
  const result = renderBracketResult(car, match);
  const cells = side === 'left' ? [chip, team, result] : [result, team, chip];
  return `      <div class="${sideClass}" data-row data-slot="${slot}"${markWinnerOrLoser(car, match)}>
        ${cells.join('\n        ')}
      </div>`;
}

/**
 * One match: two stacked pills in the tree, or one score-line card on a board. A tree match
 * carries its round's index (data-round), so a step can reveal one round at a time.
 */
export function renderBracketMatch(match, { layout = 'tree', style = '', round } = {}) {
  const roundAttribute = round === undefined ? '' : ` data-round="${round}"`;
  const styleAttribute = `${style ? ` style="${style}"` : ''}${roundAttribute}`;
  if (layout === 'board') {
    return `    <div class="card bracket-fixture"${styleAttribute} data-match="${match.matchId}">
${renderFixtureSide(match.carA, match, 'left')}
      <span class="bracket-fixture__versus">×</span>
${renderFixtureSide(match.carB, match, 'right')}
    </div>`;
  }
  return `    <div class="bracket__match"${styleAttribute} data-match="${match.matchId}">
${renderTreeCar(match.carA, match, 'a')}
${renderTreeCar(match.carB, match, 'b')}
    </div>`;
}

// ---------------------------------------------------------------- bracket: a round board

// Two columns of match cards, read down the left column then the right, like a draw sheet;
// the gutter between the columns is wider than the gap between cards, so a row is never read
// across as one match.
/** The head's line for a step: a board's round name (and page), nothing for the tree. */
export function writeBracketStepSubtitle(step) {
  if (step.kind !== 'board') return '';
  const pageWords = step.pageCount > 1 ? ` · página ${step.pageNumber}/${step.pageCount}` : '';
  return `${step.round.name}${pageWords}`;
}

/** A round board's body: its match cards in two columns. */
export function renderBracketBoardBody(step) {
  const rowsPerColumn = Math.ceil(step.matches.length / 2);
  const matches = step.matches
    .map((match) => renderBracketMatch(match, { layout: 'board' }))
    .join('\n');
  return `  <div class="bracket-board" style="--bracket-board-rows: ${rowsPerColumn}">
${matches}
  </div>`;
}

function renderBracketBoard(brackets, step, stepNumber, stepCount, root) {
  return `<section class="board bracket"${root} data-step="${stepNumber}">
${renderBoardHead(brackets.title, writeBracketStepSubtitle(step), `${stepNumber}/${stepCount}`)}
${renderBracketBoardBody(step)}
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
// way across the gap, up or down to the next match's middle, into it. Each line carries the
// round it leads into (data-round), so it can appear with that round.
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
        `<path data-round="${roundIndex + 1}" d="M${xOut} ${placed.middle}H${xHalf}V${target.middle}H${nextColumn.left}"/>`,
      );
    });
  });
  return paths.join('');
}

// The third-place match sits at the foot of the final's column, its name pill above it, well
// below the final (which is centred between the semifinals), with no line into it.
function placeThirdPlace(placedRounds, thirdPlaceRound) {
  const finalColumn = placedRounds.at(-1);
  const top = stageHeight - matchHeight;
  return {
    round: thirdPlaceRound,
    left: finalColumn.left,
    width: finalColumn.width,
    top,
    nameTop: top - roundNameRoom,
  };
}

/**
 * The tree's body: every round's name, the matches of the first `roundsShown` rounds and the
 * lines between them, and the third-place match when there is one and it is shown.
 */
export function renderBracketTreeBody(
  rounds,
  roundsShown,
  thirdPlaceRound,
  isThirdPlaceShown = false,
) {
  const placedRounds = placeRounds(rounds);
  const shownRounds = placedRounds.slice(0, roundsShown);
  const thirdPlace =
    thirdPlaceRound === undefined ? undefined : placeThirdPlace(placedRounds, thirdPlaceRound);
  const thirdPlaceName =
    thirdPlace === undefined
      ? ''
      : `\n    <div class="pill pill--head bracket__round-name" style="left: ${thirdPlace.left}px; top: ${thirdPlace.nameTop}px; width: ${thirdPlace.width}px"><span class="caption">${escapeHtml(thirdPlace.round.name)}</span></div>`;
  const thirdPlaceMatch =
    thirdPlace !== undefined && isThirdPlaceShown
      ? `\n${renderBracketMatch(thirdPlace.round.matches[0], {
          style: `left: ${thirdPlace.left}px; top: ${thirdPlace.top}px; width: ${thirdPlace.width}px`,
          round: 'third',
        })}`
      : '';
  const names = placedRounds
    .map(
      (column) =>
        `    <div class="pill pill--head bracket__round-name" style="left: ${column.left}px; width: ${column.width}px"><span class="caption">${escapeHtml(column.round.name)}</span></div>`,
    )
    .join('\n');
  const matches = shownRounds
    .flatMap((column, roundIndex) =>
      column.matches.map((placed) =>
        renderBracketMatch(placed.match, {
          style: `left: ${column.left}px; top: ${placed.top}px; width: ${column.width}px`,
          round: roundIndex,
        }),
      ),
    )
    .join('\n');
  return `  <div class="board__stage">
    <svg class="bracket__lines" viewBox="0 0 ${stageWidth} ${stageHeight}" aria-hidden="true">${renderBracketLines(shownRounds)}</svg>
${names}${thirdPlaceName}
${matches}${thirdPlaceMatch}
  </div>`;
}

// The tree at one step: every round's name from its first step, the matches of the rounds
// reached so far, and the lines between them.
function renderBracketTree(brackets, step, stepNumber, stepCount, root) {
  return `<section class="board bracket"${root} data-step="${stepNumber}">
${renderBoardHead(brackets.title, '', `${stepNumber}/${stepCount}`)}
${renderBracketTreeBody(step.rounds, step.roundsShown, step.thirdPlaceRound, step.isThirdPlaceShown)}
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
      // The team's logo crowns the card when the team has one; without it the card is shorter
      // at the top, its baseline unchanged.
      const logo =
        place.logo === undefined ? '' : `\n        ${renderLogo(place.logo, 'podium-place__logo')}`;
      return `      <div class="card podium-place podium-place--${position}" data-row${mark}>${logo}
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
