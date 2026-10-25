/**
 * The QR card web component: load, play, update, stop and dispose
 * (packages/graphics/qr-card)
 *
 * What this module is for:
 *   qr-card.ts is the OGraf graphic itself: a web component the renderer loads, plays,
 *   updates, stops and disposes. It wires the model, the encoder, the view and the
 *   animations together; each of those has its own tests.
 *
 * What these tests prove:
 *   - load makes and draws the code off air and answers 200; bad data answers 400 with the
 *     pt-BR problem, an address too long with its own sentence.
 *   - Calls made at the wrong moment (play or update before load, a second load, anything
 *     after dispose, a custom action it does not have) answer a 4xx status with a pt-BR
 *     message instead of throwing, as OGraf asks. Stop before play is harmless.
 *   - play brings the card on air and reports step 0; play while on air takes it off
 *     (OGraf's "past the last step" rule); stop takes it off.
 *   - dispose ends a running play-in: the pending play resolves with 409 instead of
 *     hanging, and a dispose that lands while load is still waiting is not undone.
 *
 * What these tests deliberately do not cover:
 *   - updateAction, on air and during the stop-out: qr-card.updateAction.test.ts.
 *   - Real rendering, fonts and timing; jsdom draws nothing and has no `document.fonts`, and
 *     no theme token is on the page unless a test places one, so most timelines last 0 ms.
 *     The Playwright suites in e2e/ run the built component in Chromium.
 *   - Timers: the QR card has none (no hold, no page), so there is nothing to stop.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import { buildLongestSampleAddress, createResultsSample } from './previewData.js';
import type QrCardGraphic from './qr-card.js';
import {
  createQrCardOnThePage,
  findPartOfQrCard,
  loadQrCardWithData,
  readDrawnCode,
  readPanelOpacity,
  readShownText,
} from './qrCardOnThePage.testSupport.js';
import { readQrModulesFromPathData, scanQrModules } from './qrCodeScanning.testSupport.js';

/** Scans the code the card shows now, from its own path. */
function scanTheCodeOnTheCard(qrCard: QrCardGraphic): string | undefined {
  const { pathData, moduleCount } = readDrawnCode(qrCard);
  return scanQrModules(readQrModulesFromPathData(pathData, moduleCount));
}

const alreadyDisposedAnswer = {
  statusCode: 409,
  statusMessage: 'O cartão de QR já foi descartado (dispose).',
};

describe('load', () => {
  it('makes and draws the code off air and answers 200', async () => {
    // Arrange: a QR card on the page, never loaded.
    const qrCard = createQrCardOnThePage();

    // Act: load it with the design's card.
    const answer = await loadQrCardWithData(qrCard, createResultsSample());

    // Assert: 200, the code opens the address, the call is drawn, the card waits invisible.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(scanTheCodeOnTheCard(qrCard), 'the drawn code must open the address').toBe(
      'resultados.bajasaebrasil.net',
    );
    expect(readShownText(qrCard, 'qr-card-call-to-action'), 'the call must be drawn').toBe(
      'Acompanhe os resultados',
    );
    expect(readPanelOpacity(qrCard), 'a loaded card must stay off screen until play').toBe('0');
  });

  const refusedLoadScenarios = [
    // A form that forgot the call to action.
    {
      name: 'answers 400 naming a missing field',
      data: { address: 'resultados.bajasaebrasil.net' },
      statusMessage: 'Falta o campo obrigatório "callToAction".',
    },
    // An address the card cannot hold: the operator reads why, with both lengths.
    {
      name: 'answers 400 with the address’s own sentence when it is too long',
      data: { ...createResultsSample(), address: `${buildLongestSampleAddress()}x` },
      statusMessage:
        'O endereço do QR tem 107 caracteres; no cartão cabe um código de no máximo 106.',
    },
  ];

  it.each(refusedLoadScenarios)('$name', async ({ data, statusMessage }) => {
    // Arrange: a QR card on the page, never loaded.
    const qrCard = createQrCardOnThePage();

    // Act: load it with the bad data.
    const answer = await loadQrCardWithData(qrCard, data);

    // Assert: a 400 with the pt-BR problem.
    expect(answer, 'bad load data must answer 400 with its pt-BR problem').toEqual({
      statusCode: 400,
      statusMessage,
    });
  });
});

