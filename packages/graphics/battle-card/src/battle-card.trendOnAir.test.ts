/**
 * The battle card's trend on air: the crossfade, the stop-out and the ends of the motion
 * (packages/graphics/battle-card)
 *
 * What this module is for:
 *   On air, a new reading changes the gap number in place and the trend cell crossfades
 *   only when its word changes (motion.md: "A state, not an animation"); when the word
 *   stays, only its number changes in place. The crossfade is the one motion the card runs
 *   by itself, so stop, dispose and the element leaving the page must end it, and an
 *   update during the stop-out must only store its data.
 *
 * What these tests prove:
 *   - A change of word dresses the incoming layer in the new trend and fades it in over the
 *     current one (watched on a crossfade too long to end by itself while the test looks);
 *     when the crossfade ends, the current layer wears the new trend and the incoming layer
 *     is invisible again.
 *   - The same word with a new number starts no crossfade: the number changes in place.
 *   - A pass on air shows "—" with an empty trend cell, and when the cars are one place
 *     apart again the trend starts from nothing (gate 2 of PR #27).
 *   - stopAction, dispose and leaving the page each end a running crossfade at once: the
 *     current layer wears the new trend and nothing is animating any more. Each test fails
 *     if the finish is taken out of that path.
 *   - An update during the stop-out changes nothing on screen and starts no crossfade, even
 *     when something asks Lit to redraw; the card is drawn with it once it is off screen,
 *     or before the play-in when a play cuts the stop-out short.
 *
 * What these tests deliberately do not cover:
 *   - The rule that picks the trend; battleTrend.test.ts.
 *   - The look of the crossfade; e2e/battleCardLifecycle.e2e.ts watches it in Chromium.
 */
import { finishEveryRunningMotionAtOnce } from '@bajaovrlay/graphics-kit/finishEveryRunningMotion.testSupport';
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import type BattleCardGraphic from './battle-card.js';
import {
  createBattleCardOnThePage,
  createImperadorAheadOfFeiData,
  findPartOfBattleCard,
  loadBattleCardWithData,
  placeArdosiaMotionTokensOnTheParts,
  readPartOpacity,
  readShownText,
} from './battleCardOnThePage.testSupport.js';

/** Lets the pending promise callbacks of the page run, so Lit draws what was asked. */
function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Whether a crossfade is still alive on either trend layer: GSAP holds tweens of it. A
 * crossfade that ended, by itself or finished at once, is killed and leaves none.
 */
function isTrendCrossfadeRunning(battleCard: BattleCardGraphic): boolean {
  const trendLayers = [
    findPartOfBattleCard(battleCard, 'battle-card-trend'),
    findPartOfBattleCard(battleCard, 'battle-card-incoming-trend'),
  ];
  return trendLayers.some((layer) => layer !== undefined && gsap.getTweensOf(layer).length > 0);
}

/**
 * Puts a battle card on air at lap 2 closing by 0,7 s, with the real motion tokens on the
 * page, so a crossfade lasts `--motion-flag` (300 ms) and can be caught while it runs.
 */
async function putBattleCardOnAirClosing(): Promise<BattleCardGraphic> {
  const battleCard = createBattleCardOnThePage();
  await loadBattleCardWithData(battleCard, createImperadorAheadOfFeiData());
  placeArdosiaMotionTokensOnTheParts(battleCard);
  await battleCard.playAction({ skipAnimation: true });
  await battleCard.updateAction({
    data: { aheadLaps: 2, behindLaps: 2, gapMs: 1300 },
    skipAnimation: true,
  });
  return battleCard;
}

/**
 * Starts the card's stop-out with a fade that lasts a minute, so it is surely still running
 * while a test looks at the card "during the stop-out"; finishEveryRunningMotionAtOnce ends
 * it. A real 250 ms fade may already be over on a loaded CI runner (gate 2 of PR #27).
 */
function startAStopOutThatCannotEndByItself(battleCard: BattleCardGraphic): Promise<unknown> {
  for (const testId of ['battle-card-ahead', 'battle-card-trend']) {
    findPartOfBattleCard(battleCard, testId)?.style.setProperty('--motion-out', '60000ms');
  }
  return battleCard.stopAction({});
}

/** The next lap's reading after lap 2: the gap 0,7 s larger again, so opening. */
const openingAtLapThree = { aheadLaps: 3, behindLaps: 3, gapMs: 2000 };

/**
 * Starts a crossfade to opening that lasts a minute, so it cannot end by itself while a
 * test looks (a 300 ms one could, on a slow machine, and the test would pass for the wrong
 * reason). Returns the pending update, wrapped so awaiting this does not wait for it.
 */
async function startACrossfadeThatCannotEndByItself(
  battleCard: BattleCardGraphic,
): Promise<{ pendingUpdate: Promise<unknown> }> {
  findPartOfBattleCard(battleCard, 'battle-card-trend')?.style.setProperty(
    '--motion-flag',
    '60000ms',
  );
  const pendingUpdate = battleCard.updateAction({ data: openingAtLapThree });
  await letThePageCatchUp();
  expect(isTrendCrossfadeRunning(battleCard), 'the crossfade must be running first').toBe(true);
  return { pendingUpdate };
}

