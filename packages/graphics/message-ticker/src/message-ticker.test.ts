/**
 * The message ticker web component: what it shows, load, play, update, stop and dispose
 * (packages/graphics/message-ticker)
 *
 * What this module is for:
 *   message-ticker.ts is the OGraf graphic itself: the strip's bar with the clock block,
 *   the label, one message a page and the page cell. Its page turns have their own file
 *   (message-ticker.paging.test.ts).
 *
 * What these tests prove:
 *   - With three messages, load draws the first off air in pt-BR: "1:00:00" and VERDE in
 *     the block, "AVISO", "Largada do enduro às 10h00", "1/3".
 *   - With one message the page cell reads "1/1".
 *   - The clock block switched off leaves the label at the left of the bar; switched on
 *     on air it appears at once in its place.
 *   - The play-in cascades the block, the label, the message and the page cell
 *     `--motion-row-stagger` apart; play while on air takes the ticker off.
 *   - "Atualizar no ar" with a new list of messages rewrites the message on air in place.
 *   - Calls at the wrong moment answer a 4xx with a pt-BR message, never a throw; a
 *     message too long is refused with 400 naming the field; dispose ends a running play-in.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering and fonts; jsdom draws nothing, and unless a test places tokens every
 *     timeline lasts 0 ms. The Playwright suites in e2e/ run the built ticker.
 *   - The page timer and turns; message-ticker.paging.test.ts.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createEnduroTickerData,
  createMessageTickerOnThePage,
  findPartOfMessageTicker,
  loadMessageTickerWithData,
  readMessageOnAir,
  readPageCell,
} from './messageTickerOnThePage.testSupport.js';

const alreadyDisposedAnswer = {
  statusCode: 409,
  statusMessage: 'O letreiro já foi descartado (dispose).',
};

describe('what the ticker shows', () => {
  it('draws the first of three messages off air in pt-BR', async () => {
    // Arrange: a ticker on the page, never loaded.
    const ticker = createMessageTickerOnThePage();

    // Act: load it with the enduro's three announcements.
    const answer = await loadMessageTickerWithData(ticker, createEnduroTickerData());

    // Assert: the block, the label, the first message and "1/3", waiting for play.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(findPartOfMessageTicker(ticker, 'clock-block-time')?.textContent, 'the time').toBe(
      '1:00:00',
    );
    expect(findPartOfMessageTicker(ticker, 'clock-block-flag-word')?.textContent, 'the flag').toBe(
      'VERDE',
    );
    expect(findPartOfMessageTicker(ticker, 'message-ticker-label')?.textContent, 'the label').toBe(
      'AVISO',
    );
    expect(readMessageOnAir(ticker), 'the first message').toBe('Largada do enduro às 10h00');
    expect(readPageCell(ticker), 'the page cell').toBe('1/3');
    expect(
      findPartOfMessageTicker(ticker, 'message-ticker-page-cell')?.style.opacity,
      'a loaded ticker must stay off screen until play',
    ).toBe('0');
  });

  it('reads "1/1" with one message', async () => {
    // Arrange: a ticker.
    const ticker = createMessageTickerOnThePage();

    // Act: load it with the one announcement.
    await loadMessageTickerWithData(ticker, {
      ...createEnduroTickerData(),
      messages: ['Box aberto para abastecimento'],
    });

    // Assert: the message and a page cell of one.
    expect(readMessageOnAir(ticker), 'the one message').toBe('Box aberto para abastecimento');
    expect(readPageCell(ticker), 'one page').toBe('1/1');
  });

  it('starts the bar with the label when the clock block is off', async () => {
    // Arrange: a ticker.
    const ticker = createMessageTickerOnThePage();

    // Act: load it with the block switched off, between sessions.
    await loadMessageTickerWithData(ticker, { ...createEnduroTickerData(), showClockBlock: false });

    // Assert: the bar drawn without the block, the block hidden.
    expect(
      findPartOfMessageTicker(ticker, 'message-ticker-bar')?.dataset.clockBlock,
      'the bar is drawn without its block',
    ).toBe('hidden');
    expect(findPartOfMessageTicker(ticker, 'clock-block')?.hidden, 'the block is hidden').toBe(
      true,
    );
  });

  it('shows the block at once in its place when switched on on air', async () => {
    // Arrange: the ticker on air without its block.
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, { ...createEnduroTickerData(), showClockBlock: false });
    await ticker.playAction({ skipAnimation: true });

    // Act: the session starts, so the operator switches the block on.
    await ticker.updateAction({ data: { showClockBlock: true } });

    // Assert: shown and visible at once.
    const block = findPartOfMessageTicker(ticker, 'clock-block');
    expect(block?.hidden, 'the block is shown').toBe(false);
    expect(block?.style.opacity, 'and visible at once').toBe('1');
  });
});

describe('playing, updating and stopping', () => {
  it('cascades the block, the label, the message and the page cell a row stagger apart', async () => {
    // Arrange: a loaded ticker with Ardósia's in and stagger on the bar itself (jsdom
    // carries no custom property from :root into a shadow root).
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, createEnduroTickerData());
    const bar = findPartOfMessageTicker(ticker, 'message-ticker-bar');
    bar?.style.setProperty('--motion-in', '400ms');
    bar?.style.setProperty('--motion-row-stagger', '30ms');
    const pieces = [
      findPartOfMessageTicker(ticker, 'clock-block'),
      findPartOfMessageTicker(ticker, 'message-ticker-label-pill'),
      findPartOfMessageTicker(ticker, 'message-ticker-message'),
      findPartOfMessageTicker(ticker, 'message-ticker-page-cell'),
    ];

    // Act: start the play-in, let it begin, read when each piece starts, then end it.
    const pendingPlay = ticker.playAction({});
    await new Promise((resolve) => setTimeout(resolve, 0));
    const startsMs = pieces.map((piece) =>
      Math.round((gsap.getTweensOf(piece ?? [])[0]?.startTime() ?? -1) * 1000),
    );
    await ticker.dispose();
    await pendingPlay;

    // Assert: left to right, 30 ms apart.
    expect(startsMs, 'each piece 30 ms after the one before').toEqual([0, 30, 60, 90]);
  });

  it('rewrites the message on air in place when "Atualizar no ar" sends a new list', async () => {
    // Arrange: the ticker on air with three messages, its message pill noted.
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, createEnduroTickerData());
    await ticker.playAction({ skipAnimation: true });
    const pillBefore = findPartOfMessageTicker(ticker, 'message-ticker-message');

    // Act: the operator corrects the first message and adds a fourth.
    const answer = await ticker.updateAction({
      data: {
        messages: [
          'Largada do enduro às 10h30',
          'Box aberto para abastecimento',
          'Premiação às 16h no palco principal',
          'Estacionamento pelo portão 2',
        ],
      },
    });

    // Assert: the corrected message on the same pill, still on air, and "1/4".
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(readMessageOnAir(ticker), 'the corrected message').toBe('Largada do enduro às 10h30');
    expect(
      findPartOfMessageTicker(ticker, 'message-ticker-message'),
      'the pill is rewritten, never rebuilt',
    ).toBe(pillBefore);
    expect(readPageCell(ticker), 'four messages now').toBe('1/4');
  });

  it('takes the ticker off when played again, and answers stop before play with 200', async () => {
    // Arrange: one ticker on air, one loaded and never played.
    const tickerOnAir = createMessageTickerOnThePage();
    await loadMessageTickerWithData(tickerOnAir, createEnduroTickerData());
    await tickerOnAir.playAction({ skipAnimation: true });
    const tickerOffAir = createMessageTickerOnThePage();
    await loadMessageTickerWithData(tickerOffAir, createEnduroTickerData());

    // Act: play the first again, stop the second.
    const secondPlay = await tickerOnAir.playAction({ skipAnimation: true });
    const stopOffAir = await tickerOffAir.stopAction({});

    // Assert: off air, and a plain 200.
    expect(secondPlay, 'playing past the last step takes the ticker off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(stopOffAir, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });
});

describe('calls refused', () => {
  it('answers 409 before load and after dispose, and 404 to a custom action', async () => {
    // Arrange: a ticker never loaded, and one loaded then disposed.
    const neverLoaded = createMessageTickerOnThePage();
    const disposed = createMessageTickerOnThePage();
    await loadMessageTickerWithData(disposed, createEnduroTickerData());
    await disposed.dispose();

    // Act: play the first; play the second; ask the first for a custom action.
    const playBeforeLoad = await neverLoaded.playAction({});
    const playAfterDispose = await disposed.playAction({ skipAnimation: true });
    const customAnswer = await neverLoaded.customAction({ id: 'proximo-aviso', payload: {} });

    // Assert: each refused in pt-BR.
    expect(playBeforeLoad, 'play before load').toEqual({
      statusCode: 409,
      statusMessage: 'O letreiro ainda não foi carregado (load).',
    });
    expect(playAfterDispose, 'play after dispose').toEqual(alreadyDisposedAnswer);
    expect(customAnswer, 'an unknown custom action').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "proximo-aviso". O letreiro não tem ações personalizadas.',
    });
  });

  it('answers 400 to a message too long for the bar, naming the field', async () => {
    // Arrange: a ticker on air.
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, createEnduroTickerData());
    await ticker.playAction({ skipAnimation: true });

    // Act: an update past the editor's check, with a message of 51 characters.
    const answer = await ticker.updateAction({ data: { messages: ['A'.repeat(51)] } });

    // Assert: refused, and the first announcement still on air.
    expect(answer, 'a message over the limit must answer 400').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "messages[0]".',
    });
    expect(readMessageOnAir(ticker), 'the message on air is kept').toBe(
      'Largada do enduro às 10h00',
    );
  });

  it('ends a running play-in on dispose, answering the pending play with 409', async () => {
    // Arrange: a loaded ticker whose play-in takes 400 ms (on the bar itself).
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, createEnduroTickerData());
    findPartOfMessageTicker(ticker, 'message-ticker-bar')?.style.setProperty(
      '--motion-in',
      '400ms',
    );
    const pendingPlay = ticker.playAction({});

    // Act: dispose in the middle of the animation.
    await ticker.dispose();
    const playAnswer = await pendingPlay;

    // Assert: settled with "already disposed", no tween left.
    const pageCell = findPartOfMessageTicker(ticker, 'message-ticker-page-cell');
    expect(playAnswer, 'a play cut short by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(gsap.getTweensOf(pageCell ?? []), 'dispose must kill every tween').toEqual([]);
  });
});
