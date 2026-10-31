/**
 * Cleaning up text a source sends (packages/shared)
 *
 * What this module is for:
 *   Names reach a flex source as the organisers typed them: the Baja app's results API
 *   keeps "Procobaja " with its trailing space and an event name with "&nbsp;" in it, on
 *   purpose (its contract says so). Every text value a flex mapping writes into a shape is
 *   cleaned up the same way, for every flex source (BAJAOVRLAY-53): HTML entities decoded,
 *   runs of spaces collapsed to one, the ends trimmed.
 *
 * What these tests prove:
 *   - Trailing and doubled spaces, tabs and line breaks go.
 *   - The named entities organisers type (&nbsp; &amp; &lt; &gt; &quot; &apos;, the
 *     accented letters of Portuguese) and numeric ones (&#39; &#x27;) are decoded, a
 *     non-breaking space becoming an ordinary one.
 *   - An entity the list does not know, and an ampersand on its own, are kept as written.
 *   - Through applyFlexMapping, a team name and an event name are cleaned when written,
 *     and a value that is not text is left alone.
 *
 * What these tests deliberately do not cover:
 *   - HTML tags: no source sends them in a name; a tag would show as written.
 */
import { describe, expect, it } from 'vitest';

import { applyFlexMapping } from './applyFlexMapping.js';
import { FlexMappingConfigSchema } from './flexMappingConfig.js';
import { cleanUpTextFromASource } from './sourceTextCleanup.js';

describe('cleanUpTextFromASource', () => {
  const cleanupScenarios: Array<{ name: string; text: string; expected: string }> = [
    // The real 25SU team, with the space the organisers left after its name.
    { name: 'trims "Procobaja " to "Procobaja"', text: 'Procobaja ', expected: 'Procobaja' },
    // Doubled spaces inside a name collapse to one.
    {
      name: 'collapses the doubled space in "Baja  SAE BRASIL"',
      text: 'Baja  SAE BRASIL',
      expected: 'Baja SAE BRASIL',
    },
    // A tab or a line break from a pasted cell is a space too.
    {
      name: 'turns a tab and a line break into single spaces',
      text: 'Equipe\tFEI\nBaja',
      expected: 'Equipe FEI Baja',
    },
    // The case the API's contract names: an event name with a non-breaking space entity.
    {
      name: 'decodes &nbsp; into an ordinary space',
      text: 'Baja SAE BRASIL&nbsp;- 2024',
      expected: 'Baja SAE BRASIL - 2024',
    },
    // An entity at the end, decoded into a space, is then trimmed like any space.
    {
      name: 'trims an &nbsp; at the end once decoded',
      text: 'Poli Baja&nbsp;',
      expected: 'Poli Baja',
    },
    // The ampersand of a team name typed as HTML.
    { name: 'decodes &amp; into "&"', text: 'Mangue &amp; Baja', expected: 'Mangue & Baja' },
    // An apostrophe typed as a numeric entity, in decimal and in hexadecimal.
    {
      name: 'decodes &#39; and &#x27; into an apostrophe',
      text: 'Pe&#39;Baja e Pe&#x27;Baja',
      expected: "Pe'Baja e Pe'Baja",
    },
    // Portuguese accents typed as entities.
    {
      name: 'decodes the accented letters of Portuguese',
      text: 'Funda&ccedil;&atilde;o Educacional Inaciana &Aacute;gil',
      expected: 'Fundação Educacional Inaciana Ágil',
    },
    // An entity not in the list stays as written: guessing would be worse.
    {
      name: 'keeps an entity it does not know as written',
      text: 'Baja &trade; UFPR',
      expected: 'Baja &trade; UFPR',
    },
    // A plain ampersand is not an entity.
    { name: 'keeps an ampersand on its own', text: 'Baja & Cia', expected: 'Baja & Cia' },
  ];

  it.each(cleanupScenarios)('$name', ({ text, expected }) => {
    // Arrange: the text of this row, as a source sends it.

    // Act: clean it up.
    const cleanedText = cleanUpTextFromASource(text);

    // Assert: the cleaned text.
    expect(cleanedText, 'the text must be cleaned up as this row says').toBe(expected);
  });
});

describe('applyFlexMapping cleans up every text it writes', () => {
  it('cleans a team name and an event name, and leaves numbers alone', () => {
    // Arrange: a session read from an event name with an entity, and a positions list
    // whose one team is "Procobaja " with its trailing space.
    const mappings = FlexMappingConfigSchema.parse([
      {
        shapeKey: 'session',
        requestId: 'resultado',
        fields: [{ targetField: 'eventName', fromPath: 'evento' }],
      },
      {
        shapeKey: 'positions',
        requestId: 'resultado',
        entriesPath: 'carros',
        fields: [],
        entryFields: [
          { targetField: 'carNumber', fromPath: 'numero' },
          { targetField: 'teamName', fromPath: 'equipe' },
        ],
      },
    ]);
    const response = {
      evento: 'Baja SAE BRASIL&nbsp;- Etapa Sul 2025',
      carros: [{ numero: 1, equipe: 'Procobaja ' }],
    };

    // Act: map the response.
    const result = applyFlexMapping(mappings, { resultado: response }, 0);

    // Assert: both texts cleaned, the car number untouched.
    expect(result, 'every text must be cleaned up when written').toEqual({
      ok: true,
      shapes: {
        session: { eventName: 'Baja SAE BRASIL - Etapa Sul 2025' },
        positions: { entries: [{ carNumber: 1, teamName: 'Procobaja' }] },
      },
    });
  });
});
