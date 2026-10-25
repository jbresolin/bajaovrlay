// @vitest-environment node
/**
 * The OGraf manifest, podium.ograf.json (packages/graphics/podium)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the module
 *   to load, the render modes, the number of steps, how long its animations take and the
 *   JSON Schema of its data (which the control page turns into the item form, and which
 *   decides which source lists the item editor offers for the entries).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 schema (vendored in the kit, so offline),
 *     and a copy without "main" fails it, so the check has teeth.
 *   - The settings: id `baja-podium`, main `podium.js`, real-time only, four steps (the
 *     head alone, then the 3rd, the 2nd, the 1st), the same number podiumModel steps by;
 *     `v_baja` puts it on the fullscreen layer in the standings category.
 *   - The entries suggest the positions list, frozen at the take; no other field hints.
 *   - Both a positions list and a standings list fit the entries field by the item editor's
 *     own rule (the shared findProblemInBindingForDataSchemaField), each through topN 3
 *     then withTeamLogos, the item's recipe; the score parts do not.
 *   - The play and stop durations are the theme's: a step is `--motion-in`, stop is
 *     `--motion-out`, both read from packages/theme/ardosia/tokens.css.
 *   - Every field has a pt-BR title, the entries alone are required (at least one), each
 *     entry needs only what both lists always carry, the title defaults to "PÓDIO", and an
 *     unknown field is refused at the top.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod model agree;
 *     podiumManifestDataAgreement.test.ts runs the same payloads through both.
 *   - That a renderer can load "main"; e2e/podiumLifecycle.e2e.ts does it from dist/.
 *   - The page: this file runs in plain Node (line 1) since it reads the token file from disk.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { type BindingFieldValue, findProblemInBindingForDataSchemaField } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import podiumManifest from '../podium.ograf.json';
import { podiumStepCount } from './podiumModel.js';

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

/**
 * The podium item's binding of the entries: the simulator's list of one shape, frozen at the
 * take, cut to three by topN and given the team logos by withTeamLogos.
 */
function buildPodiumRecipeBinding(shapeKey: 'positions' | 'standings', path: string) {
  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: 'simulador-enduro',
    shapeKey,
    path,
    isLive: false,
    transformId: 'topN',
    transformParameters: { n: 3 },
    thenTransformId: 'withTeamLogos',
  };
  return binding;
}

/** A binding of one whole list of the simulator, frozen at the take, with no transform. */
function buildPlainFrozenBinding(shapeKey: 'positions' | 'standings', path: string) {
  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: 'simulador-enduro',
    shapeKey,
    path,
    isLive: false,
  };
  return binding;
}

