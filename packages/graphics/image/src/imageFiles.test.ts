/**
 * The image graphic's files: a failed file, a new file while the old one is up, and
 * fetching again (packages/graphics/image)
 *
 * What this module is for:
 *   The graphic shows one file from the media store, which can be missing, broken or
 *   still uploading. image.ts and imageFileFetches.ts keep the picture on screen while a
 *   new file is fetched hidden, answer 422 when a file fails, and fetch a failed file
 *   again. A failure must never blank what is on air (the architecture's rule 4), and a
 *   file that never arrived must draw nothing at all (the brief).
 *
 * What these tests prove:
 *   - A file that fails at load leaves the graphic empty (no picture element, so never a
 *     broken-image icon, and no coloured frame either, even with a background chosen) and
 *     answers 422 with a pt-BR message naming the address.
 *   - A new file is fetched hidden while the old picture stays on screen; once it arrives
 *     that same element is shown and the old one goes. A new file that fails answers 422
 *     and leaves the old picture up.
 *   - A failed file is fetched again on the next update, even at the same address. An
 *     update that only moves a failed image answers 200, not 422 again.
 *
 * What these tests deliberately do not cover:
 *   - That Chromium really asks for the file again, and what an empty graphic looks like;
 *     the logo bug's e2e tests prove the same rule on the same code, and this graphic's
 *     e2e test checks the 422 of a missing file in Chromium.
 *   - The 2 s most that a call waits for a file; jsdom loads no file, so the tests fire
 *     the picture's events themselves, and the wait itself is the kit's constant.
 */
import { describe, expect, it } from 'vitest';

import {
  countPictures,
  createEventPosterData,
  createImageGraphicOnThePage,
  deletedImageAddress,
  findPartOfImageGraphic,
  findThePictureOnItsWay,
  findTheShownPicture,
  letTheFileFail,
  letTheFileLoad,
  letThePageCatchUp,
  loadImageGraphicAndItsFile,
  loadImageGraphicWithAFailedFile,
  loadImageGraphicWithData,
} from './imageOnThePage.testSupport.js';

