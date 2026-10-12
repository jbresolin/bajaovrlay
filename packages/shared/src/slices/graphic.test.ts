/**
 * The OGraf manifest fields the server reads (packages/shared)
 *
 * What this module is for:
 *   Every graphic is an EBU OGraf package with a manifest (`*.ograf.json`).
 *   OGrafManifestSchema names the few manifest fields BajaOvrLay relies on: the id,
 *   name and main module; `schema`, the JSON Schema of the data the graphic shows,
 *   which the server uses to refuse bad data before it reaches the screen; and
 *   `v_baja`, our vendor field saying which layer the graphic goes on by default.
 *   Every other field of the manifest passes through untouched.
 *
 * What these tests prove:
 *   - The race clock's manifest, with its data schema and its `v_baja` field, is
 *     accepted and comes back with every field as written.
 *   - A manifest with neither `schema` nor `v_baja` is still accepted (both are
 *     optional in OGraf, and older packages have no `v_baja`).
 *   - `v_baja` may give only the layer, without a category, and may name an update rule.
 *   - A `v_baja` whose layer id, category or update rule is not a non-empty text, and a
 *     `schema` that is not an object, are refused, and the failure names the field.
 *
 * What these tests deliberately do not cover:
 *   - Whether the layer `v_baja` names exists, and the fall back to the fullscreen
 *     layer; the server's graphics discovery (apps/server/src/core/store/) does that.
 *   - Whether `schema` is a valid JSON Schema; Ajv in the server finds that out.
 *   - Whether the server knows the update rule a manifest names; the server's
 *     updateRules folder (apps/server/src/core/store/updateRules/) checks that.
 *   - The full OGraf manifest schema, which the race-clock package's manifest test
 *     checks against the EBU files.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { OGrafManifestSchema } from './graphic.js';

/** Builds the part of the race clock's manifest that matters here, as it is on disk. */
function buildRaceClockManifest() {
  return {
    $schema: 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json',
    id: 'baja-race-clock',
    version: '0.1.0',
    name: 'Relógio de prova',
    main: 'race-clock.js',
    supportsRealTime: true,
    schema: {
      type: 'object',
      properties: {
        sessionName: { type: 'string', title: 'Nome da sessão' },
        state: { type: 'string', enum: ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'] },
      },
      required: ['sessionName', 'state'],
      additionalProperties: false,
    },
    v_baja: { defaultLayerId: 'clock', category: 'clock' },
  };
}

describe('OGrafManifestSchema', () => {
  it('accepts the race clock manifest and keeps its data schema and v_baja as written', () => {
    // Arrange: the race clock's manifest, declaring the clock layer as its default.
    const raceClockManifest = buildRaceClockManifest();

    // Act: check the manifest.
    const result = OGrafManifestSchema.safeParse(raceClockManifest);

    // Assert: it is accepted, and nothing was dropped or changed on the way.
    expect(result.success, 'the race clock manifest must be accepted').toBe(true);
    expect(result.data, 'every manifest field must come back as written').toEqual(
      raceClockManifest,
    );
    expect(result.data?.v_baja?.defaultLayerId, 'the default layer must be readable').toBe('clock');
    expect(result.data?.schema, 'the data schema must be readable by the server').toEqual(
      raceClockManifest.schema,
    );
  });

  const acceptedManifestScenarios = [
    // A package from before v_baja existed, with no data to fill in either.
    {
      name: 'accepts a manifest with neither a data schema nor v_baja',
      manifest: { id: 'baja-sponsor-logo', name: 'Logo do patrocinador', main: 'sponsor-logo.js' },
    },
    // The category is optional: a package may only say where it goes.
    {
      name: 'accepts a v_baja that gives only the default layer',
      manifest: {
        id: 'baja-team-lower-third',
        name: 'Tarja da equipe',
        main: 'team-lower-third.js',
        v_baja: { defaultLayerId: 'lower-third' },
      },
    },
    // The race clock names the server rule its updates run through; the name is kept
    // as written, and whether the server knows it is the server's check, not this one.
    {
      name: 'accepts a v_baja that names an update rule',
      manifest: {
        ...buildRaceClockManifest(),
        v_baja: { defaultLayerId: 'clock', category: 'clock', updateRule: 'carryClockForward' },
      },
    },
    // v_baja exists but says nothing about the layer; the server then falls back.
    {
      name: 'accepts a v_baja that gives only the category',
      manifest: {
        id: 'baja-results-table',
        name: 'Tabela de resultados',
        main: 'results-table.js',
        v_baja: { category: 'results' },
      },
    },
  ];

  it.each(acceptedManifestScenarios)('$name', ({ manifest }) => {
    // Arrange: a manifest as a package author wrote it (from the table above).
    const manifestFromDisk = manifest;

    // Act: check the manifest.
    const result = OGrafManifestSchema.safeParse(manifestFromDisk);

    // Assert: it is accepted unchanged.
    expect(result.success, 'schema and v_baja are optional parts of a manifest').toBe(true);
    expect(result.data, 'the accepted manifest must not be altered').toEqual(manifestFromDisk);
  });

  const refusedManifestScenarios = [
    // A layer id is the text id of a layer; a z-index typed by mistake is not one.
    {
      name: 'refuses a v_baja whose default layer is a number, naming defaultLayerId',
      manifest: { ...buildRaceClockManifest(), v_baja: { defaultLayerId: 30 } },
      fieldNamedInTheFailure: 'defaultLayerId',
    },
    // An empty layer id can never match a layer.
    {
      name: 'refuses a v_baja whose default layer is empty, naming defaultLayerId',
      manifest: { ...buildRaceClockManifest(), v_baja: { defaultLayerId: '' } },
      fieldNamedInTheFailure: 'defaultLayerId',
    },
    // The category groups graphics in the control page, so it must be a text too.
    {
      name: 'refuses a v_baja whose category is a list, naming category',
      manifest: {
        ...buildRaceClockManifest(),
        v_baja: { defaultLayerId: 'clock', category: ['clock'] },
      },
      fieldNamedInTheFailure: 'category',
    },
    // An update rule is one name; an empty text can never be the name of a rule.
    {
      name: 'refuses a v_baja whose update rule is empty, naming updateRule',
      manifest: {
        ...buildRaceClockManifest(),
        v_baja: { defaultLayerId: 'clock', category: 'clock', updateRule: '' },
      },
      fieldNamedInTheFailure: 'updateRule',
    },
    // A list of rules is not supported: one graphic, at most one rule.
    {
      name: 'refuses a v_baja whose update rule is a list, naming updateRule',
      manifest: {
        ...buildRaceClockManifest(),
        v_baja: { defaultLayerId: 'clock', category: 'clock', updateRule: ['carryClockForward'] },
      },
      fieldNamedInTheFailure: 'updateRule',
    },
    // The data schema is a JSON Schema object; an address pointing at one is not.
    {
      name: 'refuses a data schema that is a text, naming schema',
      manifest: { ...buildRaceClockManifest(), schema: './race-clock.schema.json' },
      fieldNamedInTheFailure: 'schema',
    },
  ];

  it.each(refusedManifestScenarios)('$name', ({ manifest, fieldNamedInTheFailure }) => {
    // Arrange: a manifest with one mistake (from the table above).
    const brokenManifest = manifest;

    // Act: check it and turn the failure into readable text.
    const result = OGrafManifestSchema.safeParse(brokenManifest);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the field that is wrong.
    expect(result.success, 'a manifest with a mistyped field must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the field that is wrong').toContain(
      fieldNamedInTheFailure,
    );
  });
});
