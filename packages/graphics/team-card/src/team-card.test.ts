/**
 * The team card web component: load, play, update, stop and dispose
 * (packages/graphics/team-card)
 *
 * What this module is for:
 *   team-card.ts is the OGraf graphic itself: a web component the renderer loads, plays,
 *   updates, stops and disposes. It wires the model, the view, the image wait and the
 *   animations together; each of those has its own tests.
 *
 * What these tests prove:
 *   - load draws the data off air and answers 200; bad data answers 400 naming the field.
 *   - load waits for the card's photo and logo, so play brings them in with the card; a
 *     broken logo ends that wait like a loaded one and never keeps the card from loading.
 *   - Calls made at the wrong moment (play or update before load, a second load, anything
 *     after dispose, a custom action it does not have) answer a 4xx status with a pt-BR
 *     message instead of throwing, as OGraf asks. Stop before play is harmless.
 *   - play brings the card on air and reports step 0; play while on air takes it off
 *     (OGraf's "past the last step" rule); stop takes it off.
 *   - updateAction merges partial data on air or off and redraws in place: a logo added
 *     on air appears in the same card element, which stays on air; a bad update answers
 *     400 and leaves the card as it was.
 *   - dispose ends a running play-in: the pending play resolves with 409 instead of
 *     hanging, and a dispose that lands while load is still waiting is not undone.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering, fonts, images and timing; jsdom draws nothing, loads no image (the
 *     image test fires the images' events by hand) and has no `document.fonts`, and no
 *     theme token is on the page, so every timeline lasts 0 ms. The Playwright suites in
 *     e2e/ run the built component in Chromium for the lifecycle, the motion and the
 *     screenshots.
 *   - Which parts each combination shows; teamCardView.test.ts covers that.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createReptilesTeamCardDataWithMedia,
  createReptilesTeamCardDataWithoutMedia,
  createTeamCardOnThePage,
  findPartOfTeamCard,
  loadTeamCardWithData,
  readPanelOpacity,
  readShownText,
} from './teamCardOnThePage.testSupport.js';

/** Lets the pending promise callbacks and timers of the page run once. */
function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('load', () => {
  it('draws the data off air and answers 200', async () => {
    // Arrange: a team card on the page, never loaded.
    const teamCard = createTeamCardOnThePage();

    // Act: load it with car 7.
    const answer = await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());

    // Assert: 200, the data is drawn, and the card waits invisible for play.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(teamCard, 'team-card-team-name'), 'the team must be drawn').toBe(
      'Reptiles Baja PUC-Rio',
    );
    expect(readShownText(teamCard, 'team-card-place-line'), 'the place line must be drawn').toBe(
      'Rio de Janeiro · RJ',
    );
    expect(readPanelOpacity(teamCard), 'a loaded card must stay off screen until play').toBe('0');
  });

  it('answers 400 with a pt-BR message naming the bad field', async () => {
    // Arrange: a team card and data without the school.
    const teamCard = createTeamCardOnThePage();
    const dataWithoutSchool = { carNumber: 7, teamName: 'Reptiles Baja PUC-Rio' };

    // Act: load it with that data.
    const answer = await loadTeamCardWithData(teamCard, dataWithoutSchool);

    // Assert: a 400 naming the field.
    expect(answer, 'bad load data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "schoolName".',
    });
  });

  it('waits for the photo and the logo, and a broken logo ends the wait like a loaded one', async () => {
    // Arrange: a team card loading car 7 with its photo and its logo.
    const teamCard = createTeamCardOnThePage();
    const answers: unknown[] = [];
    const pendingLoad = loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithMedia());
    void pendingLoad.then((answer) => answers.push(answer));
    await letThePageCatchUp();
    const hadAnsweredBeforeTheImages = answers.length > 0;

    // Act: the photo arrives and the logo's address turns out to be broken.
    findPartOfTeamCard(teamCard, 'team-card-photo')?.dispatchEvent(new Event('load'));
    findPartOfTeamCard(teamCard, 'team-card-logo')?.dispatchEvent(new Event('error'));
    const answer = await pendingLoad;

    // Assert: load held for the images, then answered 200 despite the broken logo.
    expect(hadAnsweredBeforeTheImages, 'load must wait for the card’s images').toBe(false);
    expect(answer, 'a broken logo must never keep the card from loading').toEqual({
      statusCode: 200,
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
    // Arrange: a team card on the page that was never loaded.
    const teamCard = createTeamCardOnThePage();

    // Act: play it, or send it a new city.
    const answer =
      call === 'play'
        ? await teamCard.playAction({})
        : await teamCard.updateAction({ data: { city: 'Niterói' } });

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'a call before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O cartão de equipe ainda não foi carregado (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded team card that was never played.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());

    // Act: ask it to stop.
    const answer = await teamCard.stopAction({});

    // Assert: a plain 200; stopping something already off air is not an error.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load, so a loaded card is never half reset', async () => {
    // Arrange: a team card already loaded with car 7.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());

    // Act: load it again with car 47.
    const answer = await loadTeamCardWithData(teamCard, {
      carNumber: 47,
      teamName: 'Pato Baja',
      schoolName: 'UTFPR-PB',
    });

    // Assert: a 409, and car 7 is still the one drawn.
    expect(answer, 'a second load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O cartão de equipe já foi carregado (load); crie outro para novos dados.',
    });
    expect(
      readShownText(teamCard, 'team-card-car-number'),
      'a refused second load must leave the first data drawn',
    ).toBe('7');
  });

  it('answers 404 to any customAction, because the team card has none', async () => {
    // Arrange: a team card on air.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
    await teamCard.playAction({ skipAnimation: true });

    // Act: ask for a custom action a control page might guess at.
    const answer = await teamCard.customAction({ id: 'mostrar-logo', payload: {} });

    // Assert: a 404 naming the unknown action in pt-BR.
    expect(answer, 'an unknown custom action must answer 404 with a pt-BR message').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "mostrar-logo". O cartão de equipe não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a team card that was loaded, played and then disposed.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
    await teamCard.playAction({ skipAnimation: true });
    await teamCard.dispose();

    // Act: try to play it and to change its city.
    const playAnswer = await teamCard.playAction({ skipAnimation: true });
    const updateAnswer = await teamCard.updateAction({ data: { city: 'Niterói' } });

    // Assert: both answer "already disposed".
    const alreadyDisposedAnswer = {
      statusCode: 409,
      statusMessage: 'O cartão de equipe já foi descartado (dispose).',
    };
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });
});

