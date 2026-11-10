/**
 * The Super Chat web component's OGraf lifecycle (packages/graphics/super-chat)
 *
 * What this module is for:
 *   A renderer drives the card through OGraf calls: load, playAction, updateAction,
 *   stopAction, customAction and dispose. Each answers a status and never throws, like the
 *   notice whose lifecycle it shares.
 *
 * What these tests prove:
 *   - load checks the data: the amount and the author are required, an unknown field is
 *     refused, each with a pt-BR message, and a refused load can be tried again.
 *   - Off air after load; on air after play (step 0); a second load is refused (409).
 *   - Play past the one step stops the card; stop takes it off air.
 *   - A call before load, or after dispose, answers 409; a custom action is unknown (404).
 *   - An update with bad data is refused and changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - Motion and look; the Playwright tests in e2e/ cover them in Chromium.
 *   - The scrolling texts' cycle; superChat.scrollingText.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import {
  createPequiSuperChatData,
  createSuperChatOnThePage,
  loadSuperChatWithData,
  readPanelOpacity,
  readShownText,
} from './superChatOnThePage.testSupport.js';

describe('loading the card', () => {
  const refusedDataScenarios = [
    // A Super Chat always has an amount; without it the card would be a name alone.
    {
      name: 'refuses data without the amount',
      data: { authorName: 'Torcida Pequi Off-Road' },
      problem: 'Falta o campo obrigatório "amountText".',
    },
    // And always an author.
    {
      name: 'refuses data without the author',
      data: { amountText: 'R$ 20,00' },
      problem: 'Falta o campo obrigatório "authorName".',
    },
    // A typo'd field name is refused, not ignored.
    {
      name: 'refuses an unknown field',
      data: { ...createPequiSuperChatData(), carNumber: 52 },
      problem: 'Campo desconhecido nos dados: "carNumber".',
    },
  ];

  it.each(refusedDataScenarios)('$name, in pt-BR', async ({ data, problem }) => {
    // Arrange: a card on the page.
    const superChat = createSuperChatOnThePage();

    // Act: load it with the bad data.
    const answer = await loadSuperChatWithData(superChat, data);

    // Assert: 400 with the pt-BR problem.
    expect(answer, 'bad data must be refused with its pt-BR problem').toEqual({
      statusCode: 400,
      statusMessage: problem,
    });
  });

  it('can be loaded again after a refused load', async () => {
    // Arrange: a card whose first load was refused.
    const superChat = createSuperChatOnThePage();
    await loadSuperChatWithData(superChat, { amountText: 'R$ 20,00' });

    // Act: load it with good data.
    const answer = await loadSuperChatWithData(superChat, createPequiSuperChatData());

    // Assert: accepted, off air.
    expect(answer.statusCode, 'the second load must be accepted').toBe(200);
    expect(readPanelOpacity(superChat), 'a loaded card is off air').toBe('0');
  });

  it('refuses a second load', async () => {
    // Arrange: a loaded card.
    const superChat = createSuperChatOnThePage();
    await loadSuperChatWithData(superChat, createPequiSuperChatData());

    // Act: load it again.
    const answer = await loadSuperChatWithData(superChat, createPequiSuperChatData());

    // Assert: refused with 409.
    expect(answer.statusCode, 'a second load must be refused').toBe(409);
  });
});

describe('playing and stopping the card', () => {
  it('goes on air at step 0 and off air with stop', async () => {
    // Arrange: a loaded card.
    const superChat = createSuperChatOnThePage();
    await loadSuperChatWithData(superChat, createPequiSuperChatData());

    // Act: play it, note the answer and opacity, then stop it.
    const playAnswer = await superChat.playAction({ skipAnimation: true });
    const opacityOnAir = readPanelOpacity(superChat);
    const stopAnswer = await superChat.stopAction({ skipAnimation: true });

    // Assert: step 0 on air, fully visible; then invisible.
    expect(playAnswer, 'play must report step 0').toEqual({ statusCode: 200, currentStep: 0 });
    expect(opacityOnAir, 'on air the card is fully visible').toBe('1');
    expect(stopAnswer.statusCode, 'stop must be accepted').toBe(200);
    expect(readPanelOpacity(superChat), 'after stop the card is invisible').toBe('0');
  });

  it('stops when played past its one step', async () => {
    // Arrange: a card on air.
    const superChat = createSuperChatOnThePage();
    await loadSuperChatWithData(superChat, createPequiSuperChatData());
    await superChat.playAction({ skipAnimation: true });

    // Act: play the next step.
    const answer = await superChat.playAction({ delta: 1, skipAnimation: true });

    // Assert: no step on air, the card invisible.
    expect(answer, 'past the last step the card must stop').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPanelOpacity(superChat), 'the card must be off air').toBe('0');
  });
});

describe('calls out of turn', () => {
  it('answers 409 before load and after dispose, and 404 for a custom action', async () => {
    // Arrange: a card never loaded, and one loaded then disposed.
    const neverLoaded = createSuperChatOnThePage();
    const disposed = createSuperChatOnThePage();
    await loadSuperChatWithData(disposed, createPequiSuperChatData());
    await disposed.dispose();

    // Act: play the first, play the second, and ask the second for a custom action.
    const playBeforeLoad = await neverLoaded.playAction({});
    const playAfterDispose = await disposed.playAction({});
    const customAction = await neverLoaded.customAction({ id: 'destacar', payload: {} });

    // Assert: refused, each with its code.
    expect(playBeforeLoad.statusCode, 'play before load must be refused').toBe(409);
    expect(playAfterDispose.statusCode, 'play after dispose must be refused').toBe(409);
    expect(customAction.statusCode, 'the card has no custom actions').toBe(404);
  });

  it('refuses an update with bad data and changes nothing', async () => {
    // Arrange: a loaded card.
    const superChat = createSuperChatOnThePage();
    await loadSuperChatWithData(superChat, createPequiSuperChatData());

    // Act: try to empty the author.
    const answer = await superChat.updateAction({ data: { authorName: '' } });

    // Assert: refused, the author unchanged.
    expect(answer.statusCode, 'an empty author must be refused').toBe(400);
    expect(readShownText(superChat, 'super-chat-author'), 'the author is unchanged').toBe(
      'Torcida Pequi Off-Road',
    );
  });
});
