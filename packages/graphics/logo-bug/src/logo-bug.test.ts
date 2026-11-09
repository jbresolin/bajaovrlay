/**
 * The logo bug web component: load, play, update, stop and dispose
 * (packages/graphics/logo-bug)
 *
 * What this module is for:
 *   logo-bug.ts is the OGraf graphic itself, the smallest in the catalogue: one image in the
 *   corner the item picks. It wires the model, the view and the fade together, in the team
 *   card's lifecycle (load once, play in, stop out, update in place, every call answers a
 *   status, never throws).
 *
 * What these tests prove:
 *   - load draws the logo off air and answers 200; data without the image answers 400.
 *   - Until the image has arrived it is not shown, so a slow file never flashes half drawn.
 *   - play fades the logo in at step 0 and nothing moves while it is up (no pulse, no
 *     cycling); stop fades it out; play while on air takes it off.
 *   - updateAction moves the logo to another corner, or changes its height or opacity, in
 *     the same panel, still on air, without waiting for an image it already has.
 *   - Calls at the wrong moment answer 409 or 404 with a pt-BR message, never throw.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering, the corner on screen and timing; jsdom draws nothing and loads no
 *     image (the tests fire the image's events), and no theme token is on the page, so
 *     every timeline lasts 0 ms. e2e/ runs the built graphic in Chromium.
 *   - An image that fails, a new image while the old one is up, and fetching again;
 *     logoBugImages.test.ts covers them.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createChannelLogoData,
  createLogoBugOnThePage,
  findPartOfLogoBug,
  letTheLogoLoad,
  letThePageCatchUp,
  loadLogoBugAndItsLogo,
  loadLogoBugWithData,
  readPanelOpacity,
} from './logoBugOnThePage.testSupport.js';

const alreadyDisposedAnswer = {
  statusCode: 409,
  statusMessage: 'O logo já foi descartado (dispose).',
};

describe('load', () => {
  it('draws the logo off air and answers 200', async () => {
    // Arrange: a logo bug on the page, never loaded.
    const logoBug = createLogoBugOnThePage();

    // Act: load it with the channel's logo, and let the file arrive.
    const answer = await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());

    // Assert: 200, the image is drawn from the address, and the panel waits invisible.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(
      findPartOfLogoBug(logoBug, 'logo-bug-image')?.getAttribute('src'),
      'the image must be drawn from the media address',
    ).toBe('/media/3b8f0c2e-logo-baja-sae-brasil');
    expect(readPanelOpacity(logoBug), 'a loaded logo must stay off screen until play').toBe('0');
  });

  it('answers 400 to data without the image, as the seeded item has before a file is picked', async () => {
    // Arrange: a logo bug on the page.
    const logoBug = createLogoBugOnThePage();

    // Act: load it with no data at all.
    const answer = await loadLogoBugWithData(logoBug, {});

    // Assert: a 400 naming the missing field.
    expect(answer, 'data without the image must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "logoUrl".',
    });
  });

  it('hides the image until it has arrived, so a slow file never flashes half drawn', async () => {
    // Arrange: a logo bug whose load has started; the file has not arrived yet.
    const logoBug = createLogoBugOnThePage();
    const pendingLoad = loadLogoBugWithData(logoBug, createChannelLogoData());
    await letThePageCatchUp();
    const imageStateWhileWaiting = findPartOfLogoBug(logoBug, 'logo-bug-image')?.dataset.imageState;

    // Act: the file arrives.
    letTheLogoLoad(logoBug);
    await pendingLoad;

    // Assert: waiting (hidden by the styles) before, loaded (shown) after.
    expect(imageStateWhileWaiting, 'an image not yet arrived must be marked waiting').toBe(
      'waiting',
    );
    expect(
      findPartOfLogoBug(logoBug, 'logo-bug-image')?.dataset.imageState,
      'an arrived image must be marked loaded',
    ).toBe('loaded');
  });
});

describe('playing and stopping', () => {
  it('fades the logo in at step 0, and nothing moves while it is up', async () => {
    // Arrange: a loaded logo bug.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());

    // Act: play it.
    const answer = await logoBug.playAction({ skipAnimation: true });

    // Assert: step 0, visible, and no tween left on the panel: no pulse, no cycling.
    expect(answer, 'play must answer 200 with step 0 on air').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(readPanelOpacity(logoBug), 'the logo must be visible on air').toBe('1');
    const panel = findPartOfLogoBug(logoBug, 'logo-bug-panel');
    expect(gsap.getTweensOf(panel ?? []), 'nothing may keep moving on air').toEqual([]);
  });

  it('fades the logo out on stopAction', async () => {
    // Arrange: the logo on air.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());
    await logoBug.playAction({ skipAnimation: true });

    // Act: the operator takes it off.
    const answer = await logoBug.stopAction({ skipAnimation: true });

    // Assert: 200 and invisible.
    expect(answer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(readPanelOpacity(logoBug), 'the logo must be off screen once stopped').toBe('0');
  });

  it('takes the logo off air when playAction comes while it is already on air', async () => {
    // Arrange: the logo on air at its only step.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());
    await logoBug.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await logoBug.playAction({ skipAnimation: true });

    // Assert: no current step, and invisible.
    expect(answer, 'playing past the last step must take the logo off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPanelOpacity(logoBug), 'the logo must be off screen once taken off').toBe('0');
  });
});

describe('updateAction', () => {
  it('moves the logo to another corner and resizes it in the same panel, still on air', async () => {
    // Arrange: the channel's logo on air bottom-right, its panel noted.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());
    await logoBug.playAction({ skipAnimation: true });
    const panelBefore = findPartOfLogoBug(logoBug, 'logo-bug-panel');

    // Act: the operator moves it top-left, smaller and half transparent; no file to wait for.
    const answer = await logoBug.updateAction({
      data: { corner: 'top-left', heightPx: 48, opacityPercent: 50 },
    });

    // Assert: 200, the panel on the top-left safe edges, the image 48 px high at half
    // opacity, in the same panel, still on air.
    const panel = findPartOfLogoBug(logoBug, 'logo-bug-panel');
    const image = findPartOfLogoBug(logoBug, 'logo-bug-image');
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(
      { top: panel?.style.top, left: panel?.style.left, right: panel?.style.right },
      'the panel must sit on the top-left safe edges',
    ).toEqual({ top: 'var(--stage-safe-top)', left: 'var(--stage-safe-side)', right: 'auto' });
    expect(
      { height: image?.style.height, opacity: image?.style.opacity },
      'the image must take the new height and opacity',
    ).toEqual({ height: '48px', opacity: '0.5' });
    expect(panel, 'the panel must not be rebuilt').toBe(panelBefore);
    expect(readPanelOpacity(logoBug), 'an update must not take the logo off air').toBe('1');
  });

  it('answers 400 to a bad update and keeps showing the logo as it was', async () => {
    // Arrange: the logo on air.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());
    await logoBug.playAction({ skipAnimation: true });

    // Act: an update with a height past the limit.
    const answer = await logoBug.updateAction({ data: { heightPx: 400 } });

    // Assert: a 400 naming the field, and the default 80 px still drawn.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "heightPx".',
    });
    expect(
      findPartOfLogoBug(logoBug, 'logo-bug-image')?.style.height,
      'a refused update must leave the logo as it was',
    ).toBe('80px');
  });
});

describe('calls made at the wrong moment', () => {
  it('answers 409 to playAction before load', async () => {
    // Arrange: a logo bug that was never loaded.
    const logoBug = createLogoBugOnThePage();

    // Act: play it.
    const answer = await logoBug.playAction({});

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'play before load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'O logo ainda não foi carregado (load).',
    });
  });

  it('answers 409 to a second load, so a loaded logo is never half reset', async () => {
    // Arrange: a logo bug already loaded.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());

    // Act: load it again.
    const answer = await loadLogoBugWithData(logoBug, createChannelLogoData());

    // Assert: a 409.
    expect(answer, 'a second load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'O logo já foi carregado (load); crie outro para novos dados.',
    });
  });

  it('answers 404 to any customAction, because the logo has none', async () => {
    // Arrange: the logo on air.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());

    // Act: ask it to pulse, which the brief rules out.
    const answer = await logoBug.customAction({ id: 'pulsar', payload: {} });

    // Assert: a 404 naming the action.
    expect(answer, 'an unknown custom action must answer 404').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "pulsar". O logo não tem ações personalizadas.',
    });
  });

  it('answers 409 to play and update after dispose, and stays disposed if dispose came during load', async () => {
    // Arrange: a logo bug whose load has started, then disposed before it ends.
    const logoBug = createLogoBugOnThePage();
    const pendingLoad = loadLogoBugWithData(logoBug, createChannelLogoData());
    await logoBug.dispose();
    await letThePageCatchUp();
    letTheLogoLoad(logoBug);

    // Act: let load finish, then try to play and to update.
    const loadAnswer = await pendingLoad;
    const playAnswer = await logoBug.playAction({ skipAnimation: true });
    const updateAnswer = await logoBug.updateAction({ data: { corner: 'top-left' } });

    // Assert: every answer is "already disposed".
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed logo must never play again').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'a disposed logo must refuse updates').toEqual(alreadyDisposedAnswer);
  });
});
