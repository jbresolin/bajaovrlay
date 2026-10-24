// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/team-card)
 *
 * What this module is for:
 *   team-card.ograf.json describes the team card's data as JSON Schema, for renderers and
 *   for the control page's generated form; teamCardModel.ts checks the same data with Zod
 *   when `load` and `updateAction` receive it. If the two disagreed, the form could offer
 *   a value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: a complete card; the bare minimum; the
 *     plate on and off; a card with the state but no city; and a car number of 0, a
 *     fractional car number, a missing team, a missing school, a plate written as text,
 *     an image address that is not text, and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest (settings, titles, roles, durations, the OGraf schema
 *     itself); teamCardManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import teamCardManifest from '../team-card.ograf.json';
import { parseCompleteTeamCardData, type TeamCardData } from './teamCardModel.js';

/** Builds car 7 with everything the Cadastros hold: Reptiles Baja PUC-Rio, Rio de Janeiro. */
function createReptilesTeamCardData(): TeamCardData {
  return {
    carNumber: 7,
    teamName: 'Reptiles Baja PUC-Rio',
    schoolName: 'PUC-Rio',
    city: 'Rio de Janeiro',
    state: 'RJ',
    carPhotoUrl: '/media/0b6f3c2a-photo-car-7',
    logoUrl: '/media/5d1e9a40-logo-reptiles',
    logoOnLightPlate: true,
  };
}

const dataAgreementScenarios = [
  // The everyday card from Cadastros must pass both checks.
  { name: 'both accept a complete card', data: createReptilesTeamCardData(), isValid: true },
  // Every optional field really is optional in both.
  {
    name: 'both accept the car, the team and the school alone',
    data: { carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB' },
    isValid: true,
  },
  // The plate switched off, a light logo on the panel.
  {
    name: 'both accept the plate switched off',
    data: { ...createReptilesTeamCardData(), logoOnLightPlate: false },
    isValid: true,
  },
  // A state without a city is allowed: the place line shows the state alone.
  {
    name: 'both accept a state without a city',
    data: { ...createReptilesTeamCardData(), city: undefined },
    isValid: true,
  },
  // Car numbers start at 1 in both.
  {
    name: 'both refuse car number 0',
    data: { ...createReptilesTeamCardData(), carNumber: 0 },
    isValid: false,
  },
  // Car numbers are whole numbers in both.
  {
    name: 'both refuse a fractional car number',
    data: { ...createReptilesTeamCardData(), carNumber: 7.5 },
    isValid: false,
  },
  // A missing required field fails both.
  {
    name: 'both refuse data without the team name',
    data: { ...createReptilesTeamCardData(), teamName: undefined },
    isValid: false,
  },
  // The school is required in both.
  {
    name: 'both refuse data without the school',
    data: { ...createReptilesTeamCardData(), schoolName: undefined },
    isValid: false,
  },
  // The plate is a boolean; text would be a binding to the wrong field.
  {
    name: 'both refuse a plate written as text',
    data: { ...createReptilesTeamCardData(), logoOnLightPlate: 'true' },
    isValid: false,
  },
  // An image address must be text; a number would be a media id bound by mistake.
  {
    name: 'both refuse a logo address that is not text',
    data: { ...createReptilesTeamCardData(), logoUrl: 5 },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createReptilesTeamCardData(), photoUrl: '/media/0b6f3c2a-photo-car-7' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(teamCardManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteTeamCardData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
