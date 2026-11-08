/**
 * The station's name typed at login (packages/shared)
 *
 * What this module is for:
 *   At login the operator names the station ("Mesa 1"), and every command and history row
 *   shows it after the role: "Produtor · Mesa 1" (BAJAOVRLAY-29). It ends up in the actor
 *   (`produtor:Mesa 1`), the event log and the page, so it is held to plain, printable
 *   characters (gate 2 of PR #51): letters (accents too), digits, spaces and - . _ ( ) #,
 *   at most 30 after trimming. Anything else is refused in pt-BR, saying what may be typed.
 *
 * What these tests prove (each row of the table):
 *   - Real station names pass, trimmed: plain, accented, with a number sign, parentheses,
 *     a dash, a dot or an underscore, and one of exactly 30 characters.
 *   - Blank, 31 characters, a colon, angle brackets, a slash, an emoji, a tab and a
 *     line break inside are refused, each with its pt-BR sentence.
 *
 * What these tests deliberately do not cover:
 *   - The login route answering 400 with the sentence; apps/server's
 *     operatorLoginRoutes.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { StationNameSchema } from './operatorSession.js';

const sentenceForABlankName = 'Digite o nome da estação (por exemplo, Mesa 1).';
const sentenceForATooLongName = 'O nome da estação tem no máximo 30 letras.';
const sentenceForAnUnusualCharacter =
  'O nome da estação só pode ter letras, números, espaços e - . _ ( ) #.';

describe('StationNameSchema', () => {
  const acceptedScenarios = [
    // The brief's own example.
    { name: 'a desk with its number', typed: 'Mesa 1', kept: 'Mesa 1' },
    // pt-BR names carry accents.
    { name: 'accented letters', typed: 'Cabine Técnica', kept: 'Cabine Técnica' },
    // How crews number desks.
    { name: 'a number sign', typed: 'Mesa #2', kept: 'Mesa #2' },
    // A note in parentheses, a dash, a dot and an underscore.
    {
      name: 'parentheses, a dash, a dot, an underscore',
      typed: 'Box-2 (fundos) n._3',
      kept: 'Box-2 (fundos) n._3',
    },
    // Spaces around are trimmed, as before.
    { name: 'spaces around, trimmed', typed: '  Mesa 1  ', kept: 'Mesa 1' },
    // The longest allowed.
    {
      name: 'exactly 30 characters',
      typed: 'Cabine de dados da pista sul 1',
      kept: 'Cabine de dados da pista sul 1',
    },
  ];

  it.each(acceptedScenarios)('accepts $name', ({ typed, kept }) => {
    // Arrange: the row's name as typed (in the table above).

    // Act: read it as the login does.
    const reading = StationNameSchema.safeParse(typed);

    // Assert: accepted, trimmed.
    expect(reading.success && reading.data, 'the name kept for the actor').toBe(kept);
  });

  const refusedScenarios = [
    // Nothing but spaces.
    { name: 'a blank name', typed: '   ', sentence: sentenceForABlankName },
    // One character too many.
    {
      name: '31 characters',
      typed: 'Cabine de dados da pista sul 12',
      sentence: sentenceForATooLongName,
    },
    // The actor's own separator: `dados:Mesa:2` reads oddly in the log.
    { name: 'a colon', typed: 'Mesa:2', sentence: sentenceForAnUnusualCharacter },
    // Markup, which no station name needs.
    { name: 'angle brackets', typed: '<b>Mesa</b>', sentence: sentenceForAnUnusualCharacter },
    // A path or an address.
    { name: 'a slash', typed: 'Mesa 1/2', sentence: sentenceForAnUnusualCharacter },
    // Not a plain printable character for the log.
    { name: 'an emoji', typed: 'Mesa 🎥', sentence: sentenceForAnUnusualCharacter },
    // Whitespace other than a space hides in the log.
    { name: 'a tab inside', typed: 'Mesa\t1', sentence: sentenceForAnUnusualCharacter },
    // A line break would split the log's line.
    { name: 'a line break inside', typed: 'Mesa\n1', sentence: sentenceForAnUnusualCharacter },
  ];

  it.each(refusedScenarios)('refuses $name', ({ typed, sentence }) => {
    // Arrange: the row's name as typed (in the table above).

    // Act: read it as the login does.
    const reading = StationNameSchema.safeParse(typed);

    // Assert: refused with the row's pt-BR sentence.
    expect(reading.success, 'the name must be refused').toBe(false);
    expect(reading.error?.issues[0]?.message, 'what to type instead, in pt-BR').toBe(sentence);
  });
});
