// @vitest-environment node
/**
 * The OGraf manifest, bracket.ograf.json (packages/graphics/bracket)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the module
 *   to load, the render modes, the number of steps, how long its animations take and the
 *   JSON Schema of its data (which the control page turns into the item form, and which
 *   decides which source paths the item editor offers for the rounds). The bracket's steps
 *   depend on its rounds, so its manifest says OGraf's "dynamic" (-1) and names the step
 *   counter the server counts them with.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 schema (vendored in the kit, so offline),
 *     and a copy without "main" fails it, so the check has teeth.
 *   - The settings: id `baja-bracket`, main `bracket.js`, real-time only, `stepCount` -1;
 *     `v_baja` puts it on the fullscreen layer in the standings category and names the
 *     `bracketSteps` counter, one the shared registry knows.
 *   - The rounds suggest the brackets' whole rounds, live; and the brackets' rounds fit the
 *     field by the item editor's own rule, while the standings list does not.
 *   - The durations are the theme's: a play is the longest step, a board lifting out and the
 *     next board of 32 cascading in (`--motion-out` + `--motion-lead` + 31 ×
 *     `--motion-row-stagger` + `--motion-in`), stop `--motion-out`.
 *   - Every field has a pt-BR title, the rounds alone are required, the title defaults to
 *     "CHAVEAMENTO", and an unknown field is refused at the top.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod model agree:
 *     bracketManifestDataAgreement.test.ts runs the same payloads through both.
 *   - That a renderer can load "main": e2e/bracketLifecycle.e2e.ts does it from dist/.
 *   - The page: this file runs in plain Node (line 1) since it reads the token file from disk.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import {
  type BindingFieldValue,
  findProblemInBindingForDataSchemaField,
  findStepCounter,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import bracketManifest from '../bracket.ograf.json';

/** The text of packages/theme/ardosia/tokens.css, found through the theme package's exports. */
function readArdosiaTokensCssText(): string {
  const resolveLikeNode = createRequire(import.meta.url);
  return readFileSync(resolveLikeNode.resolve('@bajaovrlay/theme/ardosia/tokens.css'), 'utf8');
}

/**
 * Reads a duration token (`--motion-in: 400ms;`) from tokens.css. Throws when the token is
 * not there: a manifest checked against a missing token would pass for the wrong reason.
 */