describe('a new reading on air', () => {
  it('crossfades the trend cell when the word changes, the new word fading in over the old', async () => {
    // Arrange: a card on air closing by 0,7 s.
    const battleCard = await putBattleCardOnAirClosing();

    // Act: send lap 3, opening, with a crossfade too long to end while the test looks.
    await startACrossfadeThatCannotEndByItself(battleCard);

    // Assert: the new words are on the incoming layer, over the old ones still current.
    expect(
      {
        incomingWords: readShownText(battleCard, 'battle-card-incoming-trend-words'),
        currentWords: readShownText(battleCard, 'battle-card-trend-words'),
      },
      'during the crossfade the new trend fades in over the old',
    ).toEqual({ incomingWords: 'ABRINDO +0,7', currentWords: 'FECHANDO −0,7' });
  });

  it('settles on the new word once the crossfade has ended', async () => {
    // Arrange: a card on air closing by 0,7 s, with the real 300 ms crossfade.
    const battleCard = await putBattleCardOnAirClosing();

    // Act: send lap 3, opening, and wait until the update (and its crossfade) has ended.
    await battleCard.updateAction({ data: openingAtLapThree });
    await letThePageCatchUp();

    // Assert: the current layer wears the new word and the incoming one is invisible again.
    expect(readShownText(battleCard, 'battle-card-trend-words'), 'settled on the new word').toBe(
      'ABRINDO +0,7',
    );
    expect(isTrendCrossfadeRunning(battleCard), 'nothing animates any more').toBe(false);
    expect(readPartOpacity(battleCard, 'battle-card-trend'), 'current layer visible').toBe('1');
    expect(readPartOpacity(battleCard, 'battle-card-incoming-trend'), 'incoming hidden').toBe('0');
  });

  it('changes only the number in place when the word stays', async () => {
    // Arrange: a card on air closing by 0,7 s, and its trend words element now.
    const battleCard = await putBattleCardOnAirClosing();
    const wordsElementBefore = findPartOfBattleCard(battleCard, 'battle-card-trend-words');

    // Act: lap 3 closes again, by 0,4 s this time.
    const pendingUpdate = battleCard.updateAction({
      data: { aheadLaps: 3, behindLaps: 3, gapMs: 900 },
    });
    await letThePageCatchUp();
    const isRunningRightAfter = isTrendCrossfadeRunning(battleCard);
    await pendingUpdate;

    // Assert: no crossfade at all, the same element, the new number.
    expect(isRunningRightAfter, 'the same word must start no crossfade').toBe(false);
    expect(findPartOfBattleCard(battleCard, 'battle-card-trend-words'), 'in place').toBe(
      wordsElementBefore,
    );
    expect(readShownText(battleCard, 'battle-card-trend-words'), 'the new number').toBe(
      'FECHANDO −0,4',
    );
  });
});

describe('a pass on air (gate 2 of PR #27)', () => {
  it('shows "—" with an empty trend cell once the car behind passes, and starts again after', async () => {
    // Arrange: a card on air closing by 0,7 s (car 1 at P5 behind car 8 at P4).
    const battleCard = await putBattleCardOnAirClosing();

    // Act: car 1 passes car 8 (P4 and P5 swap; its interval is now to the P3), then car 8
    // passes back and car 1 completes its next lap one place behind again.
    await battleCard.updateAction({
      data: { aheadPosition: 5, behindPosition: 4, behindLaps: 3, gapMs: 6000 },
      skipAnimation: true,
    });
    const afterThePass = {
      gap: readShownText(battleCard, 'battle-card-gap'),
      words: readShownText(battleCard, 'battle-card-trend-words'),
    };
    await battleCard.updateAction({
      data: { aheadPosition: 4, behindPosition: 5, aheadLaps: 4, behindLaps: 4, gapMs: 900 },
      skipAnimation: true,
    });

    // Assert: a dash and no trend after the pass, never a trend across cars; back one place
    // apart, the battle starts again from nothing: steady with no number.
    expect(afterThePass, 'after the pass the gap is not these two cars').toEqual({
      gap: '—',
      words: '',
    });
    expect(readShownText(battleCard, 'battle-card-gap'), 'the gap again').toBe('+0,9');
    expect(readShownText(battleCard, 'battle-card-trend-words'), 'started again').toBe('ESTÁVEL');
  });
});

