/**
 * The podium web component: load, the steps, stop, update, dispose (packages/graphics/podium)
 *
 * What this module is for:
 *   podium.ts is the OGraf graphic a renderer drives: load once, play to step 0 (the head
 *   alone, Entrar), play again to reveal the 3rd, the 2nd and the 1st (Próximo), once more
 *   to go off air, stop, update at any time, dispose. Every call answers a status and never
 *   throws.
 *
 * What these tests prove:
 *   - Load answers 200 and leaves everything hidden; bad data answers 400 in pt-BR and a
 *     second load 409; actions before load or after dispose answer 409; an unknown custom
 *     action 404; a step before the start 400.
 *   - The reveal order: step 0 shows the head alone with no step line; steps 1, 2, 3 show
 *     the 3rd, then the 2nd, then the 1st, the step line "1/3" to "3/3"; one more play goes
 *     off air (no step reported) and hides everything.
 *   - A `goto` from off air to step 2 brings the head with the 3rd and the 2nd; a `goto`
 *     back from step 3 to step 1 hides the 1st and the 2nd at once.
 *   - With a list of two, step 1 shows nothing new (the 3rd card is empty) and step 2 the 2nd.
 *   - Stop takes everything off and clears the step line; the next take starts at the head.
 *   - An update on air redraws the cards in place: the same elements, a revealed card still
 *     shown with no tween started on it, the new title in the head; a revealed slot that
 *     gains its entry is shown at once.
 *   - An update during the stop-out is only kept: the fading card keeps its texts, and once
 *     the stop-out has ended the board holds the new data.
 *   - A dispose during a step's rise lets the play resolve.
 *
 * What these tests deliberately do not cover:
 *   - Timers: the podium has none (nothing on it moves by itself).
 *   - Where the cards stand and that they never move (jsdom lays nothing out);
 *     e2e/podiumLifecycle.e2e.ts measures the boxes in Chromium.
 *   - The timelines' lengths and curves; podiumAnimations.test.ts covers them.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import type PodiumGraphic from './podium.js';
import {
  ardosiaMotionTokenDeclarations,
  createPodiumOnThePage,
  findCardOfSlot,
  findPartOfPodium,
  listShownSlots,
  loadPodiumWithData,
  placeTokensOnTheRoot,
  readStepLine,
} from './podiumOnThePage.testSupport.js';
import { createEnduroPodium, createEnduroPodiumEntries } from './previewData.js';

/** A podium loaded with the enduro's three (no logos), off air. */
async function createLoadedEnduroPodium(): Promise<PodiumGraphic> {
  const podium = createPodiumOnThePage();
  await loadPodiumWithData(podium, createEnduroPodium(false));
  return podium;
}

/** Whether the head card is shown now. */
function isHeadShown(podium: PodiumGraphic): boolean {
  return findPartOfPodium(podium, 'podium-head')?.style.opacity === '1';
}

describe('load and the answers around it', () => {
  it('answers 200 and leaves the head and every card hidden', async () => {
    // Arrange: a fresh podium on the page.
    const podium = createPodiumOnThePage();

    // Act: load the enduro's three.
    const answer = await loadPodiumWithData(podium, createEnduroPodium(false));

    // Assert: 200, nothing shown, the title written.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(isHeadShown(podium), 'the head waits off air').toBe(false);
    expect(listShownSlots(podium), 'every card waits hidden').toEqual([]);
    expect(findPartOfPodium(podium, 'podium-title')?.textContent, 'the title').toBe('PÓDIO');
  });

  it('answers 400 in pt-BR to bad data, and 409 to a second load', async () => {
    // Arrange: one fresh podium, one loaded.
    const freshPodium = createPodiumOnThePage();
    const loadedPodium = await createLoadedEnduroPodium();

    // Act: load an empty list on the fresh one, and load the loaded one again.
    const badDataAnswer = await loadPodiumWithData(freshPodium, { entries: [] });
    const secondLoadAnswer = await loadPodiumWithData(loadedPodium, createEnduroPodium(false));

    // Assert: 400 naming the field; 409 with its sentence.
    expect(badDataAnswer, 'bad data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "entries".',
    });
    expect(secondLoadAnswer, 'a second load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'O pódio já foi carregado (load); crie outro para novos dados.',
    });
  });

  it('answers 409 before load and after dispose, 404 to a custom action, 400 to a step before the start', async () => {
    // Arrange: a fresh podium, a disposed one and a loaded one.
    const freshPodium = createPodiumOnThePage();
    const disposedPodium = await createLoadedEnduroPodium();
    await disposedPodium.dispose();
    const loadedPodium = await createLoadedEnduroPodium();

    // Act: play the fresh one, update the disposed one, ask the loaded one for a custom
    // action and for a step before the start.
    const beforeLoad = await freshPodium.playAction({});
    const afterDispose = await disposedPodium.updateAction({ data: { title: 'PÓDIO' } });
    const customAction = await loadedPodium.customAction({ id: 'girar', payload: {} });
    const stepBeforeTheStart = await loadedPodium.playAction({ delta: -1 });

    // Assert: each answer with its pt-BR sentence.
    expect(beforeLoad, 'play before load answers 409').toEqual({
      statusCode: 409,
      statusMessage: 'O pódio ainda não foi carregado (load).',
    });
    expect(afterDispose, 'an update after dispose answers 409').toEqual({
      statusCode: 409,
      statusMessage: 'O pódio já foi descartado (dispose).',
    });
    expect(customAction.statusCode, 'the podium has no custom action').toBe(404);
    expect(stepBeforeTheStart, 'a step before the start answers 400').toEqual({
      statusCode: 400,
      statusMessage: 'Passo inválido para playAction: o pódio tem os passos 0 a 3.',
    });
  });
});

