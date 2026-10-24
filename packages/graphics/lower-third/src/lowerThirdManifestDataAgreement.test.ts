// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/lower-third)
 *
 * What this module is for:
 *   lower-third.ograf.json describes the lower third's data as JSON Schema, for renderers
 *   and for the control page's generated form; lowerThirdModel.ts checks the same data
 *   with Zod when `load` and `updateAction` receive it. If the two disagreed, the form
 *   could offer a value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: a complete lower third, a name with a
 *     role, a name with a team line, the bare minimum (a name); a missing name, an empty
 *     name, a name of blanks, a role that is not text, a team line that is not text and
 *     an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest (settings, titles, durations, the OGraf schema itself);
 *     lowerThirdManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1) like its sibling; it
 *     draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import lowerThirdManifest from '../lower-third.ograf.json';
import { type LowerThirdData, parseCompleteLowerThirdData } from './lowerThirdModel.js';

/** Builds a team captain's lower third: Mariana Costa, captain of Baja UFMG. */
function createTeamCaptainData(): LowerThirdData {
  return { name: 'Mariana Costa', role: 'Capitã da equipe', teamLine: 'Baja UFMG · UFMG' };
}

const dataAgreementScenarios = [
  // The everyday lower third must pass both checks.
  { name: 'both accept a complete lower third', data: createTeamCaptainData(), isValid: true },
  // The typical item from Cadastros: a person's name and role.
  {
    name: 'both accept a name with a role',
    data: { name: 'Ana Paula Ribeiro', role: 'Narradora' },
    isValid: true,
  },
  // A team line without a role is a layout of its own; both must take it.
  {
    name: 'both accept a name with a team line',
    data: { name: 'Mariana Costa', teamLine: 'Baja UFMG · UFMG' },
    isValid: true,
  },
  // Every optional field really is optional in both.
  {
    name: 'both accept the bare minimum: a name',
    data: { name: 'Ana Paula Ribeiro' },
    isValid: true,
  },
  // A missing required field fails both.
  { name: 'both refuse data without a name', data: { role: 'Narradora' }, isValid: false },
  // An empty name fails both (the manifest's "pattern", Zod's regex).
  { name: 'both refuse an empty name', data: { name: '' }, isValid: false },
  // A name of blanks fails both: it would be an empty pill on air.
  { name: 'both refuse a name of blanks', data: { name: '   ' }, isValid: false },
  // A role must be text; a number would be a binding to the wrong attribute.
  {
    name: 'both refuse a role that is not text',
    data: { name: 'Mariana Costa', role: 2 },
    isValid: false,
  },
  // A team line must be text too.
  {
    name: 'both refuse a team line that is not text',
    data: { name: 'Mariana Costa', teamLine: 2 },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createTeamCaptainData(), team: 'Baja UFMG' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(lowerThirdManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteLowerThirdData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
