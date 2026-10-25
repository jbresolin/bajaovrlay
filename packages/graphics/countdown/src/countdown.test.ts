/**
 * The countdown web component: load, play, update, stop and dispose, and its count on air
 * (packages/graphics/countdown)
 *
 * What this module is for:
 *   countdown.ts is the OGraf graphic itself: a web component the renderer loads, plays,
 *   updates, stops and disposes. It counts down to `startsAtMs` by itself, every frame
 *   while on air, on the server-aligned clock (BAJAOVRLAY-46, decided).
 *
 * What these tests prove (frames run by hand, Date.now fixed by the test):
 *   - load draws the session and the count as it is now, off air, and answers 200; bad
 *     data answers 400 naming the field; calls at the wrong moment answer 409 or 404.
 *   - On air the count follows the clock, and at the start shows "0:00" and stops: no
 *     frame is booked after it, and it never counts negative.
 *   - A start moved later by an update on air is followed, and counts again after 0:00.
 *   - The count reads the server's clock: on a machine 30 s behind it is 30 s shorter.
 *   - stop, dispose and removal from the page each stop the count: no frame is left
 *     booked, and time passing changes nothing (these fail if the stop is removed).
 *   - An update during the stop-out leaves the fading card alone and is drawn once it has
 *     faded; one off air stores and draws the data but books no
 *     frame; the count starts again at the next play.
 *   - A change of layout on air draws the waiting board in place of the card, on air.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering, fonts and timing; jsdom draws nothing, no theme token is on the page,
 *     so every timeline lasts 0 ms. e2e/ runs the built graphic in Chromium.
 *   - Which parts each layout shows; countdownView.test.ts.
 */
import { finishEveryRunningMotionAtOnce } from '@bajaovrlay/graphics-kit/runningMotions.testSupport';
import { forgetServerClockSamples, recordServerClockSample } from '@bajaovrlay/shared/clock';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  createCountdownOnThePage,
  createEnduroCountdownData,
  enduroStartsAtMs,
  findPartOfCountdown,
  loadCountdownWithData,
  readCount,
  readShownText,
  takeControlOfFramesAndTime,
} from './countdownOnThePage.testSupport.js';

/** A countdown on air: loaded with the enduro's card at 09:36:15 and played. */
async function putTheEnduroCountdownOnAir(layout: 'card' | 'fullscreen' = 'card') {
  const framesAndTime = takeControlOfFramesAndTime();
  const countdown = createCountdownOnThePage();
  await loadCountdownWithData(countdown, createEnduroCountdownData(layout));
  await countdown.playAction({ skipAnimation: true });
  return { countdown, framesAndTime };
}

describe('load', () => {
  it('draws the session and the count as it is now, off air, and answers 200', async () => {
    // Arrange: the clock at 09:36:15, a countdown on the page.
    takeControlOfFramesAndTime();
    const countdown = createCountdownOnThePage();

    // Act: load the enduro's card.
    const answer = await loadCountdownWithData(countdown, createEnduroCountdownData());

    // Assert: 200, the session and 23:45, invisible until play.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(countdown, 'countdown-session'), 'the session').toBe(
      'Enduro de Resistência',
    );
    expect(readCount(countdown), 'the count as it is now').toBe('23:45');
    expect(
      findPartOfCountdown(countdown, 'countdown-panel')?.style.opacity,
      'a loaded countdown waits off screen',
    ).toBe('0');
  });

  it('answers 400 with a pt-BR message naming a start that is not a whole number', async () => {
    // Arrange: a countdown and data whose start is text.
    const countdown = createCountdownOnThePage();

    // Act: load it.
    const answer = await loadCountdownWithData(countdown, {
      ...createEnduroCountdownData(),
      startsAtMs: '10:00',
    });

    // Assert: refused, naming the field.
    expect(answer, 'bad data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "startsAtMs".',
    });
  });
});

