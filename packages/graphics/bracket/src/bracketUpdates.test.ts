/**
 * The bracket's updates: in place, a result arriving, fewer steps, the stop-out
 * (packages/graphics/bracket)
 *
 * What this module is for:
 *   The bracket is bound live to a source's brackets, so updates arrive while it is on air:
 *   a result, a round listed, a correction. updateAction redraws the step on screen in
 *   place; nothing on screen moves (motion.md, "Bracket"). A result arriving while its
 *   match is on screen crossfades its cells and turns the winner's chip green over
 *   `--motion-flag`; an update during the stop-out is only kept.
 *
 * What these tests prove:
 *   - An update on air keeps every card element, starts no motion on them, and shows the
 *     new texts.
 *   - A result arriving on a board crossfades: the two cells fade in, the winner's green
 *     fill fades up and the loser fades to its dimmed look, each over `--motion-flag`, and
 *     nothing moves; once the crossfade ends the styles hold the end look.
 *   - A match listed in a round on screen appears at once, in its place.
 *   - Rounds that leave the bracket fewer steps than the one on screen bring it back to its
 *     last step at once, so the server's own step brought back ("goto") changes nothing.
 *   - An update off air is drawn hidden; one during the stop-out is only kept, the fading
 *     card keeping its texts, and drawn once the stop-out has ended.
 *
 * What these tests deliberately do not cover:
 *   - Which cells a change is: matchResults.test.ts (the signatures).
 *   - Ending a crossfade on stop, dispose and disconnect: bracketMotionStops.test.ts.
 */
import { finishEveryRunningMotionAtOnce } from '@bajaovrlay/graphics-kit/runningMotions.testSupport';
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import type BracketGraphic from './bracket.js';
import type { BracketData } from './bracketModel.js';
import {
  ardosiaMotionTokenDeclarations,
  ardosiaTreeTokenDeclarations,
  createBracketOnThePage,
  describeTheStage,
  findEveryPartOfBracket,
  findResultCellOfCar,
  isPieceShown,
  loadBracketWithData,
  placeTokensOnTheRoot,
} from './bracketOnThePage.testSupport.js';
import { createResultStatesOnABoard, createTheRealSuperPrime } from './previewData.js';

/** A bracket loaded with `data` and the theme's tree sizes, on air at `stepIndex`. */
async function createBracketOnAirAtStep(
  data: BracketData,
  stepIndex: number,
): Promise<BracketGraphic> {
  placeTokensOnTheRoot(ardosiaTreeTokenDeclarations);
  const bracket = createBracketOnThePage();
  await loadBracketWithData(bracket, data);
  await bracket.playAction({ goto: stepIndex, skipAnimation: true });
  return bracket;
}

/** The six result states with the undecided one (Corisco × Buffalo) won by Corisco. */
function decideTheUndecidedResult(data: BracketData): BracketData {
  const rounds = data.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) =>
      match.matchId === 'antes-de-decidir' ? { ...match, winnerCarNumber: 32 } : match,
    ),
  }));
  return { ...data, rounds };
}

/** The tweens GSAP runs on an element, with their duration in ms and whether they move it. */
function describeTweensOf(element: Element | undefined) {
  return gsap.getTweensOf(element ?? []).map((tween) => ({
    durationMs: Math.round(tween.duration() * 1000),
    movesIt: 'y' in tween.vars || 'x' in tween.vars,
  }));
}

/** An eight-car elimination's rounds: quarter-finals, semifinals, final (3 steps). */
function buildEightCarRounds(): BracketData['rounds'] {
  const superPrime = createTheRealSuperPrime();
  return superPrime.rounds.filter(
    (round) => round.matches.length <= 4 && round.isThirdPlace !== true,
  );
}

