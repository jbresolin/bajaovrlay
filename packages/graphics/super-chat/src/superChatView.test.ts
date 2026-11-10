/**
 * What the Super Chat card shows (packages/graphics/super-chat)
 *
 * What this module is for:
 *   The card a viewer's approved Super Chat goes on air with (BAJAOVRLAY-35): "SUPER CHAT"
 *   and the amount in the head, the author, and the message. superChatView.ts writes the
 *   data into the card in place.
 *
 * What these tests prove:
 *   - A loaded card shows the badge, the amount as YouTube wrote it, the author and the
 *     message.
 *   - A Super Chat with no message, or whose message was only YouTube emoji shortcodes,
 *     hides the message row: the card is the amount and the author.
 *   - Shortcodes are taken out of the message; Unicode emoji stay.
 *   - An update on air rewrites the card in place, and a message added later brings the
 *     row back.
 *   - The author and the message are scrolling boxes, so a long one scrolls instead of being
 *     cut.
 *
 * What these tests deliberately do not cover:
 *   - The look (colours, sizes, the emoji face); the Playwright screenshots pin it.
 *   - Every shortcode case; youTubeEmojiShortcodes.test.ts covers them.
 */
import { describe, expect, it } from 'vitest';

import {
  createPequiSuperChatData,
  createSuperChatOnThePage,
  findPartOfSuperChat,
  loadSuperChatWithData,
  readShownText,
} from './superChatOnThePage.testSupport.js';

describe('a loaded Super Chat card', () => {
  it('shows the badge, the amount, the author and the message', async () => {
    // Arrange: a card on the page, not loaded yet.
    const superChat = createSuperChatOnThePage();

    // Act: load Torcida Pequi Off-Road's Super Chat.
    await loadSuperChatWithData(superChat, createPequiSuperChatData());

    // Assert: each part shows its text, and the message row is there.
    const shownTexts = {
      badge: readShownText(superChat, 'super-chat-badge'),
      amount: readShownText(superChat, 'super-chat-amount'),
      author: readShownText(superChat, 'super-chat-author'),
      message: readShownText(superChat, 'super-chat-message'),
    };
    expect(shownTexts, 'the card must show what the Super Chat says').toEqual({
      badge: 'SUPER CHAT',
      amount: 'R$ 20,00',
      author: 'Torcida Pequi Off-Road',
      message: 'Vai, Pequi! Abraço de Goiânia',
    });
    const messageRow = findPartOfSuperChat(superChat, 'super-chat-message-row');
    expect(messageRow?.hidden, 'the message row must be shown').toBe(false);
  });

  const noMessageScenarios = [
    // A viewer who paid without writing: YouTube sends an empty comment.
    { name: 'an empty message', messageText: '' },
    // Some renderers leave an empty field out of the data altogether.
    { name: 'no message field at all', messageText: undefined },
    // A message of YouTube's own emoji alone has nothing left once they are out.
    { name: 'a message of shortcodes alone', messageText: ':face-blue-smiling: :fire:' },
  ];

  it.each(noMessageScenarios)('hides the message row for $name', async ({ messageText }) => {
    // Arrange: Ana do Paddock's R$ 5,00, with this message.
    const superChat = createSuperChatOnThePage();
    const data = { amountText: 'R$ 5,00', authorName: 'Ana do Paddock', messageText };

    // Act: load it, as sent on the wire (an undefined field is dropped).
    await loadSuperChatWithData(superChat, JSON.parse(JSON.stringify(data)) as unknown);

    // Assert: the amount and the author only.
    const messageRow = findPartOfSuperChat(superChat, 'super-chat-message-row');
    expect(messageRow?.hidden, 'the message row must be hidden').toBe(true);
    expect(readShownText(superChat, 'super-chat-author'), 'the author must still show').toBe(
      'Ana do Paddock',
    );
  });

  it('takes YouTube emoji shortcodes out of the message and keeps Unicode emoji', async () => {
    // Arrange: a cheer with one of YouTube's emoji and two Unicode ones.
    const superChat = createSuperChatOnThePage();
    const data = {
      ...createPequiSuperChatData(),
      messageText: 'Vai, Pequi! :face-blue-smiling: 🔥🏁',
    };

    // Act: load it.
    await loadSuperChatWithData(superChat, data);

    // Assert: the shortcode is gone, the Unicode emoji are there.
    expect(readShownText(superChat, 'super-chat-message'), 'what the message row shows').toBe(
      'Vai, Pequi! 🔥🏁',
    );
  });

  it('makes the author and the message scrolling boxes', async () => {
    // Arrange: a card on the page.
    const superChat = createSuperChatOnThePage();

    // Act: load it.
    await loadSuperChatWithData(superChat, createPequiSuperChatData());

    // Assert: both texts sit in the kit's scrolling boxes.
    const areScrollingBoxes = ['super-chat-author', 'super-chat-message'].map((testId) =>
      findPartOfSuperChat(superChat, testId)?.classList.contains('scrolling-text-box'),
    );
    expect(areScrollingBoxes, 'the author and the message must scroll when too long').toEqual([
      true,
      true,
    ]);
  });
});

describe('an update on air', () => {
  it('rewrites the card in place and brings the message row back', async () => {
    // Arrange: Ana do Paddock's Super Chat with no message, on air.
    const superChat = createSuperChatOnThePage();
    await loadSuperChatWithData(superChat, {
      amountText: 'R$ 5,00',
      authorName: 'Ana do Paddock',
    });
    await superChat.playAction({ skipAnimation: true });
    const panelBefore = findPartOfSuperChat(superChat, 'super-chat-panel');

    // Act: the operator corrects the amount and the message arrives.
    const answer = await superChat.updateAction({
      data: { amountText: 'R$ 10,00', messageText: 'Força, Carnaúba!' },
    });

    // Assert: accepted, the same card, the new amount and the message row shown.
    expect(answer.statusCode, 'the update must be accepted').toBe(200);
    expect(findPartOfSuperChat(superChat, 'super-chat-panel'), 'the card is not rebuilt').toBe(
      panelBefore,
    );
    expect(readShownText(superChat, 'super-chat-amount'), 'the new amount').toBe('R$ 10,00');
    expect(readShownText(superChat, 'super-chat-message'), 'the new message').toBe(
      'Força, Carnaúba!',
    );
    const messageRow = findPartOfSuperChat(superChat, 'super-chat-message-row');
    expect(messageRow?.hidden, 'the message row must come back').toBe(false);
  });
});
