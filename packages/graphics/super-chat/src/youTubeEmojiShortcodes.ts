/**
 * YouTube's custom emoji in a message's text: `:face-blue-smiling:`, a colon, a name of
 * lowercase letters, digits, hyphens and underscores, and a colon (João's ruling at gate 2
 * of PR #54: YouTube writes its codes in lowercase, so a capital letter means a viewer's own
 * text). The name holds at least one letter, so digits between colons ("15:30:45", "1:2:3")
 * are a time or a score, never a code. youtube.com draws a picture for each; on air there is
 * none (graphics never fetch, architecture rule 3), so the card takes them out rather than
 * show the bare code. Unicode emoji are ordinary characters and stay, and so do
 * "placar: 2:1" and "Vai :D".
 * What could go wrong: a viewer who writes a lowercase word between two colons with no
 * space (":pequi:") loses it too; YouTube's own text gives no way to tell the two apart.
 */
const youTubeEmojiShortcodePattern = /:[a-z0-9_-]*[a-z][a-z0-9_-]*:/g;

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
