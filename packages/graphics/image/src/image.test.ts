/**
 * The image web component: load, play, update, stop and dispose (packages/graphics/image)
 *
 * What this module is for:
 *   image.ts is the OGraf graphic itself: one picture from the media store, sized and
 *   placed by hand. It wires the model, the view and the fade together, in the logo bug's
 *   lifecycle (load once, play in, stop out, update in place, every call answers a
 *   status, never throws).
 *
 * What these tests prove:
 *   - load draws the picture off air at the item's width (480 px by default, the height
 *     left to the file) and answers 200; data without the image answers 400.
 *   - With a height too, the picture is fitted inside the box (contain), never stretched.
 *   - play brings it in at step 0 and stop takes it out, leaving nothing moving; with
 *     "Entrada: Nenhuma" too, without the renderer asking to skip the animation.
 *   - updateAction moves and resizes the picture in the same box, still on air, with no
 *     entrance again; a bad update answers 400 and leaves it as it was.
 *   - "Fundo" and "Margem" dress the frame around the picture; with no background the
 *     frame is transparent.
 *   - Calls at the wrong moment answer 409 or 404 with a pt-BR message, never throw.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering and where the box lands; jsdom draws nothing and loads no file (the
 *     tests fire the picture's events), and no theme token is on the page, so every
 *     timeline lasts 0 ms. e2e/ runs the built graphic in Chromium and measures the box,
 *     and times the fade against the cut of "Entrada: Nenhuma".
 *   - A file that fails, a new file while the old one is up, and fetching again;
 *     imageFiles.test.ts covers them.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createEventPosterData,
  createImageGraphicOnThePage,
  findPartOfImageGraphic,
  findTheShownPicture,
  loadImageGraphicAndItsFile,
  loadImageGraphicWithData,
  readBoxOpacity,
} from './imageOnThePage.testSupport.js';

const alreadyDisposedAnswer = {
  statusCode: 409,
  statusMessage: 'A imagem já foi descartada (dispose).',
};

describe('load', () => {
  it('draws the picture off air at 480 px wide, the height left to the file, and answers 200', async () => {
    // Arrange: an image graphic on the page, never loaded.
    const image = createImageGraphicOnThePage();

    // Act: load it with the event's poster alone, and let the file arrive.
    const answer = await loadImageGraphicAndItsFile(image, createEventPosterData());

    // Assert: 200, the picture drawn from the address at the default width, the box invisible.
    const picture = findTheShownPicture(image);
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(picture?.getAttribute('src'), 'the picture must be drawn from the media address').toBe(
      '/media/4e2a91c7-cartaz-enduro-piracicaba',
    );
    expect(
      { width: picture?.style.width, height: picture?.style.height },
      'the default width, and the height left to the file’s proportions',
    ).toEqual({ width: '480px', height: 'auto' });
    expect(readBoxOpacity(image), 'a loaded picture must stay off screen until play').toBe('0');
  });

  it('fits the picture inside the box when both width and height are set, never stretching it', async () => {
    // Arrange: an image graphic on the page.
    const image = createImageGraphicOnThePage();

    // Act: load the poster into a 600x200 box at the bottom-left.
    await loadImageGraphicAndItsFile(image, {
      ...createEventPosterData(),
      widthPx: 600,
      heightPx: 200,
      position: 'bottom-left',
    });

    // Assert: the box's size, contained, pinned to the anchor's side.
    const picture = findTheShownPicture(image);
    expect(
      {
        width: picture?.style.width,
        height: picture?.style.height,
        fit: picture?.style.getPropertyValue('object-fit'),
        side: picture?.style.getPropertyValue('object-position'),
      },
      'the picture must fill the box as far as it can without stretching',
    ).toEqual({ width: '600px', height: '200px', fit: 'contain', side: 'left bottom' });
  });

  it('answers 400 to data without the image, as an item has before a file is picked', async () => {
    // Arrange: an image graphic on the page.
    const image = createImageGraphicOnThePage();

    // Act: load it with no data at all.
    const answer = await loadImageGraphicWithData(image, {});

    // Assert: a 400 naming the missing field, and nothing drawn.
    expect(answer, 'data without the image must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "imageUrl".',
    });
    expect(findTheShownPicture(image), 'no image means nothing drawn').toBeUndefined();
  });
});

describe('playing and stopping', () => {
  it('fades the picture in at step 0, and nothing moves while it is up', async () => {
    // Arrange: a loaded image with the default fade.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());

    // Act: play it.
    const answer = await image.playAction({ skipAnimation: true });

    // Assert: step 0, visible, and no tween left on the box.
    expect(answer, 'play must answer 200 with step 0 on air').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(readBoxOpacity(image), 'the picture must be visible on air').toBe('1');
    const box = findPartOfImageGraphic(image, 'image-box');
    expect(gsap.getTweensOf(box ?? []), 'nothing may keep moving on air').toEqual([]);
  });

  it('takes the picture out on stopAction', async () => {
    // Arrange: the picture on air.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());
    await image.playAction({ skipAnimation: true });

    // Act: the operator takes it off.
    const answer = await image.stopAction({ skipAnimation: true });

    // Assert: 200 and invisible.
    expect(answer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(readBoxOpacity(image), 'the picture must be off screen once stopped').toBe('0');
  });

  it('goes fully in and out with "Entrada: Nenhuma" when the renderer does not ask to skip', async () => {
    // Arrange: a loaded image whose entrance is none.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, { ...createEventPosterData(), entrance: 'none' });
    const box = findPartOfImageGraphic(image, 'image-box');

    // Act: play it and stop it with no skipAnimation, as a normal take and clear do.
    await image.playAction({});
    const opacityOnAir = readBoxOpacity(image);
    await image.stopAction({});

    // Assert: fully in, then fully out, with no tween left on the box at any point.
    expect(opacityOnAir, 'a cut must put the picture fully on air at once').toBe('1');
    expect(readBoxOpacity(image), 'a cut must take the picture fully off at once').toBe('0');
    expect(gsap.getTweensOf(box ?? []), 'a cut must leave no tween behind').toEqual([]);
  });

  it('takes the picture off air when playAction comes while it is already on air', async () => {
    // Arrange: the picture on air at its only step.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());
    await image.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await image.playAction({ skipAnimation: true });

    // Assert: no current step, and invisible.
    expect(answer, 'playing past the last step must take the picture off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readBoxOpacity(image), 'the picture must be off screen once taken off').toBe('0');
  });
});

describe('updateAction', () => {
  it('moves and resizes the picture in the same box, still on air, with no entrance again', async () => {
    // Arrange: the poster on air in the centre, its box and picture noted.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());
    await image.playAction({ skipAnimation: true });
    const boxBefore = findPartOfImageGraphic(image, 'image-box');
    const pictureBefore = findTheShownPicture(image);

    // Act: the operator moves it to the top-left, 40 px in and 30 px down, 320 px wide.
    const answer = await image.updateAction({
      data: { position: 'top-left', offsetXPx: 40, offsetYPx: 30, widthPx: 320 },
    });

    // Assert: 200, the box on its new point, the new width, the same elements, still on air.
    const box = findPartOfImageGraphic(image, 'image-box');
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(
      { top: box?.style.top, left: box?.style.left, right: box?.style.right },
      'the box must sit 40 px in and 30 px down from the top-left corner',
    ).toEqual({ top: '30px', left: '40px', right: 'auto' });
    expect(findTheShownPicture(image)?.style.width, 'the picture must take the new width').toBe(
      '320px',
    );
    expect(box, 'the box must not be rebuilt').toBe(boxBefore);
    expect(findTheShownPicture(image), 'the picture must not be fetched again').toBe(pictureBefore);
    expect(readBoxOpacity(image), 'an update must not take the picture off air').toBe('1');
  });

  it('answers 400 to a bad update and keeps showing the picture as it was', async () => {
    // Arrange: the poster on air.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());
    await image.playAction({ skipAnimation: true });

    // Act: an update with a width past the limit.
    const answer = await image.updateAction({ data: { widthPx: 5000 } });

    // Assert: a 400 naming the field, and the default 480 px still drawn.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "widthPx".',
    });
    expect(
      findTheShownPicture(image)?.style.width,
      'a refused update must leave the picture as it was',
    ).toBe('480px');
  });
});

describe('the background and the margin', () => {
  it('dresses the frame with the colour, the margin and the opacity around the picture', async () => {
    // Arrange: an image graphic on the page.
    const image = createImageGraphicOnThePage();

    // Act: load a sponsor's logo on a dark plate, 12 px of margin, at 85%.
    await loadImageGraphicAndItsFile(image, {
      ...createEventPosterData(),
      backgroundColor: '#0a0a0a',
      marginPx: 12,
      opacityPercent: 85,
    });

    // Assert: the frame carries the three, so the plate fades with its picture.
    const frame = findPartOfImageGraphic(image, 'image-frame');
    expect(
      {
        background: frame?.style.getPropertyValue('background-color'),
        padding: frame?.style.padding,
        opacity: frame?.style.opacity,
      },
      'the frame must be the colour, the margin and the opacity the item asks for',
    ).toEqual({ background: 'rgb(10, 10, 10)', padding: '12px', opacity: '0.85' });
  });

  it('leaves the frame transparent when no background is chosen', async () => {
    // Arrange: an image graphic on the page.
    const image = createImageGraphicOnThePage();

    // Act: load the poster alone.
    await loadImageGraphicAndItsFile(image, createEventPosterData());

    // Assert: no colour and no margin around the picture.
    const frame = findPartOfImageGraphic(image, 'image-frame');
    expect(
      {
        background: frame?.style.getPropertyValue('background-color'),
        padding: frame?.style.padding,
      },
      'no background means the picture sits straight on the video',
    ).toEqual({ background: 'transparent', padding: '0px' });
  });

  it('takes the background away on air when an update clears it', async () => {
    // Arrange: the logo on its dark plate, on air.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, {
      ...createEventPosterData(),
      backgroundColor: '#0a0a0a',
    });
    await image.playAction({ skipAnimation: true });

    // Act: the operator clears "Fundo"; the renderer sends it as undefined.
    const answer = await image.updateAction({ data: { backgroundColor: undefined } });

    // Assert: 200 and a transparent frame.
    expect(answer, 'clearing the background must answer 200').toEqual({ statusCode: 200 });
    expect(
      findPartOfImageGraphic(image, 'image-frame')?.style.getPropertyValue('background-color'),
      'a cleared background must leave the frame transparent',
    ).toBe('transparent');
  });
});

describe('calls made at the wrong moment', () => {
  it('answers 409 to playAction before load', async () => {
    // Arrange: an image graphic that was never loaded.
    const image = createImageGraphicOnThePage();

    // Act: play it.
    const answer = await image.playAction({});

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'play before load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'A imagem ainda não foi carregada (load).',
    });
  });

  it('answers 409 to a second load, so a loaded image is never half reset', async () => {
    // Arrange: an image graphic already loaded.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());

    // Act: load it again.
    const answer = await loadImageGraphicWithData(image, createEventPosterData());

    // Assert: a 409.
    expect(answer, 'a second load must answer 409').toEqual({
      statusCode: 409,
      statusMessage: 'A imagem já foi carregada (load); crie outra para novos dados.',
    });
  });

  it('answers 404 to any customAction, because the image has none', async () => {
    // Arrange: the picture on air.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());

    // Act: ask it to spin.
    const answer = await image.customAction({ id: 'girar', payload: {} });

    // Assert: a 404 naming the action.
    expect(answer, 'an unknown custom action must answer 404').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "girar". A imagem não tem ações personalizadas.',
    });
  });

  it('answers 409 to play and update after dispose', async () => {
    // Arrange: a loaded image, then disposed.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());
    await image.dispose();

    // Act: try to play and to update.
    const playAnswer = await image.playAction({ skipAnimation: true });
    const updateAnswer = await image.updateAction({ data: { position: 'top-left' } });

    // Assert: every answer is "already disposed".
    expect(playAnswer, 'a disposed image must never play again').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'a disposed image must refuse updates').toEqual(alreadyDisposedAnswer);
  });
});