describe('calls made at the wrong moment', () => {
  const callsBeforeLoad = [
    // A renderer that skipped load and played straight away.
    { name: 'answers 409 to playAction before load', call: 'play' },
    // An update before the renderer has loaded the card.
    { name: 'answers 409 to updateAction before load', call: 'update' },
  ] as const;

  it.each(callsBeforeLoad)('$name', async ({ call }) => {
    // Arrange: a QR card on the page that was never loaded.
    const qrCard = createQrCardOnThePage();

    // Act: play it, or send it a new address.
    const answer =
      call === 'play'
        ? await qrCard.playAction({})
        : await qrCard.updateAction({ data: { address: 'bajasaebrasil.net/ao-vivo' } });

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'a call before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O cartão de QR ainda não foi carregado (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded QR card that was never played.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());

    // Act: ask it to stop.
    const answer = await qrCard.stopAction({});

    // Assert: a plain 200; stopping something already off air is not an error.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load, so a loaded card is never half reset', async () => {
    // Arrange: a QR card already loaded with the design's card.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());

    // Act: load it again with another address.
    const answer = await loadQrCardWithData(qrCard, {
      callToAction: 'Assista ao vivo',
      address: 'bajasaebrasil.net/ao-vivo',
    });

    // Assert: a 409, and the first code is still the one drawn.
    expect(answer, 'a second load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O cartão de QR já foi carregado (load); crie outro para novos dados.',
    });
    expect(scanTheCodeOnTheCard(qrCard), 'a refused second load must leave the first code').toBe(
      'resultados.bajasaebrasil.net',
    );
  });

  it('answers 404 to any customAction, because the QR card has none', async () => {
    // Arrange: a QR card on air.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    await qrCard.playAction({ skipAnimation: true });

    // Act: ask for a custom action a control page might guess at.
    const answer = await qrCard.customAction({ id: 'piscar-codigo', payload: {} });

    // Assert: a 404 naming the unknown action in pt-BR.
    expect(answer, 'an unknown custom action must answer 404 with a pt-BR message').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "piscar-codigo". O cartão de QR não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a QR card that was loaded, played and then disposed.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    await qrCard.playAction({ skipAnimation: true });
    await qrCard.dispose();

    // Act: try to play it and to change its address.
    const playAnswer = await qrCard.playAction({ skipAnimation: true });
    const updateAnswer = await qrCard.updateAction({ data: { address: 'bajasaebrasil.net' } });

    // Assert: both answer "already disposed".
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });
});

describe('playing and stopping', () => {
  it('brings the card on air at step 0', async () => {
    // Arrange: a loaded QR card.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());

    // Act: play it.
    const answer = await qrCard.playAction({ skipAnimation: true });

    // Assert: step 0 is on air and the card is visible.
    expect(answer, 'play must answer 200 with step 0 on air').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(readPanelOpacity(qrCard), 'the card must be visible on air').toBe('1');
  });

  it('takes the card off air on stopAction', async () => {
    // Arrange: a QR card on air.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    await qrCard.playAction({ skipAnimation: true });

    // Act: the operator takes it off.
    const answer = await qrCard.stopAction({ skipAnimation: true });

    // Assert: 200, and the card is invisible.
    expect(answer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(readPanelOpacity(qrCard), 'the card must be off screen once stopped').toBe('0');
  });

  it('takes the card off air when playAction comes while it is already on air', async () => {
    // Arrange: a QR card on air at its only step, step 0.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    await qrCard.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await qrCard.playAction({ skipAnimation: true });

    // Assert: 200 with no current step, and the card has gone invisible.
    expect(answer, 'playing past the last step must take the card off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPanelOpacity(qrCard), 'the card must be off screen once taken off').toBe('0');
  });
});

describe('dispose', () => {
  it('kills a running play-in and answers the pending play with 409', async () => {
    // Arrange: a loaded QR card whose play-in takes 400 ms (placed on the card itself).
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    const panel = findPartOfQrCard(qrCard, 'qr-card-panel');
    panel?.style.setProperty('--motion-in', '400ms');
    const pendingPlay = qrCard.playAction({});

    // Act: dispose in the middle of the animation.
    await qrCard.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play promise settled with "already disposed", and no tween is left.
    expect(playAnswer, 'a play cut short by dispose must resolve with 409, never hang').toEqual(
      alreadyDisposedAnswer,
    );
    expect(gsap.getTweensOf(panel ?? []), 'dispose must kill every tween on the card').toEqual([]);
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a QR card whose load has started but not yet finished (it waits for the
    // first render and the font).
    const qrCard = createQrCardOnThePage();
    const pendingLoad = loadQrCardWithData(qrCard, createResultsSample());

    // Act: dispose before load finishes, then let load finish and try to play.
    await qrCard.dispose();
    const loadAnswer = await pendingLoad;
    const playAnswer = await qrCard.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the graphic refuses to come back on air.
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed graphic must never play again').toEqual(alreadyDisposedAnswer);
  });
});