function readDurationTokenMs(tokenName: string): number {
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)ms;`).exec(
    readArdosiaTokensCssText(),
  );
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
}

/** A live binding of one whole list of the simulator, with no transform. */
function buildLiveBinding(shapeKey: 'brackets' | 'standings', path: string): BindingFieldValue {
  return { kind: 'binding', sourceId: 'simulador-enduro', shapeKey, path, isLive: true };
}

describe('bracket.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(bracketManifest);

    // Assert: it passes; on failure the schema's errors are in the message.
    expect(
      isManifestValid,
      `the manifest must pass the OGraf v1 schema: ${validator.errorsText(validateManifest.errors)}`,
    ).toBe(true);
  });

  it('fails the official schema when a required field is missing, so the check has teeth', () => {
    // Arrange: the same validator, and a copy of the manifest without "main".
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...bracketManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('bracket.ograf.json settings', () => {
  it('declares the id, name, main, render modes and a step count counted from the data', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: bracketManifest.id,
      name: bracketManifest.name,
      main: bracketManifest.main,
      supportsRealTime: bracketManifest.supportsRealTime,
      supportsNonRealTime: bracketManifest.supportsNonRealTime,
      stepCount: bracketManifest.stepCount,
    };

    // Assert: the settings, "main" naming the built module, OGraf's "dynamic" step count.
    expect(fixedSettings, 'the manifest must declare the fixed settings').toEqual({
      id: 'baja-bracket',
      name: 'Chaveamento',
      main: 'bracket.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: -1,
    });
  });

  it('declares the fullscreen layer, the standings category and a step counter the server knows', () => {
    // Arrange: nothing to set up.

    // Act: read BajaOvrLay's own field, and look its counter up in the shared registry.
    const bajaVendorFields = bracketManifest.v_baja;
    const stepCounter = findStepCounter(bajaVendorFields.stepCounter);

    // Assert: the layer, the category and the counter the server reads.
    expect(bajaVendorFields, 'the bracket goes on the fullscreen layer').toEqual({
      defaultLayerId: 'fullscreen',
      category: 'standings',
      stepCounter: 'bracketSteps',
    });
    expect(stepCounter, 'the shared registry must know the counter').toBeDefined();
  });

  it('suggests the brackets’ whole rounds, live, and hints nothing else', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(bracketManifest.schema.properties);

    // Act: collect the v_baja hint of every field that has one.
    const hintsByField: Record<string, unknown> = {};
    for (const [fieldName, field] of dataFields) {
      if ('v_baja' in field) {
        hintsByField[fieldName] = field.v_baja;
      }
    }

    // Assert: the rounds, live (a result arriving reaches the air by itself).
    expect(hintsByField, 'the rounds suggest the brackets, live').toEqual({
      rounds: { suggestedBinding: { shapeKey: 'brackets', path: 'rounds', isLive: true } },
    });
  });

  const bindingFitScenarios = [
    // The item's recipe: the brackets' whole rounds.
    {
      name: 'takes the brackets’ rounds',
      binding: buildLiveBinding('brackets', 'rounds'),
      fits: true,
    },
    // A list of teams is not a list of rounds.
    {
      name: 'refuses the standings list',
      binding: buildLiveBinding('standings', 'entries'),
      fits: false,
    },
  ];

  it.each(bindingFitScenarios)('$name', ({ binding, fits }) => {
    // Arrange: the manifest's data schema, as the item editor and the server read it.
    const dataSchema = bracketManifest.schema;

    // Act: ask the shared rule what is wrong with the binding on the rounds field.
    const problem = findProblemInBindingForDataSchemaField(binding, dataSchema, 'rounds');

    // Assert: no problem for the rounds; a problem for the standings.
    expect(
      problem === undefined,
      `the binding must ${fits ? '' : 'not '}fit: ${String(problem)}`,
    ).toBe(fits);
  });

  it('declares a play as a board’s lift-out then the next board’s whole cascade, and stop as --motion-out', () => {
    // Arrange: the tokens as tokens.css writes them.
    const leadMs = readDurationTokenMs('--motion-lead');
    const rowStaggerMs = readDurationTokenMs('--motion-row-stagger');
    const motionInMs = readDurationTokenMs('--motion-in');
    const motionOutMs = readDurationTokenMs('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = bracketManifest.actionDurations;

    // Assert: 250 + 100 + 31 × 30 + 400 = 1680 and 250 in Ardósia: the longest step, Próximo
    // from a board to the next board of 32 (the old cards lift out, then the new cascade in).
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionOutMs + leadMs + 31 * rowStaggerMs + motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('gives every field a pt-BR title, requires the rounds alone and defaults the title', () => {
    // Arrange: the data fields.
    const properties = bracketManifest.schema.properties;

    // Act: collect each field's title.
    const titlesByField = Object.fromEntries(
      Object.entries(properties).map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: the pt-BR titles, the title one line, the one required field, the default
    // title, strict top; each round needs only what the brackets always carry.
    expect(titlesByField, 'every field must carry a pt-BR title').toEqual({
      rounds: 'Fases',
      title: 'Título',
    });
    expect(properties.title.gddType, 'the title is one line').toBe('single-line');
    expect(bracketManifest.schema.required, 'only the rounds are required').toEqual(['rounds']);
    expect(properties.title.default, 'the title defaults to CHAVEAMENTO').toBe('CHAVEAMENTO');
    expect(properties.rounds.items.required, 'a round needs its name and matches').toEqual([
      'name',
      'matches',
    ]);
    expect(
      bracketManifest.schema.additionalProperties,
      'a field the bracket does not know is refused at the top level',
    ).toBe(false);
  });
});