describe('calls made at the wrong moment', () => {
  it('answers 409 to play before load and to a second load, 404 to a custom action', async () => {
    // Arrange: a countdown on the page, never loaded.
    const countdown = createCountdownOnThePage();

    // Act: play it, load it twice, ask for a custom action.
    const playBeforeLoad = await countdown.playAction({});
    await loadCountdownWithData(countdown, createEnduroCountdownData());
    const secondLoad = await loadCountdownWithData(countdown, createEnduroCountdownData());
    const customAction = await countdown.customAction({ id: 'reiniciar', payload: {} });

    // Assert: each answered with its status and a pt-BR message, nothing thrown.
    expect(
      [playBeforeLoad.statusCode, secondLoad.statusCode, customAction.statusCode],
      'wrong-moment calls answer, never throw',
    ).toEqual([409, 409, 404]);
  });

  it('answers 409 to play and update after dispose', async () => {
    // Arrange: a loaded countdown, then disposed.
    const countdown = createCountdownOnThePage();
    await loadCountdownWithData(countdown, createEnduroCountdownData());
    await countdown.dispose();

    // Act: play and update it.
    const play = await countdown.playAction({});
    const update = await countdown.updateAction({ data: { sessionName: 'Super Prime' } });

    // Assert: both refused as disposed.
    expect([play, update], 'a disposed countdown does nothing').toEqual([
      { statusCode: 409, statusMessage: 'A contagem já foi descartada (dispose).' },
      { statusCode: 409, statusMessage: 'A contagem já foi descartada (dispose).' },
    ]);
  });
});

describe('the count on air', () => {
  it('follows the clock, frame by frame', async () => {
    // Arrange: the card on air at 09:36:15.
    const { countdown, framesAndTime } = await putTheEnduroCountdownOnAir();

    // Act: a second and then a minute pass, a frame after each.
    framesAndTime.letTimePass(1000);
    framesAndTime.runPendingFrames();
    const afterASecond = readCount(countdown);
    framesAndTime.letTimePass(60_000);
    framesAndTime.runPendingFrames();

    // Assert: 23:44, then 22:44.
    expect(afterASecond, 'a second later').toBe('23:44');
    expect(readCount(countdown), 'a minute after that').toBe('22:44');
  });

  it('shows 0:00 at the start and stops, never counting negative', async () => {
    // Arrange: the card on air.
    const { countdown, framesAndTime } = await putTheEnduroCountdownOnAir();

    // Act: the start passes and a frame runs; then a minute more.
    framesAndTime.letTimePass(23 * 60_000 + 45_000);
    framesAndTime.runPendingFrames();
    const framesLeftAtZero = framesAndTime.countPendingFrames();
    framesAndTime.letTimePass(60_000);
    framesAndTime.runPendingFrames();

    // Assert: 0:00, nothing booked after it, still 0:00 a minute later.
    expect(readCount(countdown), 'the count stops at 0:00').toBe('0:00');
    expect(framesLeftAtZero, 'no frame is booked once the count is over').toBe(0);
  });

  it('follows a start moved later on air, and counts again after 0:00', async () => {
    // Arrange: the card on air, the start passed.
    const { countdown, framesAndTime } = await putTheEnduroCountdownOnAir();
    framesAndTime.letTimePass(23 * 60_000 + 45_000);
    framesAndTime.runPendingFrames();

    // Act: the schedule moves the start ten minutes later; a second passes.
    await countdown.updateAction({ data: { startsAtMs: enduroStartsAtMs + 600_000 } });
    framesAndTime.letTimePass(1000);
    framesAndTime.runPendingFrames();

    // Assert: 9:59 to the new start.
    expect(readCount(countdown), 'the new start is the target').toBe('9:59');
  });

  it('counts on the server’s clock, not the machine’s', async () => {
    // Arrange: the machine at 09:36:15, the server's clock 30 s ahead of it.
    const framesAndTime = takeControlOfFramesAndTime();
    forgetServerClockSamples();
    onTestFinished(() => forgetServerClockSamples());
    recordServerClockSample(Date.now() + 30_000, Date.now());
    const countdown = createCountdownOnThePage();

    // Act: load and play it, and run a frame.
    await loadCountdownWithData(countdown, createEnduroCountdownData());
    await countdown.playAction({ skipAnimation: true });
    framesAndTime.runPendingFrames();

    // Assert: 23:15, thirty seconds less than the machine's clock would say.
    expect(readCount(countdown), 'the count runs on the server’s clock').toBe('23:15');
  });
});

