/**
 * How much the message ticker's bar holds, as character counts the item editor checks
 * before anything goes on air (the brief: a message too long for the bar is refused, never
 * wrapped, scrolled or measured at run time). The manifest's `maxLength`, `maxItems` and
 * the label's `maxLength` repeat these numbers; messageTickerManifest.test.ts keeps them
 * equal, and e2e/messageTickerHoldsTheLongest.e2e.ts proves in Chromium that the longest
 * message fits.
 *
 * The measurement (Chromium, Bebas Neue at the message's 30 px with its tracking, on the
 * built preview and on the design's message-ticker page): the message pill leaves 1239 px
 * for text beside the clock block, the "AVISO" label and the page cell; a label of 10
 * characters at its widest leaves 1160 px. The widest character an announcement may hold
 * is "@" (a social handle) at 22.3 px ("%" 18.6, "W" 17.6; an everyday message averages
 * 11.5 px a character). So 52 characters fit whatever they are; 50 keeps 46 px to spare,
 * and an everyday announcement ("LARGADA DO ENDURO ÀS 10H00", 26 characters) uses a quarter
 * of the bar.
 */

/** The longest message, in characters (code points, as the form and the server count). */
export const longestMessageInCharacters = 50;

/** The longest label ("AVISO", "ATENÇÃO"), in characters. */
export const longestLabelInCharacters = 10;

/**
 * The most messages a ticker holds: nine pages keep the page cell one digit ("9/9"), the
 * width the measurement above allowed for, and a 63 s round at 7 s a page.
 */
export const mostMessages = 9;