describe('playing and stopping', () => {
  it('brings the card on air at step 0', async () => {
    // Arrange: a loaded team card.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());

    // Act: play it.
    const answer = await teamCard.playAction({ skipAnimation: true });

    // Assert: step 0 is on air and the card is visible.
    expect(answer, 'play must answer 200 with step 0 on air').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(readPanelOpacity(teamCard), 'the card must be visible on air').toBe('1');
  });

  it('takes the card off air on stopAction', async () => {
    // Arrange: a team card on air.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
    await teamCard.playAction({ skipAnimation: true });

    // Act: the operator takes it off.
    const answer = await teamCard.stopAction({ skipAnimation: true });

    // Assert: 200, and the card is invisible.
    expect(answer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(readPanelOpacity(teamCard), 'the card must be off screen once stopped').toBe('0');
  });

  it('takes the card off air when playAction comes while it is already on air', async () => {
    // Arrange: a team card on air at its only step, step 0.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
    await teamCard.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await teamCard.playAction({ skipAnimation: true });

    // Assert: 200 with no current step, and the card has gone invisible.
    expect(answer, 'playing past the last step must take the card off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPanelOpacity(teamCard), 'the card must be off screen once taken off').toBe('0');
  });
});

describe('updateAction', () => {
  it('changes what the update names on air and keeps the rest', async () => {
    // Arrange: car 7 on air.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
    await teamCard.playAction({ skipAnimation: true });

    // Act: the Cadastros correct the city; only the city is sent.
    const answer = await teamCard.updateAction({ data: { city: 'Niterói' } });

    // Assert: 200, the new place line is drawn, the team is unchanged.
    expect(answer, 'a good update must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(teamCard, 'team-card-place-line'), 'the new city must show').toBe(
      'Niterói · RJ',
    );
    expect(
      readShownText(teamCard, 'team-card-team-name'),
      'the team must survive a partial update',
    ).toBe('Reptiles Baja PUC-Rio');
  });

  it('adds a logo on air in the same card element, which stays on air', async () => {
    // Arrange: car 7 on air without a logo, its card element noted.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
    await teamCard.playAction({ skipAnimation: true });
    const cardBefore = findPartOfTeamCard(teamCard, 'team-card-panel');

    // Act: the operator uploads the team's logo and ticks the plate.
    const answer = await teamCard.updateAction({
      data: { logoUrl: '/media/5d1e9a40-logo-reptiles', logoOnLightPlate: true },
    });

    // Assert: 200, the logo is drawn on its plate, in the same card, still on air.
    expect(answer, 'adding a logo must answer 200').toEqual({ statusCode: 200 });
    expect(findPartOfTeamCard(teamCard, 'team-card-logo'), 'the logo must be drawn').toBeDefined();
    expect(
      findPartOfTeamCard(teamCard, 'team-card-logo-cell')?.classList.contains(
        'team-logo-cell--on-light-plate',
      ),
      'the logo must sit on its plate',
    ).toBe(true);
    expect(findPartOfTeamCard(teamCard, 'team-card-panel'), 'the card must not be rebuilt').toBe(
      cardBefore,
    );
    expect(readPanelOpacity(teamCard), 'an update must not take the card off air').toBe('1');
  });

  it('answers 400 to a bad update and keeps showing the previous data', async () => {
    // Arrange: car 7 on air.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
    await teamCard.playAction({ skipAnimation: true });

    // Act: send an update with a car number of 0.
    const answer = await teamCard.updateAction({ data: { carNumber: 0 } });

    // Assert: a 400 naming the field, and car 7 is still shown.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "carNumber".',
    });
    expect(
      readShownText(teamCard, 'team-card-car-number'),
      'a refused update must leave car 7 on air',
    ).toBe('7');
  });
});

