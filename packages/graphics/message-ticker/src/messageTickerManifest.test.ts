// @vitest-environment node
/**
 * The OGraf manifest, message-ticker.ograf.json (packages/graphics/message-ticker)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest; the server reads its
 *   layer, category and update rule; the control page builds the item form from its data
 *   schema: the label, the messages as a list of texts (BAJAOVRLAY-23) and the clock.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema, and fails it without
 *     "main", so the check has teeth.
 *   - The settings: id, name, main, real-time only, one step; the ticker layer, the ticker
 *     category and carryClockForward.
 *   - The play length is the cascade of four pieces, `--motion-in` + 3 ×
 *     `--motion-row-stagger` (the clock block, the label, the message, the page cell), and
 *     the stop length `--motion-out`, read from packages/theme/ardosia/tokens.css.
 *   - The messages are a list of texts, at least one and at most `mostMessages`, each of 1
 *     to `longestMessageInCharacters` characters, a line called "Mensagem": the numbers of
 *     messageLimits.ts, which the item editor checks with these keywords. The label starts
 *     as "AVISO", at most `longestLabelInCharacters`.
 *   - The clock fields (four with roles, and the flag) are the race clock's own, word for
 *     word; the block's switch starts off (João, gate 2: a ticker between sessions would
 *     show a stopped 0:00).
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod validation agree;
 *     messageTickerManifestDataAgreement.test.ts.
 *   - That the limit fits the bar; e2e/messageTickerHoldsTheLongest.e2e.ts measures it.
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

import messageTickerManifest from '../message-ticker.ograf.json';
import {
  longestLabelInCharacters,
  longestMessageInCharacters,
  mostMessages,
} from './messageLimits.js';

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

describe('message-ticker.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(messageTickerManifest);

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
    const manifestWithoutMain: Record<string, unknown> = { ...messageTickerManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('message-ticker.ograf.json settings', () => {
  it('declares the id, name, render modes, step count, layer, category and update rule', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: messageTickerManifest.id,
      name: messageTickerManifest.name,
      main: messageTickerManifest.main,
      supportsRealTime: messageTickerManifest.supportsRealTime,
      supportsNonRealTime: messageTickerManifest.supportsNonRealTime,
      stepCount: messageTickerManifest.stepCount,
      v_baja: messageTickerManifest.v_baja,
    };

    // Assert: real-time only, one step, on the strip's layer with the clock's rule.
    expect(fixedSettings, 'the manifest must declare these settings').toEqual({
      id: 'baja-message-ticker',
      name: 'Letreiro de avisos',
      main: 'message-ticker.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      v_baja: { defaultLayerId: 'ticker', category: 'ticker', updateRule: 'carryClockForward' },
    });
  });

  it('declares the four pieces’ cascade as the play length and --motion-out as the stop length', () => {
    // Arrange: the three durations as packages/theme/ardosia/tokens.css writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const rowStaggerMs = readDurationTokenInMilliseconds('--motion-row-stagger');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = messageTickerManifest.actionDurations;

    // Assert: the page cell, the fourth piece, starts 3 staggers in.
    expect(declaredDurations, 'the manifest durations must follow the theme’s tokens').toEqual([
      { type: 'playAction', duration: motionInMs + 3 * rowStaggerMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('declares the messages as a list of texts within messageLimits.ts', () => {
    // Arrange: the messages' field as the manifest describes it.
    const messagesField = messageTickerManifest.schema.properties.messages;

    // Act: read its list and line keywords.
    const limits = {
      type: messagesField.type,
      minItems: messagesField.minItems,
      maxItems: messagesField.maxItems,
      itemType: messagesField.items.type,
      itemTitle: messagesField.items.title,
      minLength: messagesField.items.minLength,
      maxLength: messagesField.items.maxLength,
    };

    // Assert: the package's own numbers, which the item editor checks before sending.
    expect(limits, 'the form’s limits must be the bar’s').toEqual({
      type: 'array',
      minItems: 1,
      maxItems: mostMessages,
      itemType: 'string',
      itemTitle: 'Mensagem',
      minLength: 1,
      maxLength: longestMessageInCharacters,
    });
    expect(longestMessageInCharacters, 'the measured limit').toBe(50);
  });

  it('starts the label as AVISO, within its limit', () => {
    // Arrange: the label's field.
    const labelField = messageTickerManifest.schema.properties.label;

    // Act: read its default and limits.
    const label = {
      title: labelField.title,
      default: labelField.default,
      minLength: labelField.minLength,
      maxLength: labelField.maxLength,
    };

    // Assert: "AVISO", 1 to 10 characters, titled apart from the item's own "Rótulo" (the
    // item editor shows both in one form).
    expect(label, 'the label as the design writes it').toEqual({
      title: 'Rótulo do aviso',
      default: 'AVISO',
      minLength: 1,
      maxLength: longestLabelInCharacters,
    });
  });

  it('declares the race clock’s clock fields word for word, and the block off by default', () => {
    // Arrange: the clock fields of both manifests.
    const clockFieldKeys = [
      'state',
      'clockMode',
      'referenceTimeMs',
      'referenceWallClockMs',
      'running',
    ] as const;

    // Act: pick them out of each, and the switch.
    const tickerClockFields = clockFieldKeys.map(
      (key) => messageTickerManifest.schema.properties[key],
    );
    const raceClockFields = clockFieldKeys.map((key) => raceClockManifest.schema.properties[key]);
    const clockBlockSwitch = messageTickerManifest.schema.properties.showClockBlock;

    // Assert: identical clock fields, required; the block off unless switched on.
    expect(tickerClockFields, 'the ticker’s clock is the race clock’s').toEqual(raceClockFields);
    expect(messageTickerManifest.schema.required, 'the words and the clock are required').toEqual([
      'label',
      'messages',
      ...clockFieldKeys,
    ]);
    expect(clockBlockSwitch.default, 'the block starts off').toBe(false);
  });
});
