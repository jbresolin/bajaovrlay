/**
 * The OGraf manifest, race-clock.ograf.json (packages/graphics/race-clock)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the
 *   module to load, the render modes it supports, how long its animations take and
 *   the JSON Schema of its data (which a control UI can also use to build a form).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in
 *     ograf-schema/, so this runs offline), and a manifest with a required field
 *     removed fails it, so the check has teeth.
 *   - The settings the brief fixes: id, real-time only, one step.
 *   - The manifest tells the BajaOvrLay server, in its vendor field `v_baja`, that the
 *     race clock goes on the clock layer and in the clock category.
 *   - The manifest tells the control page's generated form, in a `v_baja` field on the
 *     property itself, that the reference time is typed as mm:ss (`unit: 'ms'`) and that
 *     the reference moment may be left to the server (`role: 'wallClock'`); no other
 *     field carries such a hint. The official schema accepts a `v_` field there too.
 *   - The play and stop durations in the manifest are the real animation lengths.
 *   - Every data field has a pt-BR title, and the manifest's data schema accepts and
 *     refuses exactly the same payloads as the graphic's own validation.
 *
 * What these tests deliberately do not cover:
 *   - That a real renderer can load the module named in "main"; the Playwright test
 *     e2e/raceClockLifecycle.e2e.ts loads it from dist/ the way a renderer does.
 */
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import gddBasicTypesSchema from '../ograf-schema/gdd/basic-types.json';
import gddTypesSchema from '../ograf-schema/gdd/gdd-types.json';
import gddObjectSchema from '../ograf-schema/gdd/object.json';
import ografManifestSchema from '../ograf-schema/graphics/schema.json';
import ografActionSchema from '../ograf-schema/lib/action.json';
import ografBooleanConstraintSchema from '../ograf-schema/lib/constraints/boolean.json';
import ografNumberConstraintSchema from '../ograf-schema/lib/constraints/number.json';
import raceClockManifest from '../race-clock.ograf.json';
import { playInDurationMs, stopOutDurationMs } from './raceClockAnimations.js';
import { parseCompleteRaceClockData, type RaceClockData } from './raceClockModel.js';

/**
 * Builds a JSON Schema validator for the 2020-12 draft the OGraf schemas declare, with
 * every OGraf schema registered under its published $id so no $ref goes to the network.
 */
function createOGrafSchemaValidator() {
  // These are OGraf annotations, not 2020-12 keywords: `example` (lib/action.json) and
  // the GDD form hints a data schema may carry (gdd/object.json). Strict mode refuses
  // unknown keywords, so it is told they are annotations that validate nothing.
  // `v_baja` is BajaOvrLay's own vendor field on a data property. The official manifest
  // schema allows any `v_` field there by pattern, but when the data schema is compiled
  // on its own (the agreement tests below) strict mode knows no such pattern and would
  // stop with `strict mode: unknown keyword: "v_baja"`.
  const validator = new Ajv2020({ allErrors: true });
  const annotationsThatValidateNothing = [
    'example',
    'gddType',
    'gddOptions',
    'hidden',
    'order',
    'v_baja',
  ];
  for (const annotation of annotationsThatValidateNothing) {
    validator.addKeyword(annotation);
  }
  validator.addSchema([
    gddBasicTypesSchema,
    gddTypesSchema,
    gddObjectSchema,
    ografActionSchema,
    ografBooleanConstraintSchema,
    ografNumberConstraintSchema,
  ]);
  return validator;
}

/** Builds the data the server sends when the enduro is under green flag, 1:05:00 in. */
function createGreenFlagEnduroData(): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: Date.parse('2026-05-16T14:30:00.000Z'),
    running: true,
    lapsCompletedByLeader: 12,
  };
}

