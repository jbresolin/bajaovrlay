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
 *   - Text that cleans up to nothing ("&nbsp;", spaces) is left out, never written as "":
 *     a required field is then named as missing, and an optional one lets the shape pass
 *     (gate 2 of PR #35), as firstOf already treats a blank as absent.
 *
 * What these tests deliberately do not cover:
 *   - HTML tags: no source sends them in a name; a tag would show as written.
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from '../dataShapes/validateDataShape.js';
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

describe('applyFlexMapping leaves out text that cleans up to nothing', () => {
  /** A race direction answer with one penalty, car 13 "Bombaja" of UFSM, as `changes` say. */
  function buildPenaltyAnswer(changes: Record<string, unknown>) {
    return {
      prova: 'END',
      ocorrencias: [
        {
          id: 'pen-0042',
          carro: 13,
          equipe: 'Bombaja',
          escola: 'UFSM',
          tipo: 'penalty',
          motivo: 'Queima de largada',
          penalidade: '+30 segundos',
          ...changes,
        },
      ],
    };
  }

  /** The incidents mapping of that answer, every field read by a plain path. */
  function buildIncidentsMapping() {
    return FlexMappingConfigSchema.parse([
      {
        shapeKey: 'incidents',
        requestId: 'direcao',
        entriesPath: 'ocorrencias',
        fields: [
          { targetField: 'sessionId', fromPath: 'prova' },
          { targetField: 'updatedAtMs', fromPollMoment: true },
        ],
        entryFields: [
          { targetField: 'incidentId', fromPath: 'id' },
          { targetField: 'carNumber', fromPath: 'carro' },
          { targetField: 'teamName', fromPath: 'equipe' },
          { targetField: 'schoolName', fromPath: 'escola' },
          { targetField: 'kind', fromPath: 'tipo' },
          { targetField: 'reason', fromPath: 'motivo' },
          { targetField: 'penaltyText', fromPath: 'penalidade' },
        ],
      },
    ]);
  }

  const blankTextScenarios: Array<{
    name: string;
    changes: Record<string, unknown>;
    blankField: string;
    expectedValidation: { isValid: boolean };
  }> = [
    // A required text typed as "&nbsp;": left out, so the validation says it is missing.
    {
      name: 'leaves out a required reason sent as "&nbsp;"',
      changes: { motivo: '&nbsp;' },
      blankField: 'reason',
      expectedValidation: { isValid: false },
    },
    // An optional text sent as spaces: left out, and the incident is still valid.
    {
      name: 'leaves out an optional penalty text sent as spaces, and the incident passes',
      changes: { penalidade: '   ' },
      blankField: 'penaltyText',
      expectedValidation: { isValid: true },
    },
  ];

  it.each(blankTextScenarios)('$name', ({ changes, blankField, expectedValidation }) => {
    // Arrange: the incidents mapping and the answer with this row's blank text.
    const mappings = buildIncidentsMapping();
    const answer = buildPenaltyAnswer(changes);

    // Act: map it, then validate the incidents as the store does.
    const result = applyFlexMapping(mappings, { direcao: answer }, 0);
    const incidents = result.ok ? (result.shapes.incidents as { entries: object[] }) : undefined;
    const validation = validateDataShape('incidents', incidents);

    // Assert: the blank field is absent, not "", and the validation is as this row says.
    expect(
      incidents?.entries[0],
      'blank text must be left out, never written as ""',
    ).not.toHaveProperty(blankField);
    expect(validation, 'the incidents must validate as this row says').toMatchObject(
      expectedValidation,
    );
  });

  it('names the required reason as missing, not as too short', () => {
    // Arrange: the reason sent as "&nbsp;".
    const mappings = buildIncidentsMapping();
    const answer = buildPenaltyAnswer({ motivo: '&nbsp;' });

    // Act: map and validate.
    const result = applyFlexMapping(mappings, { direcao: answer }, 0);
    const validation = validateDataShape(
      'incidents',
      result.ok ? result.shapes.incidents : undefined,
    );

    // Assert: the validation's message is about a missing field, not "valor abaixo do mínimo".
    const errorMessage = validation.isValid ? '' : validation.errorMessage;
    expect(errorMessage, 'the reason must be named at its path').toContain(
      'incidents.entries.0.reason',
    );
    expect(errorMessage, 'the reason must not read as too short').not.toContain('mínimo');
  });
});
