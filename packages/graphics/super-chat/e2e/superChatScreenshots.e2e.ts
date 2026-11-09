/**
 * Super Chat card screenshots (packages/graphics/super-chat, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the card in Ardósia is
 *   pinned by screenshots taken from preview.html?data=… (which loads the theme's tokens
 *   and font the way the renderer page does) at 1920x1080, compared against the baselines
 *   stored next to this file. The design drew no Super Chat: the card is the notice's
 *   frame (noticeScreenshots.e2e.ts), in the same place, with "SUPER CHAT" and the amount
 *   in the head, the author and the message below.
 *
 * What these tests prove, one screenshot each:
 *   - A short message: SUPER CHAT and the navy R$ 20,00 cell, TORCIDA PEQUI OFF-ROAD, then
 *     the message, quieter.
 *   - A long message: its start shows and the rest runs past the card's edge, cut (it
 *     scrolls on air), the card still 420 wide.
 *   - An empty message: the amount and the author only, a shorter card.
 *   - The longest author name YouTube allows: it runs past the edge and scrolls the same.
 *   - A message with Unicode emoji, drawn by the system's colour emoji face, and one of
 *     YouTube's own emoji shortcodes taken out.
 *   - Every card sits where the notice does: under the bug at x 96, y 186, 420 wide.
 *
 * What these tests deliberately do not cover:
 *   - Motion and the scroll itself; texts are held at their start (the kit's tokens) so no
 *     scroll can land during a capture. The kit's tests cover the scroll.
 *   - Other operating systems: baselines are rendered on Linux (CI). The emoji screenshot
 *     needs the system's colour emoji face (Noto Color Emoji, which Playwright's
 *     `install --with-deps` puts on CI); a machine without it draws other glyphs. After a
 *     deliberate visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/super-chat test:e2e --update-snapshots`.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import {
  expectTextStartShowing,
  measureScrollingBox,
  textTokensHoldingAtTheStart,
} from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/**
 * The longest author name YouTube allows, 100 characters: the channel name limit as
 * several guides give it. YouTube's own help does not state it, so 100 is taken as the
 * worst case (a handle is at most 30, shorter still). A fictional fan club.
 */
const longestYouTubeAuthorName =
  'Associação dos Amigos e Torcedores do Baja SAE de Goiânia, Anápolis, Trindade e Região — Fã do Pequi';

/** A viewer's long message, as Super Chats of the higher tiers allow. */
const longMessage =
  'Que corrida linda! Mandando um abraço enorme pra equipe Pequi Off-Road direto de Goiânia, ' +
  'vocês são orgulho da UFG. Força no enduro, cuidado na curva da caixa d’água e voltem inteiros!';

/** Opens the preview with the data, waits for the play-in to finish and for the font. */
async function openPreviewOnAir(page: Page, superChatData: Record<string, unknown>) {
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensHoldingAtTheStart);
  await page.goto(buildPreviewAddressWithData(superChatData));
  await expect(page.locator('body'), 'the card must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // The preview's own buttons are not on air: only the stage is captured.
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

/** Checks the card's place: under the bug at x 96, y 186, 420 wide, like the notice. */
async function expectCardUnderTheBug(page: Page): Promise<void> {
  const cardPlace = await page.getByTestId('super-chat-panel').boundingBox();
  expect(
    { x: cardPlace?.x, y: cardPlace?.y, width: cardPlace?.width },
    'the card must sit under the bug at x 96, y 186, 420 wide',
  ).toEqual({ x: 96, y: 186, width: 420 });
}

const screenshotScenarios = [
  {
    // The everyday Super Chat: the sample event's fictional viewer.
    name: 'a short message',
    superChatData: {
      amountText: 'R$ 20,00',
      authorName: 'Torcida Pequi Off-Road',
      messageText: 'Vai, Pequi! Abraço de Goiânia',
    },
    screenshotName: 'super-chat-short-message.png',
  },
  {
    // A message far wider than the card: it must be cut at the edge, not wrap or stretch.
    name: 'a long message',
    superChatData: {
      amountText: 'R$ 200,00',
      authorName: 'Família Carnaúba',
      messageText: longMessage,
    },
    screenshotName: 'super-chat-long-message.png',
  },
  {
    // A viewer who paid without writing: the card is the amount and the author.
    name: 'an empty message',
    superChatData: { amountText: 'R$ 5,00', authorName: 'Ana do Paddock', messageText: '' },
    screenshotName: 'super-chat-empty-message.png',
  },
  {
    // The longest name YouTube allows, with a short message under it.
    name: 'the longest author name',
    superChatData: {
      amountText: 'R$ 1.000,00',
      authorName: longestYouTubeAuthorName,
      messageText: 'Bora, Pequi!',
    },
    screenshotName: 'super-chat-longest-author.png',
  },
  {
    // Unicode emoji stay and the system's emoji face draws them; the shortcode goes.
    name: 'Unicode emoji and a YouTube shortcode',
    superChatData: {
      amountText: 'R$ 50,00',
      authorName: 'Torcida Carnaúba 🏁',
      messageText: 'Força, Carnaúba! 🔥🚙 :face-blue-smiling:',
    },
    screenshotName: 'super-chat-unicode-emoji.png',
  },
];

test.describe('the Super Chat card looks like its baseline', () => {
  for (const { name, superChatData, screenshotName } of screenshotScenarios) {
    test(`with ${name}`, async ({ page }) => {
      // Arrange: the data comes from the scenario row above.

      // Act: open the preview on air with it.
      await openPreviewOnAir(page, superChatData);

      // Assert: the card is where the notice is, and the stage matches its baseline. A 1%
      // pixel tolerance absorbs anti-aliasing differences between GPU drivers without
      // letting a colour or text change through.
      await expectCardUnderTheBug(page);
      await expect(page, `the card with ${name} must look like its baseline`).toHaveScreenshot(
        screenshotName,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  }
});

test.describe('texts too long for the card', () => {
  test('takes the longest author name at YouTube’s 100 characters', () => {
    // Arrange: the name the screenshot and the scroll check use.

    // Act: count its characters.
    const characterCount = [...longestYouTubeAuthorName].length;

    // Assert: exactly the limit, so the worst case is really the worst case.
    expect(characterCount, 'the longest name must be 100 characters').toBe(100);
  });

  const longTextScenarios = [
    // The message row of the long message.
    {
      name: 'a long message',
      superChatData: {
        amountText: 'R$ 200,00',
        authorName: 'Família Carnaúba',
        messageText: longMessage,
      },
      testId: 'super-chat-message',
    },
    // The author row of the longest name.
    {
      name: 'the longest author name',
      superChatData: {
        amountText: 'R$ 1.000,00',
        authorName: longestYouTubeAuthorName,
        messageText: 'Bora, Pequi!',
      },
      testId: 'super-chat-author',
    },
  ];

  for (const { name, superChatData, testId } of longTextScenarios) {
    test(`shows the start of ${name} and cuts the rest at the edge, to scroll`, async ({
      page,
    }) => {
      // Arrange: the card on air, the text held at its start.
      await openPreviewOnAir(page, superChatData);

      // Act: measure the text's box and the text inside it.
      const place = await measureScrollingBox(page.getByTestId(testId));

      // Assert: the start shows at the box's left edge and the text runs past its right
      // edge (cut, not wrapped or ellipsed), so the kit scrolls it on air.
      expectTextStartShowing(place);
    });
  }
});