describe('the steps', () => {
  it('shows the head alone, then the 3rd, the 2nd and the 1st, then goes off air', async () => {
    // Arrange: the enduro's three loaded.
    const podium = await createLoadedEnduroPodium();

    // Act: play five times, noting after each the answer, the head, the cards and the line.
    const afterEachPlay = [];
    for (let press = 0; press < 5; press += 1) {
      const answer = await podium.playAction({});
      afterEachPlay.push({
        currentStep: answer.currentStep,
        isHeadShown: isHeadShown(podium),
        shownSlots: listShownSlots(podium),
        stepLine: readStepLine(podium),
      });
    }

    // Assert: the head alone, one card per step (3rd, 2nd, 1st), then off air.
    expect(afterEachPlay, 'the podium reveals 3rd, 2nd, 1st and then leaves').toEqual([
      { currentStep: 0, isHeadShown: true, shownSlots: [], stepLine: '' },
      { currentStep: 1, isHeadShown: true, shownSlots: ['third'], stepLine: '1/3' },
      { currentStep: 2, isHeadShown: true, shownSlots: ['second', 'third'], stepLine: '2/3' },
      {
        currentStep: 3,
        isHeadShown: true,
        shownSlots: ['second', 'first', 'third'],
        stepLine: '3/3',
      },
      { currentStep: undefined, isHeadShown: false, shownSlots: [], stepLine: '' },
    ]);
  });

  it('brings the head with the 3rd and the 2nd on a goto from off air to step 2', async () => {
    // Arrange: the enduro's three loaded.
    const podium = await createLoadedEnduroPodium();

    // Act: jump straight to step 2.
    const answer = await podium.playAction({ goto: 2 });

    // Assert: step 2, the head and the two cards shown.
    expect(answer, 'the jump reports step 2').toEqual({ statusCode: 200, currentStep: 2 });
    expect(isHeadShown(podium), 'the head comes with them').toBe(true);
    expect(listShownSlots(podium), 'the 3rd and the 2nd are shown').toEqual(['second', 'third']);
  });

  it('hides the 1st and the 2nd at once on a goto back from step 3 to step 1', async () => {
    // Arrange: the whole podium shown.
    const podium = await createLoadedEnduroPodium();
    await podium.playAction({ goto: 3 });

    // Act: go back to step 1.
    const answer = await podium.playAction({ goto: 1 });

    // Assert: step 1, the 3rd alone, no motion left on the hidden cards.
    const firstCard = findCardOfSlot(podium, 'first');
    expect(answer, 'the step back reports step 1').toEqual({ statusCode: 200, currentStep: 1 });
    expect(listShownSlots(podium), 'only the 3rd stays').toEqual(['third']);
    expect(readStepLine(podium), 'the line follows').toBe('1/3');
    expect(gsap.getTweensOf(firstCard ?? []), 'a step back hides with no motion').toEqual([]);
  });

  it('shows nothing new at step 1 for a list of two, and the 2nd at step 2', async () => {
    // Arrange: a session with two cars classified, the head on air.
    const podium = createPodiumOnThePage();
    await loadPodiumWithData(podium, { entries: createEnduroPodiumEntries(false).slice(0, 2) });
    await podium.playAction({});

    // Act: press Próximo twice, noting the cards after each.
    await podium.playAction({});
    const shownAtStepOne = listShownSlots(podium);
    await podium.playAction({});
    const shownAtStepTwo = listShownSlots(podium);

    // Assert: the empty 3rd card never shows; the 2nd comes at its step.
    expect(shownAtStepOne, 'an empty card is never shown').toEqual([]);
    expect(shownAtStepTwo, 'the 2nd place comes at step 2').toEqual(['second']);
  });
});

