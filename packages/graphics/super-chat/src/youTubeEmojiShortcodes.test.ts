/**
 * YouTube's own emoji left out of a viewer's message (packages/graphics/super-chat)
 *
 * What this module is for:
 *   YouTube writes its custom emoji (the channel's own and YouTube's, drawn as pictures on
 *   youtube.com) into a message's text as shortcodes, `:face-blue-smiling:`. On air there is
 *   no picture for them (graphics never fetch), so the card would show the bare code. They
 *   are taken out before the message is drawn; Unicode emoji (🔥) are plain characters and
 *   stay, drawn by the system's emoji font.
 *
 * What these tests prove, one row per case:
 *   - A shortcode is removed, wherever it sits, and several in a row too.
 *   - The spaces it leaves are folded into one, and the ends trimmed.
 *   - Unicode emoji, a time ("15:30") and a lone colon stay as written.
 *   - A message made only of shortcodes becomes empty, so the card shows no message row.
 *
 * What these tests deliberately do not cover:
 *   - How the card draws the result; superChatView.test.ts and the screenshots do.
 */
import { describe, expect, it } from 'vitest';

import { removeYouTubeEmojiShortcodes } from './youTubeEmojiShortcodes.js';

const shortcodeScenarios: Array<{ name: string; message: string; shownMessage: string }> = [
  // The everyday case: a shortcode at the end of a cheer.
  {
    name: 'removes a shortcode at the end',
    message: 'Vai, Pequi! :face-blue-smiling:',
    shownMessage: 'Vai, Pequi!',
  },
  // Viewers often open with one, and the space after it must go too.
  {
    name: 'removes a shortcode at the start',
    message: ':hand-pink-waving: Abraço de Goiânia',
    shownMessage: 'Abraço de Goiânia',
  },
  // In the middle, the two spaces around it become one.
  {
    name: 'folds the spaces a shortcode in the middle leaves',
    message: 'Força :yt: Carnaúba',
    shownMessage: 'Força Carnaúba',
  },
  // Several in a row, with no space between them, as YouTube's picker inserts them.
  {
    name: 'removes several shortcodes in a row',
    message: 'Boa sorte!:fire::fire::text-green-game-over:',
    shownMessage: 'Boa sorte!',
  },
  // A channel's own emoji may have digits and underscores in its name.
  {
    name: 'removes a channel emoji with digits and underscores',
    message: 'Valeu, equipe :baja_sae_2027: até sábado',
    shownMessage: 'Valeu, equipe até sábado',
  },
  // Unicode emoji are characters the system's emoji font draws: they stay.
  {
    name: 'keeps Unicode emoji',
    message: 'Vai, Pequi! 🔥🏁',
    shownMessage: 'Vai, Pequi! 🔥🏁',
  },
  // A time has colons but no name between two of them: it stays.
  {
    name: 'keeps a time of day',
    message: 'Nos vemos às 15:30 no paddock',
    shownMessage: 'Nos vemos às 15:30 no paddock',
  },
  // Two colons with spaces between are words, not a shortcode.
  {
    name: 'keeps colons around words with spaces',
    message: 'Placar: Pequi 2 : 1 Carnaúba',
    shownMessage: 'Placar: Pequi 2 : 1 Carnaúba',
  },
  // A message of shortcodes alone has nothing left to show.
  {
    name: 'leaves nothing of a message made only of shortcodes',
    message: ':face-blue-smiling: :fire:',
    shownMessage: '',
  },
  // A viewer who paid without writing: nothing to take out.
  { name: 'keeps an empty message empty', message: '', shownMessage: '' },
];

describe('removing YouTube emoji shortcodes from a message', () => {
  it.each(shortcodeScenarios)('$name', ({ message, shownMessage }) => {
    // Arrange: the message as YouTube sent it (in the table).

    // Act: take the shortcodes out.
    const result = removeYouTubeEmojiShortcodes(message);

    // Assert: what the card shows.
    expect(result, `what the card shows of "${message}"`).toBe(shownMessage);
  });
});