describe('the count stopped', () => {
  it('stops on stop: no frame is left, and time passing changes nothing', async () => {
    // Arrange: the card on air.
    const { countdown, framesAndTime } = await putTheEnduroCountdownOnAir();

    // Act: stop it, then a minute passes and whatever frame is booked runs.
    await countdown.stopAction({ skipAnimation: true });
    const framesLeft = framesAndTime.countPendingFrames();
    framesAndTime.letTimePass(60_000);
    framesAndTime.runPendingFrames();

    // Assert: no frame, and the count as it was at the stop.
    expect(framesLeft, 'stop must cancel the frame loop').toBe(0);
    expect(readCount(countdown), 'nothing ticks off air').toBe('23:45');
  });

  it('stops on dispose', async () => {
    // Arrange: the card on air.
    const { countdown, framesAndTime } = await putTheEnduroCountdownOnAir();

    // Act: dispose it.
    await countdown.dispose();

    // Assert: no frame is left booked.
    expect(framesAndTime.countPendingFrames(), 'dispose must cancel the frame loop').toBe(0);
  });

  it('stops when the element leaves the page without dispose', async () => {
    // Arrange: the card on air.
    const { countdown, framesAndTime } = await putTheEnduroCountdownOnAir();

    // Act: the renderer takes the element out of the page.
    countdown.remove();

    // Assert: no frame is left booked.
    expect(framesAndTime.countPendingFrames(), 'a removed countdown must not tick').toBe(0);
  });

  it('only stores and draws an update off air, and ticks again at the next play', async () => {
    // Arrange: the card played and stopped.
    const { countdown, framesAndTime } = await putTheEnduroCountdownOnAir();
    await countdown.stopAction({ skipAnimation: true });

    // Act: the start moves while off air; then the countdown is played again.
    await countdown.updateAction({ data: { startsAtMs: enduroStartsAtMs + 600_000 } });
    const framesAfterTheUpdate = framesAndTime.countPendingFrames();
    const countAfterTheUpdate = readCount(countdown);
    await countdown.playAction({ skipAnimation: true });

    // Assert: the new count drawn, no frame booked off air, and one booked on air.
    expect(countAfterTheUpdate, 'the update is drawn').toBe('33:45');
    expect(framesAfterTheUpdate, 'an update off air books no frame').toBe(0);
    expect(framesAndTime.countPendingFrames(), 'play starts the count again').toBe(1);
  });

  it('leaves the fading card alone during the stop-out, then draws the update', async () => {
    // Arrange: the card on air, its stop-out lasting 250 ms (on the panel itself, since jsdom
    // carries no custom property from :root into a shadow root), the stop started.
    const { countdown, framesAndTime } = await putTheEnduroCountdownOnAir();
    findPartOfCountdown(countdown, 'countdown-panel')?.style.setProperty('--motion-out', '250ms');
    const pendingStop = countdown.stopAction({});

    // Act: the session is renamed while the card fades; then the stop-out is ended at once
    // (never waited for: a real motion under fake time may outlast the test's timeout).
    const answer = await countdown.updateAction({ data: { sessionName: 'Super Prime' } });
    const sessionDuringTheStopOut = readShownText(countdown, 'countdown-session');
    finishEveryRunningMotionAtOnce();
    await pendingStop;

    // Assert: accepted, the fading card unchanged, the new session drawn once faded, and
    // nothing ticking.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(sessionDuringTheStopOut, 'the fading card keeps its session').toBe(
      'Enduro de Resistência',
    );
    expect(readShownText(countdown, 'countdown-session'), 'drawn once faded').toBe('Super Prime');
    expect(framesAndTime.countPendingFrames(), 'no frame during or after the stop-out').toBe(0);
  });
});

describe('a change of layout on air', () => {
  it('draws the waiting board in place of the card, on air', async () => {
    // Arrange: the card on air.
    const { countdown } = await putTheEnduroCountdownOnAir();

    // Act: switch to the full screen.
    await countdown.updateAction({ data: { layout: 'fullscreen' } });

    // Assert: the board's head and body are there and fully visible, with the count.
    expect(
      findPartOfCountdown(countdown, 'countdown-panel')?.dataset.layout,
      'the board is drawn',
    ).toBe('fullscreen');
    expect(
      [
        findPartOfCountdown(countdown, 'countdown-head')?.style.opacity,
        findPartOfCountdown(countdown, 'countdown-body')?.style.opacity,
      ],
      'the new pieces are on air at once',
    ).toEqual(['1', '1']);
    expect(readCount(countdown), 'the count goes on').toBe('23:45');
  });
});