describe('podium.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(podiumManifest);

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
    const manifestWithoutMain: Record<string, unknown> = { ...podiumManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('podium.ograf.json settings', () => {
  it('declares the id, name, main, render modes and the four steps', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: podiumManifest.id,
      name: podiumManifest.name,
      main: podiumManifest.main,
      supportsRealTime: podiumManifest.supportsRealTime,
      supportsNonRealTime: podiumManifest.supportsNonRealTime,
      stepCount: podiumManifest.stepCount,
    };

    // Assert: the settings, "main" naming the built module, and the step count the graphic
    // itself steps by.
    expect(fixedSettings, 'the manifest must declare the fixed settings').toEqual({
      id: 'baja-podium',
      name: 'Pódio',
      main: 'podium.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: podiumStepCount,
    });
    expect(podiumStepCount, 'the head alone, then one step per place').toBe(4);
  });

  it('declares the fullscreen layer and the standings category in v_baja', () => {
    // Arrange: nothing to set up.

    // Act: read BajaOvrLay's own field.
    const bajaVendorFields = podiumManifest.v_baja;

    // Assert: the layer and category the server reads, and no update rule.
    expect(bajaVendorFields, 'the podium goes on the fullscreen layer').toEqual({
      defaultLayerId: 'fullscreen',
      category: 'standings',
    });
  });

  it('suggests the positions list frozen at the take for the entries, and hints nothing else', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(podiumManifest.schema.properties);

    // Act: collect the v_baja hint of every field that has one.
    const hintsByField: Record<string, unknown> = {};
    for (const [fieldName, field] of dataFields) {
      if ('v_baja' in field) {
        hintsByField[fieldName] = field.v_baja;
      }
    }

    // Assert: the positions list, frozen (a snapshot: the places must not change mid-reveal).
    expect(hintsByField, 'the entries suggest the positions, frozen at the take').toEqual({
      entries: { suggestedBinding: { shapeKey: 'positions', path: 'entries', isLive: false } },
    });
  });

  const bindingFitScenarios = [
    // The enduro's podium: the positions list.
    {
      name: 'takes the positions list through topN 3 then withTeamLogos',
      binding: buildPodiumRecipeBinding('positions', 'entries'),
      fits: true,
    },
    // The overall podium: the standings list, whose ranks may tie.
    {
      name: 'takes the standings list through topN 3 then withTeamLogos',
      binding: buildPodiumRecipeBinding('standings', 'entries'),
      fits: true,
    },
    // The score parts are a list too, but not of teams.
    {
      name: 'refuses the standings score parts',
      binding: buildPlainFrozenBinding('standings', 'scoreParts'),
      fits: false,
    },
  ];

  it.each(bindingFitScenarios)('$name', ({ binding, fits }) => {
    // Arrange: the manifest's data schema, as the item editor and the server read it.
    const dataSchema = podiumManifest.schema;

    // Act: ask the shared rule what is wrong with the binding on the entries field.
    const problem = findProblemInBindingForDataSchemaField(binding, dataSchema, 'entries');

    // Assert: no problem for a list of cars or teams; a problem for the score parts.
    expect(
      problem === undefined,
      `the binding must ${fits ? '' : 'not '}fit: ${String(problem)}`,
    ).toBe(fits);
  });

  it('declares a step as --motion-in and stop as --motion-out', () => {
    // Arrange: the tokens as tokens.css writes them.
    const motionInMs = readDurationTokenMs('--motion-in');
    const motionOutMs = readDurationTokenMs('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = podiumManifest.actionDurations;

    // Assert: exactly the tokens (400 and 250 in Ardósia): every play is one rise.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('gives every field a pt-BR title, requires the entries alone and defaults the title', () => {
    // Arrange: the data fields.
    const properties = podiumManifest.schema.properties;

    // Act: collect each field's title.
    const titlesByField = Object.fromEntries(
      Object.entries(properties).map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: the pt-BR titles, the text fields single-line, the one required field (at
    // least one entry), the default title, strict top.
    expect(titlesByField, 'every field must carry a pt-BR title').toEqual({
      entries: 'Equipes do pódio',
      title: 'Título',
      eventLine: 'Evento',
    });
    expect(
      [properties.title.gddType, properties.eventLine.gddType],
      'the texts are one line each',
    ).toEqual(['single-line', 'single-line']);
    expect(podiumManifest.schema.required, 'only the entries are required').toEqual(['entries']);
    expect(properties.entries.minItems, 'a podium needs at least one entry').toBe(1);
    expect(properties.title.default, 'the title defaults to PÓDIO').toBe('PÓDIO');
    expect(
      podiumManifest.schema.additionalProperties,
      'a field the podium does not know is refused at the top level',
    ).toBe(false);
  });

  it('describes each entry by what both lists carry, with any extra field allowed', () => {
    // Arrange: the entries' items.
    const entryItems = podiumManifest.schema.properties.entries.items;

    // Act: read what an entry must and may carry.
    const entriesAsDescribed = {
      requiredFields: entryItems.required,
      allowsExtraFields: entryItems.additionalProperties,
      fields: Object.keys(entryItems.properties),
    };

    // Assert: the car, team and school required; the place as a position or a rank and the
    // logo with its plate optional, as withTeamLogos adds them only for a team with a logo.
    expect(entriesAsDescribed, 'the entries bind to either list as is').toEqual({
      requiredFields: ['carNumber', 'teamName', 'schoolName'],
      allowsExtraFields: true,
      fields: [
        'position',
        'rank',
        'carNumber',
        'teamName',
        'schoolName',
        'logoUrl',
        'logoOnLightPlate',
      ],
    });
  });
});
