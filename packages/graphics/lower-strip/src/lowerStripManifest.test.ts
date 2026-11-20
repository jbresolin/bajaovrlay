// @vitest-environment node
/**
 * The OGraf manifest, lower-strip.ograf.json (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest; the server reads its
 *   layer, category and update rule; the control page builds the item form from its data
 *   schema, and offers "Fonte" and "Relógio da fonte" from the fields' hints and roles.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in the
 *     kit), and a manifest with "main" removed fails it, so the check has teeth.
 *   - The settings: id, name, main, real-time only, one step; the ticker layer, the
 *     positions category and the race clock's update rule, carryClockForward.
 *   - The play length is a full page's cascade, `--motion-in` + 7 × `--motion-row-stagger`
 *     (the clock block, six cars and the page cell), and the stop length `--motion-out`,
 *     read from the text of packages/theme/ardosia/tokens.css.
 *   - The cars are bound live to the positions' whole list by default, and need only the
 *     position, the car and the school of each entry, letting every other field through;
 *     the laps and the two gaps the strip may draw pass through undeclared, as before, so
 *     a bad value never refuses the whole list.
 *   - The laps are off and the gap "Não mostrar" by default, neither required, so an item
 *     saved before BAJAOVRLAY-81 looks and validates the same.
 *   - The clock fields are the race clock's own, word for word (titles, roles, defaults),
 *     so "Relógio da fonte" fills them as it fills the race clock's; the flag is optional
 *     on both (BAJAOVRLAY-81).
 *   - The clock block's switch starts on.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod validation agree;
 *     lowerStripManifestDataAgreement.test.ts.
 *   - That a renderer can load the module named in "main"; e2e/lowerStripLifecycle.e2e.ts.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { describe, expect, it } from 'vitest';

import lowerStripManifest from '../lower-strip.ograf.json';

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
 * milliseconds. Throws when the token is not there: a manifest checked against a missing
 * token would pass for the wrong reason.
 */
