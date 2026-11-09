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
 *   - Unicode emoji, a time ("15:30", "15:30:45"), digits between colons ("1:2:3"), a lone
 *     colon, a score ("placar: 2:1"), a smiley ("Vai :D") and a word with a capital between
 *     colons stay as written: a code is lowercase only (João's ruling at gate 2 of PR #54)
 *     and holds at least one letter (the follow-up to gate 2).
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
  // Regression guard (João's example at gate 2): a score with a colon beside a digit.
  { name: 'keeps a score', message: 'placar: 2:1', shownMessage: 'placar: 2:1' },
  // Regression guard (João's example at gate 2): a smiley typed with a colon and a capital.
  { name: 'keeps a typed smiley', message: 'Vai :D', shownMessage: 'Vai :D' },
  // A time with seconds: ":30:" is digits alone between colons, and a code has a letter.
  {
    name: 'keeps a time with seconds',
    message: 'Largada às 15:30:45',
    shownMessage: 'Largada às 15:30:45',
  },
  // Digits alone between colons again, with nothing around them: no letter, no code.
  { name: 'keeps digits between colons', message: '1:2:3', shownMessage: '1:2:3' },
  // A capital letter is a viewer's own text: YouTube's codes are lowercase.
  {
    name: 'keeps a word with a capital between colons',
    message: 'Torcida :Pequi: presente',
    shownMessage: 'Torcida :Pequi: presente',
  },
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
