/**
 * Where the image sits and how it looks: anchors, offsets, sizes, a background and a
 * missing file (packages/graphics/image, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so where the image's box lands for
 *   an anchor and its offsets is measured here in Chromium on the built preview.html, and
 *   its look is pinned by screenshots of the grey stage at 1920x1080, compared with the
 *   baselines stored next to this file. The white Baja SAE Brasil mark (335x256 px) stands
 *   in for an operator's image; at a width of 335 px it is drawn at its own size.
 *
 * What these tests prove:
 *   - For six of the nine anchors, with and without offsets (negative ones and one past
 *     the safe area included), the box's edges or centre land on the canvas pixel the
 *     anchor and offsets say: corners on the canvas's own corners (not the safe area).
 *   - With no height, the height follows the file (335 wide → 256 high); with width and
 *     height both set the box is exactly that size, the picture fitted inside it.
 *   - Screenshots: the default (centred), a bottom-right banner pulled in, a 600x200 box on
 *     a dark background with a 12 px margin (the colour filling the margin and the bands
 *     beside the fitted picture), half opacity, and a missing file (nothing on the stage).
 *
 * What these tests deliberately do not cover:
 *   - Motion; the shots show the end of the fade in (imageLifecycle.e2e.ts covers it).
 *   - The black stage the logo bug also shoots: this graphic has no look of its own to
 *     check against two backgrounds, only the operator's picture.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/image test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview on air and waits for the file (never a timer); hides the buttons. */
async function openPreviewOnAirWithTheFileLoaded(page: Page, address: string): Promise<void> {
  await page.goto(address);
  await expect(page.locator('body'), 'the image must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.waitForFunction(() => {
    const image = document.querySelector('baja-image');
    const picture = image?.shadowRoot?.querySelector('img[data-image-state="loaded"]');
    return picture instanceof HTMLImageElement && picture.complete && picture.naturalWidth > 0;
  });
  // The preview's own buttons are not on air.
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

/** The box's edges and centre on the 1920x1080 page, read from its bounding box. */
async function measureTheBox(page: Page) {
  const box = await page.getByTestId('image-box').boundingBox();
  const left = box?.x ?? 0;
  const top = box?.y ?? 0;
  const width = box?.width ?? 0;
  const height = box?.height ?? 0;
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    centreX: left + width / 2,
    centreY: top + height / 2,
    width,
    height,
  };
}

type BoxMeasure = Awaited<ReturnType<typeof measureTheBox>>;

const placementScenarios = [
  // The canvas's own corner: pixel (0, 0), not the safe area at (96, 54).
  {
    name: 'top-left with no offset sits on the canvas corner',
    query: 'position=top-left',
    read: (box: BoxMeasure) => ({ left: box.left, top: box.top }),
    expected: { left: 0, top: 0 },
  },
  // Positive offsets move right and down from that corner.
  {
    name: 'top-left moved 120 right and 40 down',
    query: 'position=top-left&x=120&y=40',
    read: (box: BoxMeasure) => ({ left: box.left, top: box.top }),
    expected: { left: 120, top: 40 },
  },
  // Negative offsets pull a bottom-right box in, here onto the safe area's corner.
  {
    name: 'bottom-right pulled 96 left and 54 up lands on the safe area’s corner',
    query: 'position=bottom-right&x=-96&y=-54',
    read: (box: BoxMeasure) => ({ right: box.right, bottom: box.bottom }),
    expected: { right: 1824, bottom: 1026 },
  },
  // A positive offset on a right-held box goes past the canvas edge, as the operator asked.
  {
    name: 'top-right pushed 30 past the right edge',
    query: 'position=top-right&x=30',
    read: (box: BoxMeasure) => ({ right: box.right, top: box.top }),
    expected: { right: 1950, top: 0 },
  },
  // The default: the box's centre on the canvas's centre.
  {
    name: 'middle-center with no offset is centred on the canvas',
    query: 'position=middle-center',
    read: (box: BoxMeasure) => ({ centreX: box.centreX, centreY: box.centreY }),
    expected: { centreX: 960, centreY: 540 },
  },
  // Centred along the bottom, lifted 40 px.
  {
    name: 'bottom-center lifted 40 is centred across, 40 above the bottom',
    query: 'position=bottom-center&y=-40',
    read: (box: BoxMeasure) => ({ centreX: box.centreX, bottom: box.bottom }),
    expected: { centreX: 960, bottom: 1040 },
  },
  // Centred down the left edge, moved 200 right and 100 up.
  {
    name: 'middle-left moved 200 right and 100 up',
    query: 'position=middle-left&x=200&y=-100',
    read: (box: BoxMeasure) => ({ left: box.left, centreY: box.centreY }),
    expected: { left: 200, centreY: 440 },
  },
  // Centred down the right edge with no offset.
  {
    name: 'middle-right with no offset touches the right edge, centred down it',
    query: 'position=middle-right',
    read: (box: BoxMeasure) => ({ right: box.right, centreY: box.centreY }),
    expected: { right: 1920, centreY: 540 },
  },
];

