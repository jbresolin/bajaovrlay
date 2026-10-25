/**
 * The bracket web component: load, the steps, stop (packages/graphics/bracket)
 *
 * What this module is for:
 *   bracket.ts is the OGraf graphic a renderer drives: load once, play to its first step
 *   (Entrar), play again for each next step (Próximo), once more past the last to go off
 *   air, stop, update at any time, dispose. How many steps it has comes from its rounds.
 *   Every call answers a status and never throws.
 *
 * What these tests prove:
 *   - Load answers 200 and leaves everything hidden; bad data answers 400 in pt-BR and a
 *     second load 409; actions before load or after dispose answer 409; an unknown custom
 *     action 404; a step before the start 400.
 *   - The real Super Prime plays as bracket-passo-1 to -7: three round boards (the head
 *     naming each round, 32, 16 and 8 cards), then the tree a round at a time, the third
 *     place before the final, the lines into each round once it is shown; one more play
 *     goes off air (no step reported) and hides everything.
 *   - A `goto` from off air to step 5 brings the tree with the quarter-finals and the
 *     semifinals at once; a `goto` back from the final to the first board draws it with no
 *     motion left on any piece.
 *   - Stop takes everything off; the next take starts at the first board.
 *
 * What these tests deliberately do not cover:
 *   - Updates, the crossfade and the stop-out: bracketUpdates.test.ts.
 *   - Ending motions on stop, dispose and disconnect: bracketMotionStops.test.ts.
 *   - Where the pieces stand (jsdom lays nothing out): treeLayout.test.ts for the tree's
 *     geometry, e2e/bracketScreenshots.e2e.ts for the boxes in Chromium.
 *   - Timers: the bracket has none (nothing on it moves by itself).
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import type BracketGraphic from './bracket.js';
import {
  ardosiaTreeTokenDeclarations,
  createBracketOnThePage,
  describeTheStage,
  findEveryPartOfBracket,
  findPartOfBracket,
  isPieceShown,
  loadBracketWithData,
  placeTokensOnTheRoot,
} from './bracketOnThePage.testSupport.js';
import { createTheRealSuperPrime } from './previewData.js';

/** The real Super Prime loaded with the theme's tree sizes, off air. */
async function createLoadedSuperPrime(): Promise<BracketGraphic> {
  placeTokensOnTheRoot(ardosiaTreeTokenDeclarations);
  const bracket = createBracketOnThePage();
  await loadBracketWithData(bracket, createTheRealSuperPrime());
  return bracket;
}

/** Whether the head card is shown now. */
function isHeadShown(bracket: BracketGraphic): boolean {
  return isPieceShown(findPartOfBracket(bracket, 'bracket-head'));
}

