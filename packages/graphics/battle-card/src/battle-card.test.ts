/**
 * The battle card web component: load, play, update, stop and dispose
 * (packages/graphics/battle-card)
 *
 * What this module is for:
 *   battle-card.ts is the OGraf graphic itself: a web component the renderer loads, plays,
 *   updates, stops and disposes. It wires the model, the trend, the view and the
 *   animations together; each of those has its own tests.
 *
 * What these tests prove:
 *   - load draws both cars and the gap off air and answers 200, with "ESTÁVEL" and no
 *     number (the first reading); bad data answers 400 naming the field.
 *   - Calls made at the wrong moment (play or update before load, a second load, anything
 *     after dispose, a custom action it does not have) answer a 4xx status with a pt-BR
 *     message instead of throwing, as OGraf asks. Stop before play is harmless.
 *   - play brings the three pieces on air and reports step 0; play while on air takes the
 *     card off (OGraf's "past the last step" rule); stop takes it off.
 *   - updateAction on air changes the gap and the laps in the same elements, which stay on
 *     air; the next lap's reading turns the trend into "FECHANDO −0,7"; off air an update
 *     is drawn at once; a bad update answers 400 and leaves the card as it was.
 *   - dispose ends a running play-in: the pending play resolves with 409 instead of hanging;
 *     the element leaving the page without dispose ends it too (gate 2 of PR #27).
 *
 * What these tests deliberately do not cover:
 *   - The crossfade of the trend, an update during the stop-out and the ends of the
 *     crossfade on stop, dispose and leaving the page: battle-card.trendOnAir.test.ts.
 *   - Real rendering, fonts and timing; jsdom draws nothing and, with no theme token on the
 *     page, every timeline lasts 0 ms. e2e/ runs the built component in Chromium.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createBattleCardOnThePage,
  createImperadorAheadOfFeiData,
  findPartOfBattleCard,
  loadBattleCardWithData,
  placeArdosiaMotionTokensOnTheParts,
  readPartOpacity,
  readShownText,
} from './battleCardOnThePage.testSupport.js';

const pieceTestIds = ['battle-card-ahead', 'battle-card-gap-card', 'battle-card-behind'];

describe('load', () => {
  it('draws both cars and the gap off air, steady with no number, and answers 200', async () => {
    // Arrange: a battle card on the page, never loaded.
    const battleCard = createBattleCardOnThePage();

    // Act: load it with Imperador ahead of Equipe FEI Baja, 2,0 s apart.
    const answer = await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());

    // Assert: 200, the cars, the gap and the first reading's trend are drawn, invisible.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(battleCard, 'battle-card-ahead-team-name'), 'car ahead').toBe('Imperador');
    expect(readShownText(battleCard, 'battle-card-behind-team-name'), 'car behind').toBe(
      'Equipe FEI Baja',
    );
    expect(readShownText(battleCard, 'battle-card-gap'), 'the gap must read +2,0').toBe('+2,0');
    expect(
      readShownText(battleCard, 'battle-card-trend-words'),
      'with one reading the trend must be steady with no number',
    ).toBe('ESTÁVEL');
    for (const pieceTestId of pieceTestIds) {
      expect(readPartOpacity(battleCard, pieceTestId), `${pieceTestId} waits off air`).toBe('0');
    }
  });

  it('answers 400 with a pt-BR message naming the bad field', async () => {
    // Arrange: a battle card and data without the school of the car behind.
    const battleCard = createBattleCardOnThePage();
    const dataWithoutSchool: Record<string, unknown> = { ...createImperadorAheadOfFeiData() };
    delete dataWithoutSchool.behindSchoolName;

    // Act: load it with that data.
    const answer = await loadBattleCardWithData(battleCard, dataWithoutSchool);

    // Assert: a 400 naming the field.
    expect(answer, 'bad load data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "behindSchoolName".',
    });
  });
});

describe('calls at the wrong moment', () => {
  it('answers 409 to play and update before load, and to a second load', async () => {
    // Arrange: a battle card on the page, never loaded.
    const battleCard = createBattleCardOnThePage();

    // Act: play and update first, then load twice.
    const playAnswer = await battleCard.playAction({});
    const updateAnswer = await battleCard.updateAction({ data: { gapMs: 1300 } });
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
    const secondLoadAnswer = await loadBattleCardWithData(
      battleCard,
      createImperadorAheadOfFeiData(),
    );

    // Assert: each is a 409 with a pt-BR message, never a throw.
    expect(playAnswer.statusCode, 'play before load must answer 409').toBe(409);
    expect(updateAnswer.statusCode, 'update before load must answer 409').toBe(409);
    expect(secondLoadAnswer, 'a second load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'A disputa de posição já foi carregada (load); crie outra para novos dados.',
    });
  });

  it('answers 409 to everything after dispose and 404 to a custom action', async () => {
    // Arrange: a loaded battle card, then disposed.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
    const customAnswer = await battleCard.customAction({ id: 'girar', payload: {} });
    await battleCard.dispose();

    // Act: play, update and stop after the dispose.
    const answers = [
      await battleCard.playAction({}),
      await battleCard.updateAction({ data: { gapMs: 1300 } }),
      await battleCard.stopAction({}),
    ];

    // Assert: a 409 for each, and a 404 for the custom action it does not have.
    expect(
      answers.map((answer) => answer.statusCode),
      'every call after dispose must answer 409',
    ).toEqual([409, 409, 409]);
    expect(customAnswer.statusCode, 'an unknown custom action must answer 404').toBe(404);
  });

  it('answers 200 to a stop before play and stays off air', async () => {
    // Arrange: a loaded battle card that never played.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());

    // Act: stop it.
    const answer = await battleCard.stopAction({});

    // Assert: harmless, and the car ahead is still invisible.
    expect(answer, 'stop before play must answer 200').toEqual({ statusCode: 200 });
    expect(readPartOpacity(battleCard, 'battle-card-ahead'), 'still off air').toBe('0');
  });
});

describe('play and stop', () => {
  it('brings the three pieces in at step 0 and takes them off on stop', async () => {
    // Arrange: a loaded battle card.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());

    // Act: play, note the pieces, then stop.
    const playAnswer = await battleCard.playAction({});
    const opacitiesOnAir = pieceTestIds.map((testId) => readPartOpacity(battleCard, testId));
    const stopAnswer = await battleCard.stopAction({});
    const opacitiesOffAir = pieceTestIds.map((testId) => readPartOpacity(battleCard, testId));

    // Assert: step 0 with every piece visible, then every piece gone.
    expect(playAnswer, 'play must answer 200 at step 0').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(opacitiesOnAir, 'every piece must be visible on air').toEqual(['1', '1', '1']);
    expect(stopAnswer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(opacitiesOffAir, 'every piece must be gone after stop').toEqual(['0', '0', '0']);
  });

  it('takes the card off when play is called again on air', async () => {
    // Arrange: a battle card on air.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
    await battleCard.playAction({});

    // Act: play once more, past the only step.
    const answer = await battleCard.playAction({});

    // Assert: OGraf's rule, the card goes off and no step is on air.
    expect(answer, 'play past the last step must stop the card').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPartOpacity(battleCard, 'battle-card-gap-card'), 'the gap card must be gone').toBe(
      '0',
    );
  });
});

describe('updateAction', () => {
  it('changes the gap and the laps in place on air and shows the trend of the next lap', async () => {
    // Arrange: a battle card on air at lap 1, and its gap element now.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
    await battleCard.playAction({});
    const gapElementBefore = findPartOfBattleCard(battleCard, 'battle-card-gap');

    // Act: the next lap's reading: both cars one lap on, the gap 0,7 s smaller.
    const answer = await battleCard.updateAction({
      data: { aheadLaps: 2, behindLaps: 2, gapMs: 1300 },
    });

    // Assert: same element, new texts, closing by 0,7, still on air.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(findPartOfBattleCard(battleCard, 'battle-card-gap'), 'the gap changes in place').toBe(
      gapElementBefore,
    );
    expect(readShownText(battleCard, 'battle-card-gap'), 'the new gap').toBe('+1,3');
    expect(readShownText(battleCard, 'battle-card-behind-laps'), 'the new laps').toBe('2 VOLTAS');
    expect(readShownText(battleCard, 'battle-card-trend-words'), 'the trend').toBe('FECHANDO −0,7');
    expect(readPartOpacity(battleCard, 'battle-card-ahead'), 'still on air').toBe('1');
  });

  it('draws an update off air at once, ready for play', async () => {
    // Arrange: a loaded battle card that never played.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());

    // Act: set the trend by hand off air.
    await battleCard.updateAction({ data: { manualTrend: 'opening', manualTrendChangeMs: 700 } });

    // Assert: the trend is drawn, and the card is still off air.
    expect(readShownText(battleCard, 'battle-card-trend-words'), 'the trend by hand').toBe(
      'ABRINDO +0,7',
    );
    expect(readPartOpacity(battleCard, 'battle-card-ahead'), 'still off air').toBe('0');
  });

  it('answers 400 to a bad update and leaves the card as it was', async () => {
    // Arrange: a battle card on air.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
    await battleCard.playAction({});

    // Act: send a negative gap.
    const answer = await battleCard.updateAction({ data: { gapMs: -5 } });

    // Assert: refused naming the field; the gap on screen is unchanged.
    expect(answer, 'a bad update must answer 400').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "gapMs".',
    });
    expect(readShownText(battleCard, 'battle-card-gap'), 'the gap stays').toBe('+2,0');
  });
});

describe('dispose', () => {
  it('ends a running play-in so the pending play answers 409 instead of hanging', async () => {
    // Arrange: a loaded card with the real motion tokens, so the play-in takes 600 ms.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
    placeArdosiaMotionTokensOnTheParts(battleCard);

    // Act: start the play-in and dispose while it runs.
    const pendingPlay = battleCard.playAction({});
    await battleCard.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play resolved, with the dispose's 409.
    expect(playAnswer.statusCode, 'a play ended by dispose must answer 409').toBe(409);
  });

  it('ends a running play-in when the element leaves the page without dispose', async () => {
    // Arrange: a loaded card whose play-in lasts a minute (so it cannot end by itself while
    // the test looks), its play-in started.
    const battleCard = createBattleCardOnThePage();
    await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
    placeArdosiaMotionTokensOnTheParts(battleCard);
    const carAheadPill = findPartOfBattleCard(battleCard, 'battle-card-ahead');
    carAheadPill?.style.setProperty('--motion-in', '60000ms');
    const pendingPlay = battleCard.playAction({});
    const isRisingBefore = gsap.getTweensOf(carAheadPill ?? []).length > 0;

    // Act: a renderer removes the element and never calls dispose.
    battleCard.remove();

    // Assert: it was rising, nothing animates it any more, and the play resolves.
    expect(isRisingBefore, 'the car ahead was rising first').toBe(true);
    expect(gsap.getTweensOf(carAheadPill ?? []), 'leaving the page must end the in').toEqual([]);
    await expect(pendingPlay, 'the play must not hang').resolves.toMatchObject({
      statusCode: 200,
    });
  });
});
