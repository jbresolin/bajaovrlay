/**
 * YouTube's custom emoji in a message's text: `:face-blue-smiling:`, a colon, a name of
 * letters, digits, hyphens and underscores, and a colon. youtube.com draws a picture for
 * each; on air there is none (graphics never fetch, architecture rule 3), so the card takes
 * them out rather than show the bare code. Unicode emoji are ordinary characters and stay.
 * What could go wrong: a viewer who writes a word between two colons with no space
 * (":pequi:") loses it too; YouTube's own text gives no way to tell the two apart.
 */
const youTubeEmojiShortcodePattern = /:[A-Za-z0-9_-]+:/g;

// What a removed shortcode can leave behind: two or more spaces in a row.
const runOfSpacesPattern = / {2,}/g;

/**
 * The message without YouTube's emoji shortcodes, the spaces they leave folded into one
 * and the ends trimmed. A message of shortcodes alone becomes empty.
 */
export function removeYouTubeEmojiShortcodes(message: string): string {
  const withoutShortcodes = message.replaceAll(youTubeEmojiShortcodePattern, ' ');
  const withSingleSpaces = withoutShortcodes.replaceAll(runOfSpacesPattern, ' ');
  return withSingleSpaces.trim();
}
