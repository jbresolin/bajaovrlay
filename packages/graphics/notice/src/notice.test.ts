/**
 * The notice web component: load, play, update, stop and dispose (packages/graphics/notice)
 *
 * What this module is for:
 *   notice.ts is the OGraf graphic itself: a web component the renderer loads, plays,
 *   updates, stops and disposes. It wires the model, the view and the animations
 *   together; each of those has its own tests.
 *
 * What these tests prove:
 *   - load draws the data off air and answers 200; bad data answers 400 naming the field.
 *   - Calls made at the wrong moment (play or update before load, a second load, anything
 *     after dispose, a custom action it does not have) answer a 4xx status with a pt-BR
 *     message instead of throwing, as OGraf asks. Stop before play is harmless.
 *   - play brings the card on air and reports step 0; play while on air takes it off
 *     (OGraf's "past the last step" rule); stop takes it off.
 *   - The notice never leaves by itself: it is still on air after play, with no stop.
 *     The server's event rule clears it (the trade-off written in notice.ts).
 *   - updateAction merges partial data on air or off and redraws in place; a bad update
 *     answers 400 and leaves the card as it was.
 *   - dispose ends a running play-in: the pending play resolves with 409 instead of
 *     hanging, and a dispose that lands while load is still waiting is not undone.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering, fonts and timing; jsdom draws nothing and has no `document.fonts`,
 *     so load's wait for the theme's font ends at once, and no theme token is on the
 *     page, so every timeline lasts 0 ms (the theme's rule for a missing token). The
 *     Playwright suites in e2e/ run the built component in Chromium for the lifecycle,
 *     the motion and the screenshots.
 *   - Which parts each variant shows; noticeView.test.ts covers that.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createFastestLapData,
  createJumpStartPenaltyData,
  createNoticeOnThePage,
  findPartOfNotice,
  loadNoticeWithData,
  readPanelOpacity,
  readShownText,
} from './noticeOnThePage.testSupport.js';

describe('load', () => {
  it('draws the data off air and answers 200', async () => {
    // Arrange: a notice on the page, never loaded.
    const notice = createNoticeOnThePage();

    // Act: load it with the fastest lap of car 31.
    const answer = await loadNoticeWithData(notice, createFastestLapData());

    // Assert: 200, the data is drawn, and the card waits invisible for play.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(notice, 'notice-lap-time'), 'the lap time must be drawn').toBe('4:38,2');
    expect(readPanelOpacity(notice), 'a loaded notice must stay off screen until play').toBe('0');
  });

  it('answers 400 with a pt-BR message naming the bad field', async () => {
    // Arrange: a notice and data with a variant it cannot draw.
    const notice = createNoticeOnThePage();
    const dataWithUnknownVariant = { ...createFastestLapData(), variant: 'bandeira' };

    // Act: load it with that data.
    const answer = await loadNoticeWithData(notice, dataWithUnknownVariant);

    // Assert: a 400 naming the field.
    expect(answer, 'bad load data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "variant".',
    });
  });
});

describe('calls made at the wrong moment', () => {
  const callsBeforeLoad = [
    // A renderer that skipped load and played straight away.
    { name: 'answers 409 to playAction before load', call: 'play' },
    // An event that fills the notice before the renderer has loaded it.
    { name: 'answers 409 to updateAction before load', call: 'update' },
  ] as const;

  it.each(callsBeforeLoad)('$name', async ({ call }) => {
    // Arrange: a notice on the page that was never loaded.
    const notice = createNoticeOnThePage();

    // Act: play it, or send it a new reason.
    const answer =
      call === 'play'
        ? await notice.playAction({})
        : await notice.updateAction({ data: { reason: 'Conduta antidesportiva' } });

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'a call before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O aviso ainda não foi carregado (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded notice that was never played.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createFastestLapData());

    // Act: ask it to stop.
    const answer = await notice.stopAction({});

    // Assert: a plain 200; stopping something already off air is not an error.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load, so a loaded notice is never half reset', async () => {
    // Arrange: a notice already loaded with the fastest lap.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createFastestLapData());

    // Act: load it again with the penalty.
    const answer = await loadNoticeWithData(notice, createJumpStartPenaltyData());

    // Assert: a 409, and the fastest lap is still the one drawn.
    expect(answer, 'a second load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O aviso já foi carregado (load); crie outro para novos dados.',
    });
    expect(
      readShownText(notice, 'notice-car-number'),
      'a refused second load must leave the first data drawn',
    ).toBe('31');
  });

  it('answers 404 to any customAction, because the notice has none', async () => {
    // Arrange: a notice on air.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createJumpStartPenaltyData());
    await notice.playAction({ skipAnimation: true });

    // Act: ask for a custom action a control page might guess at.
    const answer = await notice.customAction({ id: 'retirar-aviso', payload: {} });

    // Assert: a 404 naming the unknown action in pt-BR.
    expect(answer, 'an unknown custom action must answer 404 with a pt-BR message').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "retirar-aviso". O aviso não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a notice that was loaded, played and then disposed.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createJumpStartPenaltyData());
    await notice.playAction({ skipAnimation: true });
    await notice.dispose();

    // Act: try to play it and to change its reason.
    const playAnswer = await notice.playAction({ skipAnimation: true });
    const updateAnswer = await notice.updateAction({ data: { reason: 'Conduta antidesportiva' } });

    // Assert: both answer "already disposed".
    const alreadyDisposedAnswer = {
      statusCode: 409,
      statusMessage: 'O aviso já foi descartado (dispose).',
    };
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });
});

describe('playing and stopping', () => {
  it('brings the card on air at step 0 and keeps it there until it is stopped', async () => {
    // Arrange: a loaded penalty notice.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createJumpStartPenaltyData());

    // Act: play it, and let a moment pass with no stop.
    const answer = await notice.playAction({ skipAnimation: true });
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Assert: step 0 is on air, and the card is still visible: it never leaves by itself.
    expect(answer, 'play must answer 200 with step 0 on air').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(readPanelOpacity(notice), 'the notice must stay on air until stopped').toBe('1');
  });

  it('takes the card off air on stopAction', async () => {
    // Arrange: a notice on air.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createJumpStartPenaltyData());
    await notice.playAction({ skipAnimation: true });

    // Act: the server's auto-out (or the operator) stops it.
    const answer = await notice.stopAction({ skipAnimation: true });

    // Assert: 200, and the card is invisible.
    expect(answer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(readPanelOpacity(notice), 'the notice must be off screen once stopped').toBe('0');
  });

  it('takes the card off air when playAction comes while it is already on air', async () => {
    // Arrange: a notice on air at its only step, step 0.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createFastestLapData());
    await notice.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await notice.playAction({ skipAnimation: true });

    // Assert: 200 with no current step, and the card has gone invisible.
    expect(answer, 'playing past the last step must take the notice off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPanelOpacity(notice), 'the notice must be off screen once taken off').toBe('0');
  });
});

describe('updateAction', () => {
  it('changes what the update names on air and keeps the rest', async () => {
    // Arrange: the fastest lap on air.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createFastestLapData());
    await notice.playAction({ skipAnimation: true });

    // Act: car 31 improves on lap 36; only the lap and the time are sent.
    const answer = await notice.updateAction({ data: { lapNumber: 36, lapTimeText: '4:36,9' } });

    // Assert: 200, the new lap and time are drawn, the team is unchanged.
    expect(answer, 'a good update must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(notice, 'notice-head-caption'), 'the new lap must show').toBe('VOLTA 36');
    expect(readShownText(notice, 'notice-lap-time'), 'the new time must show').toBe('4:36,9');
    expect(
      readShownText(notice, 'notice-team-name'),
      'the team must survive a partial update',
    ).toBe('Acauã Baja');
  });

  it('accepts an update before play, and play then shows the new data', async () => {
    // Arrange: a loaded penalty notice, not yet on air.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createJumpStartPenaltyData());

    // Act: race control turns it into a warning before it goes on air, then play.
    const updateAnswer = await notice.updateAction({ data: { noticeKind: 'warning' } });
    await notice.playAction({ skipAnimation: true });

    // Assert: 200, and the card comes on air with the new kind word.
    expect(updateAnswer, 'an update before play must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(notice, 'notice-kind-word'), 'the new kind must show').toBe('ADVERTÊNCIA');
  });

  it('answers 400 to a bad update and keeps showing the previous data', async () => {
    // Arrange: the penalty on air.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createJumpStartPenaltyData());
    await notice.playAction({ skipAnimation: true });

    // Act: send an update with a car number of 0.
    const answer = await notice.updateAction({ data: { carNumber: 0 } });

    // Assert: a 400 naming the field, and car 47 is still shown.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "carNumber".',
    });
    expect(
      readShownText(notice, 'notice-car-number'),
      'a refused update must leave car 47 on air',
    ).toBe('47');
  });
});

describe('dispose', () => {
  it('kills a running play-in and answers the pending play with 409, because the notice was disposed', async () => {
    // Arrange: a loaded notice whose play-in is still running when dispose comes. A
    // 400 ms in is placed on the card itself, so the animation really takes time here.
    const notice = createNoticeOnThePage();
    await loadNoticeWithData(notice, createFastestLapData());
    const panel = findPartOfNotice(notice, 'notice-panel');
    panel?.style.setProperty('--motion-in', '400ms');
    const pendingPlay = notice.playAction({});

    // Act: dispose in the middle of the animation.
    await notice.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play promise settled with "already disposed", and no tween is left.
    expect(
      playAnswer,
      'a play cut short by dispose must resolve with 409 (already disposed), never hang',
    ).toEqual({ statusCode: 409, statusMessage: 'O aviso já foi descartado (dispose).' });
    expect(gsap.getTweensOf(panel ?? []), 'dispose must kill every tween on the card').toEqual([]);
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a notice whose load has started but not yet finished (it waits for the
    // first render and the font).
    const notice = createNoticeOnThePage();
    const pendingLoad = loadNoticeWithData(notice, createFastestLapData());

    // Act: dispose before load finishes, then let load finish and try to play.
    await notice.dispose();
    const loadAnswer = await pendingLoad;
    const playAnswer = await notice.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the graphic refuses to come back on air.
    const alreadyDisposedAnswer = {
      statusCode: 409,
      statusMessage: 'O aviso já foi descartado (dispose).',
    };
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed graphic must never play again').toEqual(alreadyDisposedAnswer);
  });
});