describe('dispose', () => {
  it('kills a running play-in and answers the pending play with 409, because the card was disposed', async () => {
    // Arrange: a loaded team card whose play-in is still running when dispose comes. A
    // 400 ms in is placed on the card itself, so the animation really takes time here.
    const teamCard = createTeamCardOnThePage();
    await loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());
    const panel = findPartOfTeamCard(teamCard, 'team-card-panel');
    panel?.style.setProperty('--motion-in', '400ms');
    const pendingPlay = teamCard.playAction({});

    // Act: dispose in the middle of the animation.
    await teamCard.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play promise settled with "already disposed", and no tween is left.
    expect(
      playAnswer,
      'a play cut short by dispose must resolve with 409 (already disposed), never hang',
    ).toEqual({
      statusCode: 409,
      statusMessage: 'O cartão de equipe já foi descartado (dispose).',
    });
    expect(gsap.getTweensOf(panel ?? []), 'dispose must kill every tween on the card').toEqual([]);
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a team card whose load has started but not yet finished (it waits for the
    // first render and the font).
    const teamCard = createTeamCardOnThePage();
    const pendingLoad = loadTeamCardWithData(teamCard, createReptilesTeamCardDataWithoutMedia());

    // Act: dispose before load finishes, then let load finish and try to play.
    await teamCard.dispose();
    const loadAnswer = await pendingLoad;
    const playAnswer = await teamCard.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the graphic refuses to come back on air.
    const alreadyDisposedAnswer = {
      statusCode: 409,
      statusMessage: 'O cartão de equipe já foi descartado (dispose).',
    };
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed graphic must never play again').toEqual(alreadyDisposedAnswer);
  });
});