describe('load and the answers around it', () => {
  it('answers 200 and leaves the head and every card hidden', async () => {
    // Arrange: the theme's sizes, and a fresh bracket on the page.
    placeTokensOnTheRoot(ardosiaTreeTokenDeclarations);
    const bracket = createBracketOnThePage();

    // Act: load the real Super Prime.
    const answer = await loadBracketWithData(bracket, createTheRealSuperPrime());

    // Assert: 200, nothing shown, the title written.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(isHeadShown(bracket), 'the head waits off air').toBe(false);
    expect(
      findEveryPartOfBracket(bracket, 'bracket-match-card').some(isPieceShown),
      'every card waits hidden',
    ).toBe(false);
    expect(
      findPartOfBracket(bracket, 'bracket-title')?.textContent,
      'the head must write the item’s title',
    ).toBe('SUPER PRIME');
  });

  it('answers 400 in pt-BR to bad data, and 409 to a second load', async () => {
    // Arrange: one fresh bracket, one loaded.
    const freshBracket = createBracketOnThePage();
    const loadedBracket = await createLoadedSuperPrime();

    // Act: load a match with no carA on the fresh one, and load the loaded one again.
    const badDataAnswer = await loadBracketWithData(freshBracket, {
      rounds: [{ name: 'Final', matches: [{ matchId: 'final' }] }],
    });
    const secondLoadAnswer = await loadBracketWithData(loadedBracket, createTheRealSuperPrime());

    // Assert: 400 naming the field; 409 with its sentence.
    expect(badDataAnswer, 'bad data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "rounds[0].matches[0].carA".',
    });
    expect(secondLoadAnswer, 'a second load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'O chaveamento já foi carregado (load); crie outro para novos dados.',
    });
  });

  it('answers 409 before load and after dispose, 404 to a custom action, 400 to a step before the start', async () => {
    // Arrange: a fresh bracket, a disposed one and a loaded one.
    const freshBracket = createBracketOnThePage();
    const disposedBracket = await createLoadedSuperPrime();
    await disposedBracket.dispose();
    const loadedBracket = await createLoadedSuperPrime();

    // Act: play the fresh one, update the disposed one, ask the loaded one for a custom
    // action and for a step before the start.
    const beforeLoad = await freshBracket.playAction({});
    const afterDispose = await disposedBracket.updateAction({ data: { title: 'SUPER PRIME' } });
    const customAction = await loadedBracket.customAction({ id: 'girar', payload: {} });
    const stepBeforeTheStart = await loadedBracket.playAction({ delta: -1 });

    // Assert: each answer with its pt-BR sentence.
    expect(beforeLoad, 'play before load answers 409').toEqual({
      statusCode: 409,
      statusMessage: 'O chaveamento ainda não foi carregado (load).',
    });
    expect(afterDispose, 'an update after dispose answers 409').toEqual({
      statusCode: 409,
      statusMessage: 'O chaveamento já foi descartado (dispose).',
    });
    expect(customAction.statusCode, 'the bracket has no custom action').toBe(404);
    expect(stepBeforeTheStart, 'a step before the start answers 400').toEqual({
      statusCode: 400,
      statusMessage: 'Passo inválido para playAction: os passos começam em 0.',
    });
  });
});

describe('the steps', () => {
  it('plays the real Super Prime as bracket-passo-1 to -7, then goes off air', async () => {
    // Arrange: the real Super Prime loaded.
    const bracket = await createLoadedSuperPrime();

    // Act: play eight times, noting after each the answer, the head and the stage.
    const afterEachPlay = [];
    for (let press = 0; press < 8; press += 1) {
      const answer = await bracket.playAction({});
      afterEachPlay.push({
        currentStep: answer.currentStep,
        isHeadShown: isHeadShown(bracket),
        ...describeTheStage(bracket),
      });
    }

    // Assert: three boards, the tree growing a round (and the third place) at a time with
    // the lines into each round shown, then off air.
    const board = (stepLine: string, eventLine: string, boardCards: number) => ({
      isHeadShown: true,
      stepLine,
      eventLine,
      boardCards,
      treeColumnsShown: [],
      shownLines: 0,
    });
    const tree = (stepLine: string, treeColumnsShown: string[], shownLines: number) => ({
      isHeadShown: true,
      stepLine,
      eventLine: '',
      boardCards: 0,
      treeColumnsShown,
      shownLines,
    });
    expect(afterEachPlay, 'the steps of the design, then off air').toEqual([
      { currentStep: 0, ...board('1/7', '32 avos de final', 32) },
      { currentStep: 1, ...board('2/7', '16 avos de final', 16) },
      { currentStep: 2, ...board('3/7', 'Oitavas de final', 8) },
      { currentStep: 3, ...tree('4/7', ['0'], 0) },
      { currentStep: 4, ...tree('5/7', ['0', '1'], 4) },
      { currentStep: 5, ...tree('6/7', ['0', '1', 'third'], 4) },
      { currentStep: 6, ...tree('7/7', ['0', '1', '2', 'third'], 6) },
      {
        currentStep: undefined,
        isHeadShown: false,
        stepLine: '7/7',
        eventLine: '',
        boardCards: 0,
        treeColumnsShown: [],
        shownLines: 0,
      },
    ]);
  });

  it('brings the tree with the quarter-finals and semifinals on a goto from off air to step 5', async () => {
    // Arrange: the real Super Prime loaded.
    const bracket = await createLoadedSuperPrime();

    // Act: jump straight to step 5 (index 4), as a renderer reloaded at that step does.
    const answer = await bracket.playAction({ goto: 4, skipAnimation: true });

    // Assert: step 4, the head and both rounds shown with the lines between them.
    expect(answer, 'the jump reports step 4').toEqual({ statusCode: 200, currentStep: 4 });
    expect(isHeadShown(bracket), 'the head comes with them').toBe(true);
    expect(describeTheStage(bracket), 'the quarter-finals and semifinals').toMatchObject({
      stepLine: '5/7',
      treeColumnsShown: ['0', '1'],
      shownLines: 4,
    });
  });

  it('draws the first board at once, with no motion, on a goto back from the final', async () => {
    // Arrange: the whole tree shown.
    const bracket = await createLoadedSuperPrime();
    await bracket.playAction({ goto: 6, skipAnimation: true });

    // Act: go back to the first board.
    const answer = await bracket.playAction({ goto: 0 });
    const cards = findEveryPartOfBracket(bracket, 'bracket-match-card');

    // Assert: step 0, the 32 cards shown, none of them moving.
    expect(answer, 'the step back reports step 0').toEqual({ statusCode: 200, currentStep: 0 });
    expect(
      describeTheStage(bracket),
      'a step back must draw the first board again, whole',
    ).toMatchObject({
      stepLine: '1/7',
      eventLine: '32 avos de final',
      boardCards: 32,
    });
    expect(gsap.getTweensOf(cards), 'a step back draws with no motion').toEqual([]);
  });
});

