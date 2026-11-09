/**
 * The logo bug's images: a failed file, a new file while the old one is up, and fetching
 * again (packages/graphics/logo-bug)
 *
 * What this module is for:
 *   The channel logo shows one file from the media store, which can be missing, broken or
 *   still uploading. logo-bug.ts and logoImageFetches.ts keep the logo on screen while a
 *   new file is fetched hidden, answer 422 when a file fails, and fetch a failed file
 *   again. A failure must never blank what is on air (the architecture's rule 4).
 *
 * What these tests prove:
 *   - An image that fails at load leaves the graphic empty (no image element, so never a
 *     broken-image icon) and answers 422 with a pt-BR message naming the address.
 *   - A new image is fetched hidden while the old logo stays on screen; once it arrives
 *     that same element is shown and the old one goes. A new image that fails answers
 *     422 and leaves the old logo up.
 *   - A failed image is fetched again on the next update, even at the same address, and a
 *     later good image fills the corner again. An update that only moves or resizes a
 *     failed logo answers 200, not 422 again: the operator was already told.
 *
 * What these tests deliberately do not cover:
 *   - That Chromium really asks for the file a second time; e2e/logoBugLifecycle.e2e.ts.
 *   - What the corner looks like with a missing file; e2e/logoBugScreenshots.e2e.ts.
 *   - The 2 s most that a call waits for a file; jsdom loads no image, so the tests fire
 *     the image's events themselves, and the wait itself is the kit's constant.
 */
import { describe, expect, it } from 'vitest';

import {
  countLogoImages,
  createChannelLogoData,
  createLogoBugOnThePage,
  deletedLogoAddress,
  findPartOfLogoBug,
  findTheLogoOnItsWay,
  findTheShownLogo,
  letTheLogoFail,
  letTheLogoLoad,
  letThePageCatchUp,
  loadLogoBugAndItsLogo,
  loadLogoBugWithAFailedLogo,
} from './logoBugOnThePage.testSupport.js';