describe('updateAction on air', () => {
  it('keeps every card in place, with no motion, and shows the new texts', async () => {
    // Arrange: the Super Prime's 16 avos on air; its first card noted.
    const bracket = await createBracketOnAirAtStep(createTheRealSuperPrime(), 1);
    const cardsBefore = findEveryPartOfBracket(bracket, 'bracket-match-card');

    // Act: a correction from the source: Baja UFMG's name written in full.
    const corrected = createTheRealSuperPrime();
    const corrections = corrected.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) =>
        match.carA.carNumber === 2
          ? { ...match, carA: { ...match.carA, teamName: 'Equipe Baja UFMG' } }
          : match,
      ),
    }));
    const answer = await bracket.updateAction({ data: { rounds: corrections } });
    const cardsAfter = findEveryPartOfBracket(bracket, 'bracket-match-card');

    // Assert: 200, the same elements, no tween on any, the new name drawn.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(cardsAfter, 'every card element is kept').toEqual(cardsBefore);
    expect(gsap.getTweensOf(cardsAfter), 'no card moves').toEqual([]);
    expect(
      cardsAfter[0]?.querySelector('[data-testid="bracket-team-name"]')?.textContent,
      'the card shows the corrected name',
    ).toBe('Equipe Baja UFMG');
  });

  it('crossfades a result arriving: the cells, the winner’s green and the loser’s dimming, over --motion-flag', async () => {
    // Arrange: the theme's motion on the page, the six result states on air on a board.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const bracket = await createBracketOnAirAtStep(createResultStatesOnABoard(), 0);

    // Act: the undecided match's result arrives: Corisco won.
    await bracket.updateAction({ data: decideTheUndecidedResult(createResultStatesOnABoard()) });
    const coriscoCell = findResultCellOfCar(bracket, 'antes-de-decidir:carA');
    const buffaloCell = findResultCellOfCar(bracket, 'antes-de-decidir:carB');
    const corisco = coriscoCell?.closest('[data-outcome]');
    const buffalo = buffaloCell?.closest('[data-outcome]');
    const coriscoFill =
      corisco?.querySelector('[data-testid="bracket-chip-winner-fill"]') ?? undefined;
    const tweensDuringTheCrossfade = {
      coriscoCell: describeTweensOf(coriscoCell),
      buffaloCell: describeTweensOf(buffaloCell),
      coriscoFill: describeTweensOf(coriscoFill),
      buffalo: describeTweensOf(buffalo ?? undefined),
      everyCard: gsap.getTweensOf(findEveryPartOfBracket(bracket, 'bracket-match-card')),
    };
    finishEveryRunningMotionAtOnce();

    // Assert: the winner and the loser marked; each change fades over --motion-flag (300 ms)
    // without moving; the cards themselves untouched; at the end the styles hold the look.
    const crossfade = [{ durationMs: 300, movesIt: false }];
    expect(corisco?.getAttribute('data-outcome'), 'Corisco won').toBe('winner');
    expect(buffalo?.getAttribute('data-outcome'), 'Buffalo lost').toBe('loser');
    expect(tweensDuringTheCrossfade, 'each change crossfades, nothing moves').toEqual({
      coriscoCell: crossfade,
      buffaloCell: crossfade,
      coriscoFill: crossfade,
      buffalo: crossfade,
      everyCard: [],
    });
    expect(
      (coriscoCell as HTMLElement | undefined)?.style.opacity,
      'once the crossfade ends, the styles hold the cell',
    ).toBe('');
  });

  it('shows a match listed in a round on screen at once, in its place', async () => {
    // Arrange: an eight-car tree on air at its quarter-finals, one match not listed yet.
    const eightCarRounds = buildEightCarRounds();
    const withoutTheLastQuarterFinal = eightCarRounds.map((round, roundIndex) =>
      roundIndex === 0 ? { ...round, matches: round.matches.slice(0, 3) } : round,
    );
    const bracket = await createBracketOnAirAtStep({ rounds: withoutTheLastQuarterFinal }, 0);

    // Act: the source lists the fourth quarter-final.
    await bracket.updateAction({ data: { rounds: eightCarRounds } });
    const quarterFinalSlots = findEveryPartOfBracket(bracket, 'bracket-tree-car-slot').filter(
      (slot) => slot.dataset.column === '0',
    );

    // Assert: eight car slots in the quarter-finals, every one shown, none moving.
    expect(quarterFinalSlots, 'four matches of two cars').toHaveLength(8);
    expect(quarterFinalSlots.every(isPieceShown), 'the new match is shown at once').toBe(true);
    expect(gsap.getTweensOf(quarterFinalSlots), 'nothing moves').toEqual([]);
  });

  it('brings the bracket back to its last step when the new rounds have fewer steps', async () => {
    // Arrange: the real Super Prime on air at its final (step 7 of 7).
    const bracket = await createBracketOnAirAtStep(createTheRealSuperPrime(), 6);

    // Act: the source now sends an eight-car bracket (3 steps); then the server, which
    // brought its own step back the same way, sends that step.
    await bracket.updateAction({ data: { rounds: buildEightCarRounds() } });
    const stageAfterTheUpdate = describeTheStage(bracket);
    const answerToTheServersStep = await bracket.playAction({ goto: 2 });

    // Assert: the final of the new bracket, step 3 of 3; the server's step changes nothing.
    expect(stageAfterTheUpdate, 'the last step of the new rounds').toMatchObject({
      stepLine: '3/3',
      treeColumnsShown: ['0', '1', '2'],
    });
    expect(answerToTheServersStep, 'already there').toEqual({ statusCode: 200, currentStep: 2 });
  });
});