describe('a redraw where GSAP moves the pieces it measures', () => {
  it('leaves exactly the 16 cards of the 16 avos after the 32 of the 32 avos', async () => {
    // Arrange: the real Super Prime on air at its first board. jsdom lays nothing out, as
    // Chromium does not under a hidden ancestor (the control's monitor frame can be one), so
    // GSAP takes each card out of the page to read its transform the first time it moves it
    // and puts it back before its next element sibling, skipping Lit's markers.
    const bracket = await createLoadedSuperPrime();
    await bracket.playAction({});

    // Act: Próximo to the 16 avos, then to the oitavas.
    await bracket.playAction({});
    const cardsOfThe16Avos = findEveryPartOfBracket(bracket, 'bracket-match-card').length;
    await bracket.playAction({});
    const cardsOfTheOitavas = findEveryPartOfBracket(bracket, 'bracket-match-card').length;

    // Assert: each board holds its own cards and no card of the board before (each card sits
    // alone in a display: contents holder, so GSAP putting it back keeps it in Lit's reach).
    expect(cardsOfThe16Avos, 'the 16 avos are 16 cards, none left of the 32 avos').toBe(16);
    expect(cardsOfTheOitavas, 'the oitavas are 8 cards').toBe(8);
  });
});

describe('stop', () => {
  it('takes everything off, and the next take starts at the first board', async () => {
    // Arrange: the bracket on air at its semifinals.
    const bracket = await createLoadedSuperPrime();
    await bracket.playAction({ goto: 4 });

    // Act: stop, then take it again.
    const stopAnswer = await bracket.stopAction({});
    const afterStop = { isHeadShown: isHeadShown(bracket), ...describeTheStage(bracket) };
    const playAnswer = await bracket.playAction({});

    // Assert: 200, nothing left; the new take is the first board at step 0.
    expect(stopAnswer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(afterStop, 'stop leaves nothing on screen').toMatchObject({
      isHeadShown: false,
      boardCards: 0,
      treeColumnsShown: [],
      shownLines: 0,
    });
    expect(playAnswer, 'the next take starts at step 0').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(
      describeTheStage(bracket),
      'the next take must start at the first board, whole',
    ).toMatchObject({ boardCards: 32 });
  });
});