test.describe('where the image box sits', () => {
  for (const scenario of placementScenarios) {
    test(scenario.name, async ({ page }) => {
      // Arrange: the preview on air with the mark at its own size and this row's position.
      await openPreviewOnAirWithTheFileLoaded(
        page,
        `preview.html?stage=grey&width=335&${scenario.query}`,
      );

      // Act: measure the box.
      const box = await measureTheBox(page);

      // Assert: the edges or the centre the row expects, and the file's own size.
      expect(scenario.read(box), `${scenario.name}: the box must be where the row says`).toEqual(
        scenario.expected,
      );
      expect(
        { width: box.width, height: box.height },
        'with no height the box must keep the file’s proportions',
      ).toEqual({ width: 335, height: 256 });
    });
  }

  test('is exactly the width and height asked when both are set, the picture fitted inside', async ({
    page,
  }) => {
    // Arrange: the mark in a 600x200 box, top-left.
    await openPreviewOnAirWithTheFileLoaded(
      page,
      'preview.html?stage=grey&position=top-left&width=600&height=200',
    );

    // Act: measure the box.
    const box = await measureTheBox(page);

    // Assert: the box is the asked size, at the corner.
    expect(
      { left: box.left, top: box.top, width: box.width, height: box.height },
      'the box must be 600x200 at the corner, never the file’s own shape',
    ).toEqual({ left: 0, top: 0, width: 600, height: 200 });
  });
});

const lookScenarios = [
  // The default, centred, at the mark's own size.
  { slug: 'centro', query: 'width=335' },
  // A banner bottom-right pulled onto the safe area.
  { slug: 'inferior-direita-deslocada', query: 'width=335&position=bottom-right&x=-96&y=-54' },
  // João's background: a 600x200 box on a dark plate with a 12 px margin; the colour fills
  // the margin and the bands beside the fitted mark.
  {
    slug: 'fundo-escuro-com-margem',
    query: 'width=600&height=200&background=%230a0a0a&margin=12&position=top-left&x=96&y=54',
  },
  // Half opacity: the stage shows through.
  { slug: 'opacidade-50', query: 'width=335&opacity=50' },
];

test.describe('how the image looks on the grey stage', () => {
  for (const scenario of lookScenarios) {
    test(`draws ${scenario.slug} like its baseline`, async ({ page }) => {
      // Arrange: the preview on air with this row's choices.
      await openPreviewOnAirWithTheFileLoaded(page, `preview.html?stage=grey&${scenario.query}`);

      // Act: nothing more; the shot is of the image on air.

      // Assert: the look against the baseline. A 1% pixel tolerance absorbs anti-aliasing.
      await expect(page, `${scenario.slug} must look like its baseline`).toHaveScreenshot(
        `image-${scenario.slug}-grey.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  }

  test('draws nothing, no broken-image icon and no background, when the file is missing', async ({
    page,
  }) => {
    // Arrange: the preview loading an address with no file behind it, on a dark plate;
    // its load answers 422, so the preview does not play it.
    await page.goto('preview.html?stage=grey&image=missing&background=%230a0a0a&margin=12');
    await expect(page.locator('body'), 'the 422 must end the preview in error').toHaveAttribute(
      'data-preview-state',
      'error',
    );
    await page.locator('#preview-controls').evaluate((controls) => {
      controls.style.visibility = 'hidden';
    });

    // Act: play it anyway, as a renderer could, so the shot shows it on air.
    const answer = await page.evaluate(async () => {
      type ImageElement = HTMLElement & {
        playAction: (params: object) => Promise<{ statusCode: number }>;
      };
      const image = document.querySelector('baja-image') as ImageElement;
      return image.playAction({ skipAnimation: true });
    });

    // Assert: on air, no picture element, and the stage alone in the shot.
    expect(answer.statusCode, 'the empty image must still play').toBe(200);
    await expect(
      page.getByTestId('image-picture'),
      'a missing file must leave no picture element',
    ).toHaveCount(0);
    await expect(page, 'a missing file must leave the stage empty').toHaveScreenshot(
      'image-imagem-ausente-grey.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });
});
