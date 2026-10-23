// @vitest-environment node
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
 *     race clock goes on the clock layer and in the clock category, and that an update
 *     of it runs the server's `carryClockForward` rule (the clock must not jump).
 *   - The manifest tells the control page's generated form, in a `v_baja` field on the
 *     property itself, that the reference time is typed as mm:ss (`unit: 'ms'`) and that
 *     the reference moment may be left to the server (`role: 'wallClock'`); no other
 *     field carries such a hint. The official schema accepts a `v_` field there too.
 *   - The play and stop durations in the manifest are the theme's `--motion-in` and
 *     `--motion-out`, read from the text of packages/theme/ardosia/tokens.css: the
 *     timelines take their lengths from those tokens at run time, and the manifest,
 *     which is static JSON, must promise a renderer the same numbers.
 *   - Every data field has a pt-BR title.
 *   - The text field (key sessionName) is titled "Título" and its description says it is
 *     the text above the clock, with two examples; the two optional fields say in their
 *     descriptions what happens when they are left out or switched off.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod validation accept and refuse the same
 *     payloads; raceClockManifestDataAgreement.test.ts runs the same payloads through both.
 *   - That a real renderer can load the module named in "main"; the Playwright test
 *     e2e/raceClockLifecycle.e2e.ts loads it from dist/ the way a renderer does.
 *   - The page: this file runs in plain Node (the pragma on line 1) since it draws
 *     nothing and reads the token file from disk, which Vitest's page environment would
 *     hand over as an empty stylesheet.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import ografManifestSchema from '../ograf-schema/graphics/schema.json';
import raceClockManifest from '../race-clock.ograf.json';
import { createOGrafSchemaValidator } from './ografSchemaValidator.testSupport.js';

/**
 * The text of packages/theme/ardosia/tokens.css, found through the theme package's own
 * exports (never by a path into another package's folder).
 */
function readArdosiaTokensCssText(): string {
  const resolveLikeNode = createRequire(import.meta.url);
  return readFileSync(resolveLikeNode.resolve('@bajaovrlay/theme/ardosia/tokens.css'), 'utf8');
}

/**
 * Reads a duration token (`--motion-in: 400ms;`) from the text of tokens.css, in
 * milliseconds. Throws when the token is not there: a manifest checked against a
 * missing token would pass for the wrong reason.
 */
function readDurationTokenInMilliseconds(tokenName: string): number {
  const tokensCssText = readArdosiaTokensCssText();
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)ms;`).exec(tokensCssText);
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
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

  it('declares the clock layer, the clock category and its update rule in the v_baja vendor field', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read BajaOvrLay's own field, which OGraf allows because its name starts with v_.
    const bajaVendorFields = raceClockManifest.v_baja;

    // Assert: the server reads the default layer and the category from the first two.
    // The third names the server's rule that keeps the time on screen when an update
    // stops, starts or turns the clock, so the clock on air never jumps.
    expect(
      bajaVendorFields,
      'the race clock must ask for the clock layer, the clock category and carryClockForward',
    ).toEqual({ defaultLayerId: 'clock', category: 'clock', updateRule: 'carryClockForward' });
  });

  it('tells the control page which field is a duration and which four fields are the clock', () => {
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
    // reference moment is a wall-clock field (so the form offers "at the take"). Each of
    // the four clock fields has its role, which is how "Edição rápida" finds them to show
    // the time on screen without knowing this graphic's field names.
    expect(
      hintsByField,
      'the four clock fields, and no other field, must carry a v_baja hint, each with its role',
    ).toEqual({
      clockMode: { role: 'clockMode' },
      referenceTimeMs: { unit: 'ms', role: 'clockTime' },
      referenceWallClockMs: { role: 'wallClock' },
      running: { role: 'clockRunning' },
    });
  });

  it('declares the play and stop lengths the theme sets in --motion-in and --motion-out', () => {
    // Arrange: the two durations as packages/theme/ardosia/tokens.css writes them. The
    // timelines read the same tokens from the page at run time (raceClockAnimations.ts),
    // so the manifest tells the truth only while it matches the file.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = raceClockManifest.actionDurations;

    // Assert: the manifest says exactly what the theme's tokens say.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
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
      sessionName: 'Título',
      state: 'Bandeira',
      clockMode: 'Modo do relógio',
      referenceTimeMs: 'Tempo de referência',
      referenceWallClockMs: 'Horário da referência (ms desde 1970)',
      running: 'Relógio correndo',
      lapsCompletedByLeader: 'Voltas do líder',
      showFlagBand: 'Mostrar faixa da bandeira',
    });
  });

  it('says in the form that the text field is the title above the clock, with examples', () => {
    // Arrange: the field the graphic draws above the clock. Its key stays sessionName so
    // the items saved before BAJAOVRLAY-36 keep working; only the words the operator
    // reads changed, because "Nome da sessão" did not say where the text shows.
    const titleField = raceClockManifest.schema.properties.sessionName;

    // Act: read the title and the description the generated form shows for it.
    const titleAndDescription = { title: titleField.title, description: titleField.description };

    // Assert: the title is "Título" and the description says where it shows, with examples.
    expect(titleAndDescription, 'the field must say it is the text above the clock').toEqual({
      title: 'Título',
      description: 'Texto acima do relógio, ex.: Enduro de Resistência, Classificação',
    });
  });

  it('describes the two optional fields: the leader’s laps and the flag band switch', () => {
    // Arrange: the two fields an operator may leave out. Neither is in "required", so
    // the form offers "limpar" on them and sends nothing for a cleared one.
    const lapsField = raceClockManifest.schema.properties.lapsCompletedByLeader;
    const flagBandField = raceClockManifest.schema.properties.showFlagBand;

    // Act: read what the form shows for each, and whether the manifest requires them.
    const optionalFieldsAsShown = {
      laps: { type: lapsField.type, title: lapsField.title, description: lapsField.description },
      flagBand: {
        type: flagBandField.type,
        title: flagBandField.title,
        description: flagBandField.description,
        default: flagBandField.default,
      },
      requiredFields: raceClockManifest.schema.required,
    };

    // Assert: the laps are an optional integer whose absence hides the count; the band
    // switch is a boolean, on by default, whose description says the card gets lower.
    expect(
      optionalFieldsAsShown,
      'both fields must be optional and say what leaving them out does',
    ).toEqual({
      laps: {
        type: 'integer',
        title: 'Voltas do líder',
        description: 'Opcional; ausente, a contagem de voltas não aparece.',
      },
      flagBand: {
        type: 'boolean',
        title: 'Mostrar faixa da bandeira',
        description: 'Desligada, o cartão fica sem a faixa e 40 px mais baixo.',
        default: true,
      },
      requiredFields: [
        'sessionName',
        'state',
        'clockMode',
        'referenceTimeMs',
        'referenceWallClockMs',
        'running',
      ],
    });
  });
});
