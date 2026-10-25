/**
 * The sponsor bug web component: load, play, update, stop and dispose
 * (packages/graphics/sponsor-bug)
 *
 * What this module is for:
 *   sponsor-bug.ts is the OGraf graphic itself: a web component the renderer loads,
 *   plays, updates, stops and disposes. It wires the model, the view, the image wait and
 *   the animations together; each of those has its own tests.
 *
 * What these tests prove:
 *   - load draws the data off air and answers 200; bad data answers 400 naming the field.
 *   - load waits for the mark and the sponsor's logo, so play brings them in with the
 *     card; a broken logo ends that wait like a loaded one.
 *   - Calls made at the wrong moment (play or update before load, a second load, anything
 *     after dispose, a custom action it does not have) answer a 4xx status with a pt-BR
 *     message instead of throwing, as OGraf asks. Stop before play is harmless.
 *   - play brings the card on air and reports step 0, and nothing moves while it is up
 *     (it never pulses or cycles); play while on air takes it off; stop takes it off.
 *   - updateAction merges partial data on air or off and redraws in place: a sponsor
 *     added on air appears in the same card element, which stays on air; a bad update
 *     answers 400 and leaves the card as it was.
 *   - dispose ends a running play-in: the pending play resolves with 409 instead of
 *     hanging, and a dispose that lands while load is still waiting is not undone.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering, fonts, images and timing; jsdom draws nothing, loads no image (the
 *     image test fires the images' events by hand) and has no `document.fonts`, and no
 *     theme token is on the page, so every timeline lasts 0 ms. The Playwright suites in
 *     e2e/ run the built component in Chromium for the lifecycle and the screenshots.
 *   - Which parts each combination shows; sponsorBugView.test.ts covers that.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createEnduroBugDataWithoutSponsor,
  createEnduroBugDataWithSponsor,
  createSponsorBugOnThePage,
  findPartOfSponsorBug,
  loadSponsorBugWithData,
  readPanelOpacity,
  readShownText,
} from './sponsorBugOnThePage.testSupport.js';

const alreadyDisposedAnswer = {
  statusCode: 409,
  statusMessage: 'O bug já foi descartado (dispose).',
};

/** Lets the pending promise callbacks and timers of the page run once. */
function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Lets every image of the bug settle, as a page with the files would: jsdom loads no
 * image, so each one's load event is fired by hand.
 */
function letEveryImageOfTheBugLoad(sponsorBug: HTMLElement): void {
  for (const image of sponsorBug.shadowRoot?.querySelectorAll('img') ?? []) {
    image.dispatchEvent(new Event('load'));
  }
}

/** Loads a bug and lets its images load, so the test can go on to play it. */
async function loadSponsorBugAndItsImages(
  sponsorBug: ReturnType<typeof createSponsorBugOnThePage>,
  data: unknown,
) {
  const pendingLoad = loadSponsorBugWithData(sponsorBug, data);
  await letThePageCatchUp();
  letEveryImageOfTheBugLoad(sponsorBug);
  return pendingLoad;
}

describe('load', () => {
  it('draws the data off air and answers 200', async () => {
    // Arrange: a sponsor bug on the page, never loaded.
    const sponsorBug = createSponsorBugOnThePage();

    // Act: load it with the enduro's word and no sponsor.
    const answer = await loadSponsorBugAndItsImages(
      sponsorBug,
      createEnduroBugDataWithoutSponsor(),
    );

    // Assert: 200, the word is drawn, and the card waits invisible for play.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(sponsorBug, 'sponsor-bug-event-word'), 'the word must be drawn').toBe(
      'ENDURO',
    );
    expect(readPanelOpacity(sponsorBug), 'a loaded card must stay off screen until play').toBe('0');
  });

  it('answers 400 with a pt-BR message naming the bad field', async () => {
    // Arrange: a sponsor bug and data whose plate is a word.
    const sponsorBug = createSponsorBugOnThePage();

    // Act: load it with that data.
    const answer = await loadSponsorBugWithData(sponsorBug, {
      ...createEnduroBugDataWithSponsor(),
      sponsorLogoOnLightPlate: 'sim',
    });

    // Assert: a 400 naming the field.
    expect(answer, 'bad data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "sponsorLogoOnLightPlate".',
    });
  });

  it('waits for the sponsor’s logo, and a broken logo ends the wait like a loaded one', async () => {
    // Arrange: a sponsor bug loading the enduro's bug with its sponsor.
    const sponsorBug = createSponsorBugOnThePage();
    const answers: unknown[] = [];
    const pendingLoad = loadSponsorBugWithData(sponsorBug, createEnduroBugDataWithSponsor());
    void pendingLoad.then((answer) => answers.push(answer));
    await letThePageCatchUp();
    const hadAnsweredBeforeTheImages = answers.length > 0;

    // Act: the mark arrives and the sponsor's logo address turns out to be broken.
    findPartOfSponsorBug(sponsorBug, 'sponsor-bug-mark')?.dispatchEvent(new Event('load'));
    findPartOfSponsorBug(sponsorBug, 'sponsor-bug-sponsor-logo')?.dispatchEvent(new Event('error'));
    const answer = await pendingLoad;

    // Assert: load held for the images, then answered 200 despite the broken logo.
    expect(hadAnsweredBeforeTheImages, 'load must wait for the bug’s images').toBe(false);
    expect(answer, 'a broken logo must never keep the bug from loading').toEqual({
      statusCode: 200,
    });
  });
});