describe('a file that fails to load', () => {
  it('leaves the graphic empty and answers 422 naming the address, at load', async () => {
    // Arrange: an image graphic on the page, about to load an address whose file is gone.
    const image = createImageGraphicOnThePage();

    // Act: load it, and the browser reports the file as broken.
    const answer = await loadImageGraphicWithAFailedFile(image);

    // Assert: a 422 saying so, and no picture element left to show a broken-image icon.
    expect(answer, 'a broken file must answer 422 with a pt-BR message').toEqual({
      statusCode: 422,
      statusMessage:
        'O arquivo da imagem não carregou (/media/8b3f0d52-cartaz-apagado); nada aparece na tela. Escolha outra imagem.',
    });
    expect(countPictures(image), 'a broken file must leave the graphic empty').toBe(0);
  });

  it('draws no coloured frame when the file fails, even with a background chosen', async () => {
    // Arrange: an image graphic on the page, with a dark plate and a margin asked for.
    const image = createImageGraphicOnThePage();
    const pendingLoad = loadImageGraphicWithData(image, {
      imageUrl: deletedImageAddress,
      backgroundColor: '#0a0a0a',
      marginPx: 12,
    });
    await letThePageCatchUp();

    // Act: the browser reports the file as broken.
    letTheFileFail(image);
    await pendingLoad;

    // Assert: the frame has no colour and no margin, so nothing at all is drawn.
    const frame = findPartOfImageGraphic(image, 'image-frame');
    expect(
      {
        background: frame?.style.getPropertyValue('background-color'),
        padding: frame?.style.padding,
      },
      'with no picture there must be no coloured square either',
    ).toEqual({ background: '', padding: '' });
  });

  it('keeps the old picture on screen and answers 422 when an update on air brings a broken file', async () => {
    // Arrange: the poster on air.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());
    await image.playAction({ skipAnimation: true });

    // Act: the operator picks a file that turns out to be broken.
    const pendingUpdate = image.updateAction({ data: { imageUrl: deletedImageAddress } });
    await letThePageCatchUp();
    letTheFileFail(image);
    const answer = await pendingUpdate;

    // Assert: a 422 naming the new address, and the old picture still up, alone.
    expect(answer, 'a broken file on update must answer 422').toEqual({
      statusCode: 422,
      statusMessage:
        'O arquivo da imagem não carregou (/media/8b3f0d52-cartaz-apagado); a imagem anterior continua na tela. Escolha outra imagem.',
    });
    expect(
      findTheShownPicture(image)?.getAttribute('src'),
      'a failure must never blank what is on air: the old picture stays',
    ).toBe(createEventPosterData().imageUrl);
    expect(countPictures(image), 'the broken file must leave no element behind').toBe(1);
  });

  it('keeps the old picture on screen until the new one has arrived, then shows that same element', async () => {
    // Arrange: the poster on air, and an update to the sponsor's banner started.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicAndItsFile(image, createEventPosterData());
    await image.playAction({ skipAnimation: true });
    const pendingUpdate = image.updateAction({
      data: { imageUrl: '/media/6d0c3f18-faixa-patrocinador-serra-azul' },
    });
    await letThePageCatchUp();
    const shownWhileWaiting = findTheShownPicture(image)?.getAttribute('src');
    const newPictureOnItsWay = findThePictureOnItsWay(image);

    // Act: the new file arrives.
    letTheFileLoad(image);
    const answer = await pendingUpdate;

    // Assert: the old picture was shown meanwhile; now the element that fetched the new
    // file (nothing loaded twice) is the only one.
    expect(shownWhileWaiting, 'the old picture must stay up while the new one is on its way').toBe(
      createEventPosterData().imageUrl,
    );
    expect(answer, 'a good file must answer 200').toEqual({ statusCode: 200 });
    expect(findTheShownPicture(image), 'the element that fetched the file must be shown').toBe(
      newPictureOnItsWay,
    );
    expect(countPictures(image), 'the old picture must be gone once the new one is up').toBe(1);
  });

  it('tries the same address again on an update, and shows it once the file is back', async () => {
    // Arrange: an image graphic whose file failed (it was still uploading, say).
    const image = createImageGraphicOnThePage();
    await loadImageGraphicWithAFailedFile(image);

    // Act: an update with the very same address, and this time the file arrives.
    const pendingUpdate = image.updateAction({ data: { imageUrl: deletedImageAddress } });
    await letThePageCatchUp();
    const isTriedAgain = findThePictureOnItsWay(image) !== undefined;
    letTheFileLoad(image);
    const answer = await pendingUpdate;

    // Assert: fetched again, shown, and 200.
    expect(isTriedAgain, 'a failed file must be fetched again, even at the same address').toBe(
      true,
    );
    expect(answer, 'the file that arrived must answer 200').toEqual({ statusCode: 200 });
    expect(findTheShownPicture(image)?.getAttribute('src'), 'the picture must be shown').toBe(
      deletedImageAddress,
    );
  });

  it('answers 200, not 422 again, to an update that only moves a failed image', async () => {
    // Arrange: an image graphic whose file failed; the operator was told so at load.
    const image = createImageGraphicOnThePage();
    await loadImageGraphicWithAFailedFile(image);

    // Act: move it to the top-right; the file fails again.
    const pendingUpdate = image.updateAction({ data: { position: 'top-right' } });
    await letThePageCatchUp();
    letTheFileFail(image);
    const answer = await pendingUpdate;

    // Assert: 200 for the move, which did happen; still nothing drawn.
    expect(answer, 'the move must not be refused for a file it did not change').toEqual({
      statusCode: 200,
    });
    expect(
      findPartOfImageGraphic(image, 'image-box')?.style.right,
      'the empty box must have moved to the right edge',
    ).toBe('0px');
    expect(countPictures(image), 'the file that failed again must leave nothing').toBe(0);
  });
});