describe('updateAction off air and during the stop-out', () => {
  it('draws an update off air hidden, ready for the take', async () => {
    // Arrange: the real Super Prime loaded, not taken.
    placeTokensOnTheRoot(ardosiaTreeTokenDeclarations);
    const bracket = createBracketOnThePage();
    await loadBracketWithData(bracket, createTheRealSuperPrime());

    // Act: the six result states arrive before the take.
    await bracket.updateAction({ data: createResultStatesOnABoard() });

    // Assert: drawn (six cards), every one hidden.
    const cards = findEveryPartOfBracket(bracket, 'bracket-match-card');
    expect(cards, 'the new board is drawn').toHaveLength(6);
    expect(cards.some(isPieceShown), 'and waits hidden for the take').toBe(false);
  });

  it('only keeps an update during the stop-out, drawing it once the pieces are gone', async () => {
    // Arrange: real motion on the page, the results board on air, then a stop whose fade
    // lasts a minute, so it is surely still running when the test looks.
    placeTokensOnTheRoot({ ...ardosiaMotionTokenDeclarations, '--motion-out': '60000ms' });
    const bracket = await createBracketOnAirAtStep(createResultStatesOnABoard(), 0);
    const stop = bracket.stopAction({});

    // Act: an update that renames Baja UFMG while the cards fade; then the stop-out ends.
    const renamed = createResultStatesOnABoard();
    const rounds = renamed.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) =>
        match.carA.carNumber === 2
          ? { ...match, carA: { ...match.carA, teamName: 'Equipe Baja UFMG' } }
          : match,
      ),
    }));
    const answer = await bracket.updateAction({ data: { rounds } });
    const readNameOfCar2 = () =>
      findEveryPartOfBracket(bracket, 'bracket-team-name')
        .map((name) => name.textContent)
        .find((name) => name?.includes('Baja UFMG'));
    const nameDuringTheStopOut = readNameOfCar2();
    finishEveryRunningMotionAtOnce();
    await stop;

    // Assert: accepted, kept off the fading card, drawn once it is gone.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(nameDuringTheStopOut, 'the fading card keeps its name').toBe('Baja UFMG');
    expect(readNameOfCar2(), 'once off air the board holds the new name').toBe('Equipe Baja UFMG');
  });
});