describe('an image that fails to load', () => {
  it('leaves the graphic empty and answers 422 naming the address, at load', async () => {
    // Arrange: a logo bug on the page, about to load an address whose file is gone.
    const logoBug = createLogoBugOnThePage();

    // Act: load it, and the browser reports the image as broken.
    const answer = await loadLogoBugWithAFailedLogo(logoBug);

    // Assert: a 422 saying so, and no image element left to show a broken-image icon.
    expect(answer, 'a broken image must answer 422 with a pt-BR message').toEqual({
      statusCode: 422,
      statusMessage:
        'A imagem do logo não carregou (/media/9c4d2a10-logo-apagado); o logo fica vazio. Escolha outra imagem.',
    });
    expect(countLogoImages(logoBug), 'a broken image must leave the graphic empty').toBe(0);
  });

  it('keeps the old logo on screen and answers 422 when an update on air brings a broken image', async () => {
    // Arrange: the channel's logo on air.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());
    await logoBug.playAction({ skipAnimation: true });

    // Act: the operator picks a file that turns out to be broken.
    const pendingUpdate = logoBug.updateAction({ data: { logoUrl: deletedLogoAddress } });
    await letThePageCatchUp();
    letTheLogoFail(logoBug);
    const answer = await pendingUpdate;

    // Assert: a 422 naming the new address, and the old logo still in its corner, alone.
    expect(answer, 'a broken image on update must answer 422').toEqual({
      statusCode: 422,
      statusMessage:
        'A imagem do logo não carregou (/media/9c4d2a10-logo-apagado); o logo anterior continua na tela. Escolha outra imagem.',
    });
    expect(
      findTheShownLogo(logoBug)?.getAttribute('src'),
      'a failure must never blank what is on air: the old logo stays',
    ).toBe(createChannelLogoData().logoUrl);
    expect(countLogoImages(logoBug), 'the broken image must leave no element behind').toBe(1);
  });

  it('keeps the old logo on screen until the new one has arrived, then shows that same image', async () => {
    // Arrange: the channel's logo on air, and an update to the event's own logo started.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugAndItsLogo(logoBug, createChannelLogoData());
    await logoBug.playAction({ skipAnimation: true });
    const pendingUpdate = logoBug.updateAction({
      data: { logoUrl: '/media/5e1a7b33-logo-etapa-sul' },
    });
    await letThePageCatchUp();
    const shownWhileWaiting = findTheShownLogo(logoBug)?.getAttribute('src');
    const newLogoOnItsWay = findTheLogoOnItsWay(logoBug);

    // Act: the new file arrives.
    letTheLogoLoad(logoBug);
    const answer = await pendingUpdate;

    // Assert: the old logo was shown meanwhile; now the new image, the very element that
    // was fetching it (nothing loaded twice), is the only one.
    expect(shownWhileWaiting, 'the old logo must stay up while the new one is on its way').toBe(
      createChannelLogoData().logoUrl,
    );
    expect(newLogoOnItsWay?.getAttribute('src'), 'the new file must be fetched hidden').toBe(
      '/media/5e1a7b33-logo-etapa-sul',
    );
    expect(answer, 'a good image must answer 200').toEqual({ statusCode: 200 });
    expect(findTheShownLogo(logoBug), 'the image that arrived must be the one shown').toBe(
      newLogoOnItsWay,
    );
    expect(countLogoImages(logoBug), 'the old logo must be gone once the new one is up').toBe(1);
  });

  it('fills the corner again when a later update brings a good image', async () => {
    // Arrange: a logo bug whose first image was broken.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugWithAFailedLogo(logoBug);

    // Act: the operator picks the right file.
    const pendingUpdate = logoBug.updateAction({ data: createChannelLogoData() });
    await letThePageCatchUp();
    letTheLogoLoad(logoBug);
    const answer = await pendingUpdate;

    // Assert: 200 and the good image is drawn.
    expect(answer, 'a good image must answer 200').toEqual({ statusCode: 200 });
    expect(findTheShownLogo(logoBug)?.getAttribute('src'), 'the good image must be shown').toBe(
      createChannelLogoData().logoUrl,
    );
  });

  it('tries the same address again on an update, and shows it once the file is back', async () => {
    // Arrange: a logo bug whose image failed (the file was still uploading, say).
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugWithAFailedLogo(logoBug);

    // Act: an update with the very same data, and this time the file arrives.
    const pendingUpdate = logoBug.updateAction({ data: { logoUrl: deletedLogoAddress } });
    await letThePageCatchUp();
    const isTriedAgain = findTheLogoOnItsWay(logoBug) !== undefined;
    letTheLogoLoad(logoBug);
    const answer = await pendingUpdate;

    // Assert: fetched again, shown, and 200.
    expect(isTriedAgain, 'a failed image must be fetched again, even at the same address').toBe(
      true,
    );
    expect(answer, 'the image that arrived must answer 200').toEqual({ statusCode: 200 });
    expect(findTheShownLogo(logoBug)?.getAttribute('src'), 'the logo must be shown').toBe(
      deletedLogoAddress,
    );
  });

  it('answers 200, not 422 again, to an update that only moves a failed logo', async () => {
    // Arrange: a logo bug whose image failed; the operator was told so at load.
    const logoBug = createLogoBugOnThePage();
    await loadLogoBugWithAFailedLogo(logoBug);

    // Act: move it to the top-left corner and make it smaller; the file fails again.
    const pendingUpdate = logoBug.updateAction({ data: { corner: 'top-left', heightPx: 48 } });
    await letThePageCatchUp();
    letTheLogoFail(logoBug);
    const answer = await pendingUpdate;

    // Assert: 200 for the move, which did happen; the corner is still empty.
    expect(answer, 'the move must not be refused for an image it did not change').toEqual({
      statusCode: 200,
    });
    expect(
      findPartOfLogoBug(logoBug, 'logo-bug-panel')?.style.left,
      'the empty panel must have moved to the left side',
    ).toBe('var(--stage-safe-side)');
    expect(countLogoImages(logoBug), 'the image that failed again must leave nothing').toBe(0);
  });
});