describe('calls made at the wrong moment', () => {
  const callsBeforeLoad = [
    // A renderer that skipped load and played straight away.
    { name: 'answers 409 to playAction before load', call: 'play' },
    // An update that arrives before the renderer has loaded the bug.
    { name: 'answers 409 to updateAction before load', call: 'update' },
  ] as const;

  it.each(callsBeforeLoad)('$name', async ({ call }) => {
    // Arrange: a sponsor bug on the page that was never loaded.
    const sponsorBug = createSponsorBugOnThePage();

    // Act: play it, or send it a new word.
    const answer =
      call === 'play'
        ? await sponsorBug.playAction({})
        : await sponsorBug.updateAction({ data: { eventWord: 'SUPER PRIME' } });

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'a call before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O bug ainda não foi carregado (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded bug that was never played.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());

    // Act: ask it to stop.
    const answer = await sponsorBug.stopAction({});

    // Assert: a plain 200; stopping something already off air is not an error.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load, so a loaded bug is never half reset', async () => {
    // Arrange: a bug already loaded with the enduro's word.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());

    // Act: load it again with another word.
    const answer = await loadSponsorBugWithData(sponsorBug, { eventWord: 'SUPER PRIME' });

    // Assert: a 409, and the enduro's word is still the one drawn.
    expect(answer, 'a second load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O bug já foi carregado (load); crie outro para novos dados.',
    });
    expect(
      readShownText(sponsorBug, 'sponsor-bug-event-word'),
      'a refused second load must leave the first data drawn',
    ).toBe('ENDURO');
  });

  it('answers 404 to any customAction, because the bug has none', async () => {
    // Arrange: a bug on air.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());
    await sponsorBug.playAction({ skipAnimation: true });

    // Act: ask for the next sponsor, which is the corner roll's job.
    const answer = await sponsorBug.customAction({ id: 'proximo-patrocinador', payload: {} });

    // Assert: a 404 naming the unknown action in pt-BR.
    expect(answer, 'an unknown custom action must answer 404 with a pt-BR message').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "proximo-patrocinador". O bug não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a bug that was loaded, played and then disposed.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());
    await sponsorBug.playAction({ skipAnimation: true });
    await sponsorBug.dispose();

    // Act: try to play it and to change its word.
    const playAnswer = await sponsorBug.playAction({ skipAnimation: true });
    const updateAnswer = await sponsorBug.updateAction({ data: { eventWord: 'SUPER PRIME' } });

    // Assert: both answer "already disposed".
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });
});