function readDurationTokenInMilliseconds(tokenName: string): number {
  const tokensCssText = readArdosiaTokensCssText();
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)ms;`).exec(tokensCssText);
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
}

describe('lower-strip.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(lowerStripManifest);

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
    const manifestWithoutMain: Record<string, unknown> = { ...lowerStripManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('lower-strip.ograf.json settings', () => {
  it('declares the id, name, render modes and step count', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: lowerStripManifest.id,
      name: lowerStripManifest.name,
      main: lowerStripManifest.main,
      supportsRealTime: lowerStripManifest.supportsRealTime,
      supportsNonRealTime: lowerStripManifest.supportsNonRealTime,
      stepCount: lowerStripManifest.stepCount,
    };

    // Assert: real-time only, one step, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare these settings').toEqual({
      id: 'baja-lower-strip',
      name: 'Faixa de classificação',
      main: 'lower-strip.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('asks for the ticker layer, the positions category and carryClockForward', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read BajaOvrLay's own field.
    const bajaVendorFields = lowerStripManifest.v_baja;

    // Assert: the bar's layer; its clock group keeps from jumping as the race clock's does.
    expect(bajaVendorFields, 'the strip’s layer, category and update rule').toEqual({
      defaultLayerId: 'ticker',
      category: 'positions',
      updateRule: 'carryClockForward',
    });
  });

  it('declares a full page’s cascade as the play length and --motion-out as the stop length', () => {
    // Arrange: the three durations as packages/theme/ardosia/tokens.css writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const rowStaggerMs = readDurationTokenInMilliseconds('--motion-row-stagger');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = lowerStripManifest.actionDurations;

    // Assert: the last of eight pieces (block, six cars, page cell) starts 7 staggers in.
    expect(declaredDurations, 'the manifest durations must follow the theme’s tokens').toEqual([
      { type: 'playAction', duration: motionInMs + 7 * rowStaggerMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('binds the cars live to the positions’ whole list and needs only what it draws', () => {
    // Arrange: the cars' field as the manifest describes it.
    const carsField = lowerStripManifest.schema.properties.entries;

    // Act: read its source hint and what each entry must carry.
    const suggestedBinding = carsField.v_baja.suggestedBinding;
    const requiredOfEachCar = carsField.items.required;
    const allowsOtherFields = carsField.items.additionalProperties;

    // Assert: live from the positions, the position, car and school required, the rest
    // (laps, gaps, status) let through.
    expect(suggestedBinding, 'the cars come live from the positions').toEqual({
      shapeKey: 'positions',
      path: 'entries',
      isLive: true,
    });
    expect(requiredOfEachCar, 'each car needs its position, number and school').toEqual([
      'position',
      'carNumber',
      'schoolName',
    ]);
    expect(allowsOtherFields, 'a positions entry fits with all its fields').toBe(true);
  });

  it('leaves the laps and gaps to pass through undeclared, so a bad one never refuses the list (BAJAOVRLAY-81)', () => {
    // Arrange: what each car of the list declares.
    const carFields = lowerStripManifest.schema.properties.entries.items.properties;

    // Act: look for the three fields the new cells read.
    const declaredLapsAndGapFields = ['laps', 'gapToLeaderMs', 'gapToLeaderLaps'].filter(
      (fieldName) => fieldName in carFields,
    );

    // Assert: none is declared. OGraf requires a single type on any field declared, and a
    // type would make the server refuse the whole list for one bad value, which it never
    // did before these cells existed; they pass through as every other positions field
    // does (additionalProperties), and the graphic blanks a bad one (lowerStripModel.ts).
    expect(declaredLapsAndGapFields, 'the three fields pass through undeclared').toEqual([]);
  });

  it('offers the laps off and the gap as "Não mostrar" by default, so old items look the same', () => {
    // Arrange: the two choices of what each car shows.
    const lapsSwitch = lowerStripManifest.schema.properties.showLaps;
    const gapChoice = lowerStripManifest.schema.properties.gapDisplay;

    // Act: read what the item form shows for them.
    const choicesAsShown = {
      laps: { type: lapsSwitch.type, title: lapsSwitch.title, default: lapsSwitch.default },
      gap: {
        title: gapChoice.title,
        options: gapChoice.enum,
        labels: gapChoice.gddOptions.labels,
        default: gapChoice.default,
      },
      requiredFields: lowerStripManifest.schema.required,
    };

    // Assert: off and "Não mostrar" by default, pt-BR labels with an example each, and
    // neither required, so an item saved before them still validates.
    expect(choicesAsShown, 'the two choices as the item form shows them').toEqual({
      laps: { type: 'boolean', title: 'Mostrar as voltas', default: false },
      gap: {
        title: 'Diferença para o líder',
        options: ['none', 'laps', 'lapsAndTime', 'time'],
        labels: {
          none: 'Não mostrar',
          laps: 'Só voltas (+2 voltas)',
          lapsAndTime: 'Voltas e tempo (+2 voltas ou +12,3)',
          time: 'Só tempo (+12,3)',
        },
        default: 'none',
      },
      requiredFields: [
        'entries',
        'clockMode',
        'referenceTimeMs',
        'referenceWallClockMs',
        'running',
      ],
    });
  });

  it('declares the race clock’s clock fields (four with roles, and the optional flag) word for word', () => {
    // Arrange: the clock fields of both manifests.
    const clockFieldKeys = [
      'state',
      'clockMode',
      'referenceTimeMs',
      'referenceWallClockMs',
      'running',
    ] as const;

    // Act: pick them out of each.
    const stripClockFields = clockFieldKeys.map((key) => lowerStripManifest.schema.properties[key]);
    const raceClockFields = clockFieldKeys.map((key) => raceClockManifest.schema.properties[key]);

    // Assert: identical, roles and defaults included; the cars and the four clock fields
    // required, the flag optional on both (BAJAOVRLAY-81).
    expect(stripClockFields, 'the strip’s clock is the race clock’s, field for field').toEqual(
      raceClockFields,
    );
    expect(
      lowerStripManifest.schema.required,
      'the cars and the clock are required, the flag is not',
    ).toEqual(['entries', 'clockMode', 'referenceTimeMs', 'referenceWallClockMs', 'running']);
  });

  it('starts the clock block switched on', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the switch's field.
    const clockBlockSwitch = lowerStripManifest.schema.properties.showClockBlock;

    // Assert: a boolean that starts on, titled in pt-BR.
    expect(
      {
        type: clockBlockSwitch.type,
        default: clockBlockSwitch.default,
        title: clockBlockSwitch.title,
      },
      'the block is shown unless switched off',
    ).toEqual({ type: 'boolean', default: true, title: 'Mostrar o relógio' });
  });
});