describe('the ends of a running crossfade', () => {
  it('is ended by stopAction, which leaves the new trend on the current layer', async () => {
    // Arrange: a card on air with a crossfade to opening running.
    const battleCard = await putBattleCardOnAirClosing();
    await startACrossfadeThatCannotEndByItself(battleCard);

    // Act: stop at once, while the crossfade still has most of its minute to go.
    await battleCard.stopAction({ skipAnimation: true });
    await letThePageCatchUp();

    // Assert: nothing animates the trend any more and it wears the new word.
    expect(isTrendCrossfadeRunning(battleCard), 'stop must end the crossfade').toBe(false);
    expect(readShownText(battleCard, 'battle-card-trend-words'), 'the new word').toBe(
      'ABRINDO +0,7',
    );
    expect(readPartOpacity(battleCard, 'battle-card-incoming-trend'), 'incoming hidden').toBe('0');
  });

  it('is ended by dispose', async () => {
    // Arrange: a card on air with a crossfade to opening running.
    const battleCard = await putBattleCardOnAirClosing();
    const { pendingUpdate } = await startACrossfadeThatCannotEndByItself(battleCard);

    // Act: dispose while it runs.
    await battleCard.dispose();

    // Assert: nothing animates the trend any more, and the update resolved.
    expect(isTrendCrossfadeRunning(battleCard), 'dispose must end the crossfade').toBe(false);
    await expect(pendingUpdate, 'the update must not hang').resolves.toEqual({ statusCode: 200 });
  });

  it('is ended when the element leaves the page without dispose', async () => {
    // Arrange: a card on air with a crossfade to opening running.
    const battleCard = await putBattleCardOnAirClosing();
    await startACrossfadeThatCannotEndByItself(battleCard);

    // Act: a renderer removes the element and never calls dispose.
    battleCard.remove();

    // Assert: nothing animates the trend any more.
    expect(isTrendCrossfadeRunning(battleCard), 'leaving the page must end the crossfade').toBe(
      false,
    );
  });
});

describe('an update during the stop-out', () => {
  it('never reaches the card fading out, whatever asks Lit to redraw (gate 2 of PR #27)', async () => {
    // Arrange: a card on air closing by 0,7 s, its stop-out started and lap 3 stored.
    const battleCard = await putBattleCardOnAirClosing();
    const pendingStop = startAStopOutThatCannotEndByItself(battleCard);
    await letThePageCatchUp();
    await battleCard.updateAction({ data: openingAtLapThree });

    // Act: something else asks Lit to redraw the card while it fades out.
    battleCard.requestUpdate();
    await battleCard.updateComplete;
    const gapWhileFadingOut = readShownText(battleCard, 'battle-card-gap');
    finishEveryRunningMotionAtOnce();
    await pendingStop;

    // Assert: the fading card still shows what was on air; the new gap only after it.
    expect(gapWhileFadingOut, 'a redraw during the stop-out must draw the data on air').toBe(
      '+1,3',
    );
    expect(readShownText(battleCard, 'battle-card-gap'), 'drawn after the stop').toBe('+2,0');
  });

  it('is drawn before the play-in when a play cuts the stop-out short', async () => {
    // Arrange: a card on air, its stop-out started and lap 3 stored meanwhile.
    const battleCard = await putBattleCardOnAirClosing();
    const pendingStop = startAStopOutThatCannotEndByItself(battleCard);
    await letThePageCatchUp();
    await battleCard.updateAction({ data: openingAtLapThree });

    // Act: the operator takes it again before the stop-out ends.
    await battleCard.playAction({ skipAnimation: true });
    finishEveryRunningMotionAtOnce();
    await pendingStop;

    // Assert: it comes back in with lap 3's gap and trend, not the stale ones.
    expect(readShownText(battleCard, 'battle-card-gap'), 'the gap stored meanwhile').toBe('+2,0');
    expect(readShownText(battleCard, 'battle-card-trend-words'), 'its trend').toBe('ABRINDO +0,7');
  });

  it('only stores the data, and the card is drawn with it once off screen', async () => {
    // Arrange: a card on air closing by 0,7 s, its stop-out started (a minute long).
    const battleCard = await putBattleCardOnAirClosing();
    const pendingStop = startAStopOutThatCannotEndByItself(battleCard);
    await letThePageCatchUp();

    // Act: lap 3 arrives during the stop-out; look at once, then after the stop.
    const updateAnswer = await battleCard.updateAction({ data: openingAtLapThree });
    await letThePageCatchUp();
    const duringStopOut = {
      gap: readShownText(battleCard, 'battle-card-gap'),
      words: readShownText(battleCard, 'battle-card-trend-words'),
      isCrossfadeRunning: isTrendCrossfadeRunning(battleCard),
    };
    finishEveryRunningMotionAtOnce();
    await pendingStop;

    // Assert: accepted but nothing on screen moved; drawn at rest after the stop.
    expect(updateAnswer, 'the update must be accepted').toEqual({ statusCode: 200 });
    expect(duringStopOut, 'during the stop-out nothing on screen may change').toEqual({
      gap: '+1,3',
      words: 'FECHANDO −0,7',
      isCrossfadeRunning: false,
    });
    expect(readShownText(battleCard, 'battle-card-gap'), 'drawn after the stop').toBe('+2,0');
    expect(readShownText(battleCard, 'battle-card-trend-words'), 'its trend after the stop').toBe(
      'ABRINDO +0,7',
    );
  });
});