describe('playing and stopping', () => {
  it('brings the card on air at step 0, and nothing moves while it is up', async () => {
    // Arrange: a loaded bug with its sponsor.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithSponsor());

    // Act: play it.
    const answer = await sponsorBug.playAction({ skipAnimation: true });

    // Assert: step 0 is on air, the card is visible, and no tween is left on it: the bug
    // never pulses or cycles while it is up.
    expect(answer, 'play must answer 200 with step 0 on air').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(readPanelOpacity(sponsorBug), 'the card must be visible on air').toBe('1');
    const panel = findPartOfSponsorBug(sponsorBug, 'sponsor-bug-panel');
    expect(gsap.getTweensOf(panel ?? []), 'nothing may keep moving on air').toEqual([]);
  });

  it('takes the card off air on stopAction', async () => {
    // Arrange: a bug on air.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());
    await sponsorBug.playAction({ skipAnimation: true });

    // Act: the operator takes it off.
    const answer = await sponsorBug.stopAction({ skipAnimation: true });

    // Assert: 200, and the card is invisible.
    expect(answer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(readPanelOpacity(sponsorBug), 'the card must be off screen once stopped').toBe('0');
  });

  it('takes the card off air when playAction comes while it is already on air', async () => {
    // Arrange: a bug on air at its only step, step 0.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());
    await sponsorBug.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await sponsorBug.playAction({ skipAnimation: true });

    // Assert: 200 with no current step, and the card has gone invisible.
    expect(answer, 'playing past the last step must take the card off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPanelOpacity(sponsorBug), 'the card must be off screen once taken off').toBe('0');
  });
});

describe('updateAction', () => {
  it('adds a sponsor on air in the same card element, which stays on air', async () => {
    // Arrange: the bug on air without a sponsor, its card element noted.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());
    await sponsorBug.playAction({ skipAnimation: true });
    const cardBefore = findPartOfSponsorBug(sponsorBug, 'sponsor-bug-panel');

    // Act: the operator reads the Diamante sponsor's logo and plate from Cadastros.
    const answer = await sponsorBug.updateAction({
      data: { sponsorLogoUrl: '/media/7d1e3a5c-logo-serra-azul', sponsorLogoOnLightPlate: true },
    });

    // Assert: 200, the caption and the logo are drawn, in the same card, still on air.
    expect(answer, 'adding a sponsor must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(sponsorBug, 'sponsor-bug-caption'), 'the caption must show').toBe(
      'Apresentado por',
    );
    expect(
      findPartOfSponsorBug(sponsorBug, 'sponsor-bug-sponsor-logo'),
      'the logo must be drawn',
    ).toBeDefined();
    expect(
      findPartOfSponsorBug(sponsorBug, 'sponsor-bug-panel'),
      'the card must not be rebuilt',
    ).toBe(cardBefore);
    expect(readPanelOpacity(sponsorBug), 'an update must not take the card off air').toBe('1');
  });

  it('answers 400 to a bad update and keeps showing the previous data', async () => {
    // Arrange: the bug on air.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());
    await sponsorBug.playAction({ skipAnimation: true });

    // Act: send an update whose word is a number.
    const answer = await sponsorBug.updateAction({ data: { eventWord: 2026 } });

    // Assert: a 400 naming the field, and the enduro's word is still shown.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "eventWord".',
    });
    expect(
      readShownText(sponsorBug, 'sponsor-bug-event-word'),
      'a refused update must leave the word on air',
    ).toBe('ENDURO');
  });
});

describe('dispose', () => {
  it('kills a running play-in and answers the pending play with 409, because the bug was disposed', async () => {
    // Arrange: a loaded bug whose play-in is still running when dispose comes. A 400 ms
    // in is placed on the card itself, so the animation really takes time here.
    const sponsorBug = createSponsorBugOnThePage();
    await loadSponsorBugAndItsImages(sponsorBug, createEnduroBugDataWithoutSponsor());
    const panel = findPartOfSponsorBug(sponsorBug, 'sponsor-bug-panel');
    panel?.style.setProperty('--motion-in', '400ms');
    const pendingPlay = sponsorBug.playAction({});

    // Act: dispose in the middle of the animation.
    await sponsorBug.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play promise settled with "already disposed", and no tween is left.
    expect(
      playAnswer,
      'a play cut short by dispose must resolve with 409 (already disposed), never hang',
    ).toEqual(alreadyDisposedAnswer);
    expect(gsap.getTweensOf(panel ?? []), 'dispose must kill every tween on the card').toEqual([]);
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a bug whose load has started but not yet finished (it waits for the first
    // render, the font and the mark).
    const sponsorBug = createSponsorBugOnThePage();
    const pendingLoad = loadSponsorBugWithData(sponsorBug, createEnduroBugDataWithoutSponsor());

    // Act: dispose before load finishes, then let load finish and try to play.
    await sponsorBug.dispose();
    await letThePageCatchUp();
    letEveryImageOfTheBugLoad(sponsorBug);
    const loadAnswer = await pendingLoad;
    const playAnswer = await sponsorBug.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the graphic refuses to come back on air.
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed graphic must never play again').toEqual(alreadyDisposedAnswer);
  });
});