describe('stop', () => {
  it('takes everything off, clears the step line, and the next take starts at the head', async () => {
    // Arrange: the podium on air at step 2.
    const podium = await createLoadedEnduroPodium();
    await podium.playAction({ goto: 2 });

    // Act: stop, then take it again.
    const stopAnswer = await podium.stopAction({});
    const afterStop = {
      isHeadShown: isHeadShown(podium),
      shownSlots: listShownSlots(podium),
      stepLine: readStepLine(podium),
    };
    const playAnswer = await podium.playAction({});

    // Assert: 200, nothing left; the new take is the head alone at step 0.
    expect(stopAnswer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(afterStop, 'stop leaves nothing on screen').toEqual({
      isHeadShown: false,
      shownSlots: [],
      stepLine: '',
    });
    expect(playAnswer, 'the next take starts at step 0').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(listShownSlots(podium), 'the next take shows no card yet').toEqual([]);
  });
});

describe('updateAction', () => {
  it('redraws the cards in place on air, with no motion, and the head with them', async () => {
    // Arrange: the podium on air with the 3rd place shown; its card noted.
    const podium = await createLoadedEnduroPodium();
    await podium.playAction({ goto: 1 });
    const thirdCardBefore = findCardOfSlot(podium, 'third');

    // Act: the item is corrected: Pato Baja's school written in full, a new title.
    const entries = createEnduroPodiumEntries(false).map((entry) =>
      entry.carNumber === 47 ? { ...entry, schoolName: 'UTFPR Pato Branco' } : entry,
    );
    const answer = await podium.updateAction({ data: { entries, title: 'PÓDIO · ENDURO' } });

    // Assert: 200; the same card element, still shown, untouched by motion, with the new
    // school; the head's new title.
    const thirdCardAfter = findCardOfSlot(podium, 'third');
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(thirdCardAfter, 'the card element is kept').toBe(thirdCardBefore);
    expect(listShownSlots(podium), 'the 3rd stays shown, the others hidden').toEqual(['third']);
    expect(
      thirdCardAfter?.querySelector('[data-testid="podium-school-name"]')?.textContent,
      'the card shows the corrected school',
    ).toBe('UTFPR Pato Branco');
    expect(gsap.getTweensOf(thirdCardAfter ?? []), 'no motion starts on the card').toEqual([]);
    expect(findPartOfPodium(podium, 'podium-title')?.textContent, 'the new title').toBe(
      'PÓDIO · ENDURO',
    );
  });

  it('shows a revealed slot at once when it gains its entry', async () => {
    // Arrange: two cars only, the podium on air at step 1 (the empty 3rd card's step).
    const podium = createPodiumOnThePage();
    await loadPodiumWithData(podium, { entries: createEnduroPodiumEntries(false).slice(0, 2) });
    await podium.playAction({ goto: 1 });

    // Act: the third car is added to the item.
    await podium.updateAction({ data: { entries: createEnduroPodiumEntries(false) } });

    // Assert: the 3rd card, whose step has passed, is shown.
    expect(listShownSlots(podium), 'the 3rd place appears at once').toEqual(['third']);
  });

  it('only keeps an update during the stop-out, drawing it once the cards are gone', async () => {
    // Arrange: real motion on the page, the whole podium shown, then a stop started that is
    // still fading the cards out.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const podium = await createLoadedEnduroPodium();
    await podium.playAction({ goto: 3, skipAnimation: true });
    const stop = podium.stopAction({});

    // Act: an update that renames the winner while the cards fade; then the stop-out ends.
    const entries = createEnduroPodiumEntries(false).map((entry) =>
      entry.carNumber === 51 ? { ...entry, teamName: 'Sinuelo Baja' } : entry,
    );
    const answer = await podium.updateAction({ data: { entries } });
    const readWinnerName = () =>
      findCardOfSlot(podium, 'first')?.querySelector('[data-testid="podium-team-name"]')
        ?.textContent;
    const winnerNameDuringTheStopOut = readWinnerName();
    await stop;

    // Assert: accepted, kept off the fading card, drawn once it is gone.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(winnerNameDuringTheStopOut, 'the fading card keeps its name').toBe('Sinuelo');
    expect(readWinnerName(), 'once off air the board holds the new name').toBe('Sinuelo Baja');
  });
});

describe('dispose', () => {
  it('lets a play resolve when it comes during a step’s rise', async () => {
    // Arrange: real motion on the page, the head on air, the 3rd place's rise started.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const podium = await createLoadedEnduroPodium();
    await podium.playAction({ skipAnimation: true });
    const pendingStep = podium.playAction({});

    // Act: dispose in the middle of the rise.
    const disposeAnswer = await podium.dispose();
    const stepAnswer = await pendingStep;

    // Assert: both answer; the play reports the dispose.
    expect(disposeAnswer, 'dispose must answer 200').toEqual({ statusCode: 200 });
    expect(stepAnswer, 'the pending play resolves with 409').toEqual({
      statusCode: 409,
      statusMessage: 'O pódio já foi descartado (dispose).',
    });
  });
});
