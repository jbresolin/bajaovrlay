// The two graphics that reveal in steps (BAJAOVRLAY-43): the elimination bracket, one round
// per "Next", and the podium, one place per "Next" (3rd, 2nd, 1st). The generator writes one
// page per step; the step is on the root (data-step), the rounds a step has not reached are
// left out of the bracket, and the places not yet revealed stay invisible on the podium, so
// nothing already shown moves when the next step comes.
import { renderBoardHead } from './slateBoards.mjs';
import { escapeHtml } from './slateVocabulary.mjs';

// ---------------------------------------------------------------- bracket

// Bracket geometry, in the stage's pixels (the board's width by --board-stage-height, under
// the head): the rounds share the width with a gap for the lines between them; a round's
// matches share the height, each centred in its slot, so a match sits between the two it
// comes from. Everything is derived from the rounds and their matches, nothing else.
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

function renderBracketCar(car, match) {
  const decided = match.winnerCarNumber !== undefined;
  let mark = '';
  if (decided) mark = car.carNumber === match.winnerCarNumber ? ' data-winner' : ' data-loser';
  const time = car.timeText === '' ? '—' : car.timeText;
  return `      <div class="pill bracket-car" data-row${mark}>
        <span class="chip">${car.carNumber}</span>
        <span class="bracket-car__team"><span class="bracket-car__name">${escapeHtml(car.teamName)}</span><span class="bracket-car__school">${escapeHtml(car.schoolName)}</span></span>
        <span class="bracket-car__time">${time}</span>
      </div>`;
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

/**
 * The bracket at one step: every round's name from the first step, the matches of the rounds
 * reached so far, and the lines between them. A decided match marks its winner (green chip)
 * and dims its loser; an undecided one shows "—" for the times.
 */
export function renderBracket(brackets, step, { withRoot = true } = {}) {
  const root = withRoot ? ' data-graphic="bracket"' : '';
  const placedRounds = placeRounds(brackets.rounds);
  const shownRounds = placedRounds.slice(0, step);
  const names = placedRounds
    .map(
      (column) =>
        `    <div class="pill pill--head bracket__round-name" style="left: ${column.left}px; width: ${column.width}px"><span class="caption">${escapeHtml(column.round.name)}</span></div>`,
    )
    .join('\n');
  const matches = shownRounds
    .flatMap((column) =>
      column.matches.map(
        (
          placed,
        ) => `    <div class="bracket__match" style="left: ${column.left}px; top: ${placed.top}px; width: ${column.width}px" data-match="${placed.match.matchId}">
${renderBracketCar(placed.match.carA, placed.match)}
${renderBracketCar(placed.match.carB, placed.match)}
    </div>`,
      ),
    )
    .join('\n');
  const stepWords = `${step}/${placedRounds.length} RODADAS`;
  return `<section class="board bracket"${root} data-step="${step}">
${renderBoardHead(brackets.title, '', stepWords)}
  <div class="board__stage">
    <svg class="bracket__lines" viewBox="0 0 ${stageWidth} ${stageHeight}" aria-hidden="true">${renderBracketLines(shownRounds)}</svg>
${names}
${matches}
  </div>
</section>`;
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