describe('race-clock.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(raceClockManifest);

    // Assert: it passes; on failure, the schema errors are shown in the message.
    expect(
      isManifestValid,
      `the manifest must pass the OGraf v1 schema: ${validator.errorsText(validateManifest.errors)}`,
    ).toBe(true);
  });

  it('fails the official schema when a required field is missing, so the check has teeth', () => {
    // Arrange: the same validator, and a copy of the manifest without "main".
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...raceClockManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('race-clock.ograf.json settings', () => {
  it('declares the id, render modes and step count the brief fixes', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: raceClockManifest.id,
      main: raceClockManifest.main,
      supportsRealTime: raceClockManifest.supportsRealTime,
      supportsNonRealTime: raceClockManifest.supportsNonRealTime,
      stepCount: raceClockManifest.stepCount,
    };

    // Assert: they match the brief, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare the settings fixed in the brief').toEqual({
      id: 'baja-race-clock',
      main: 'race-clock.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('declares the clock layer and the clock category in the v_baja vendor field', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read BajaOvrLay's own field, which OGraf allows because its name starts with v_.
    const bajaVendorFields = raceClockManifest.v_baja;

    // Assert: the server reads the default layer and the category from exactly these two.
    expect(
      bajaVendorFields,
      'the race clock must ask for the clock layer and the clock category',
    ).toEqual({ defaultLayerId: 'clock', category: 'clock' });
  });

  it('tells the generated form which field is a duration and which is a wall-clock moment', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(raceClockManifest.schema.properties);

    // Act: collect the v_baja hint of every field that has one.
    const hintsByField: Record<string, unknown> = {};
    for (const [fieldName, field] of dataFields) {
      if ('v_baja' in field) {
        hintsByField[fieldName] = field.v_baja;
      }
    }

    // Assert: the reference time is in milliseconds (so the form shows mm:ss) and the
    // reference moment is a wall-clock field (so the form offers "at the take").
    expect(hintsByField, 'only the two reference fields must carry a v_baja hint').toEqual({
      referenceTimeMs: { unit: 'ms' },
      referenceWallClockMs: { role: 'wallClock' },
    });
  });

  it('declares the real play and stop animation lengths', () => {
    // Arrange: the animation lengths come from raceClockAnimations.ts, which builds them.

    // Act: read what the manifest promises a renderer.
    const declaredDurations = raceClockManifest.actionDurations;

    // Assert: the manifest says exactly what the animations really take.
    expect(declaredDurations, 'the manifest durations must be the real animation lengths').toEqual([
      { type: 'playAction', duration: playInDurationMs },
      { type: 'stopAction', duration: stopOutDurationMs },
    ]);
  });

  it('gives every data field a pt-BR title', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(raceClockManifest.schema.properties);

    // Act: collect each field's title.
    const titlesByField = Object.fromEntries(
      dataFields.map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: each field has the pt-BR title an operator form will show.
    expect(titlesByField, 'every data field must carry a pt-BR title').toEqual({
      sessionName: 'Nome da sessão',
      state: 'Bandeira',
      clockMode: 'Modo do relógio',
      referenceTimeMs: 'Tempo de referência',
      referenceWallClockMs: 'Horário da referência (ms desde 1970)',
      running: 'Relógio correndo',
      lapsCompletedByLeader: 'Voltas completadas pelo líder',
    });
  });
});

const dataAgreementScenarios = [
  // The everyday payload must pass both checks.
  { name: 'both accept complete enduro data', data: createGreenFlagEnduroData(), isValid: true },
  // The one optional field really is optional in both.
  {
    name: 'both accept data without the leader lap count',
    data: { ...createGreenFlagEnduroData(), lapsCompletedByLeader: undefined },
    isValid: true,
  },
  // One row per flag state the graphic draws, so a value dropped or misspelled in the
  // manifest's enum (or in Zod) fails here.
  // Before the start: the state a session is created in.
  {
    name: 'both accept the pre-start state',
    data: { ...createGreenFlagEnduroData(), state: 'pre' },
    isValid: true,
  },
  // Racing: the most common state; listed again here so all six sit together.
  {
    name: 'both accept the green flag',
    data: { ...createGreenFlagEnduroData(), state: 'green' },
    isValid: true,
  },
  // Caution: thrown on track incidents.
  {
    name: 'both accept the yellow flag',
    data: { ...createGreenFlagEnduroData(), state: 'yellow' },
    isValid: true,
  },
  // Session stopped: the clock is usually held.
  {
    name: 'both accept the red flag',
    data: { ...createGreenFlagEnduroData(), state: 'red' },
    isValid: true,
  },
  // The leader has crossed the line.
  {
    name: 'both accept the checkered flag',
    data: { ...createGreenFlagEnduroData(), state: 'checkered' },
    isValid: true,
  },
  // After the session: results are final.
  {
    name: 'both accept the finished state',
    data: { ...createGreenFlagEnduroData(), state: 'finished' },
    isValid: true,
  },
  // A state outside the six must fail both, or the form would offer a value the graphic refuses.
  {
    name: 'both refuse an unknown flag state',
    data: { ...createGreenFlagEnduroData(), state: 'blue' },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createGreenFlagEnduroData(), laps: 12 },
    isValid: false,
  },
  // Milliseconds are whole numbers in both.
  {
    name: 'both refuse a fractional clock reading',
    data: { ...createGreenFlagEnduroData(), referenceTimeMs: 1.5 },
    isValid: false,
  },
  // A lap count below zero is meaningless in both.
  {
    name: 'both refuse a negative lap count',
    data: { ...createGreenFlagEnduroData(), lapsCompletedByLeader: -1 },
    isValid: false,
  },
  // A missing required field fails both.
  {
    name: 'both refuse data without the running flag',
    data: { ...createGreenFlagEnduroData(), running: undefined },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(raceClockManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteRaceClockData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
