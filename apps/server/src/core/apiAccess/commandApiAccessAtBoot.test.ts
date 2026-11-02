/**
 * The boot log's line about who may use the command API (apps/server)
 *
 * What this module is for:
 *   At boot the server writes one line saying how the command API is reached (BAJAOVRLAY-28):
 *   off, by token (naming the devices, never their tokens), or open to the whole network
 *   (BAJAOVRLAY_API_OPEN=true). Open is a warning in plain words, so a server started open
 *   by mistake outside the studio network is noticed in `docker logs`.
 *
 * What these tests prove:
 *   - Open, the line is a warning that says any machine on the network may send commands
 *     with no token, and names the devices that still have one.
 *   - By token only, the line is information naming the devices.
 *   - With neither, the line is information saying the API is off and how to turn it on.
 *   - No line ever carries a token.
 *
 * What these tests deliberately do not cover:
 *   - That main.ts calls it at boot: main.ts is the entry point no test boots; one call.
 *   - The answers the routes give in each mode; apiOpenToTheNetwork.test.ts in api/v1.
 */
import { describe, expect, it } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { parseApiTokens } from './apiTokens.js';
import { logCommandApiAccessAtBoot } from './commandApiAccessAtBoot.js';
import {
  apiTokensOfTheDesk,
  companionToken,
  streamDeckToken,
} from './fakeApiTokens.testSupport.js';

/** BAJAOVRLAY_API_TOKENS read from the given text; throws if a test wrote a bad one. */
function readApiTokensVariable(text: string | undefined) {
  const parsing = parseApiTokens(text);
  if (!parsing.isValid) {
    throw new Error(parsing.problem);
  }
  return parsing.apiTokens;
}

describe('logCommandApiAccessAtBoot', () => {
  it('warns in plain words that the API is open to the whole network', () => {
    // Arrange: the studio server, open, with the desk's two devices still listed.
    const { logger, readRecordedLines } = createRecordingLogger();
    const apiTokens = readApiTokensVariable(apiTokensOfTheDesk);

    // Act: write the boot line.
    logCommandApiAccessAtBoot({ logger, apiTokens, isOpenToTheNetwork: true });

    // Assert: one warning that says what open means, naming the devices and no token.
    const [bootLine] = readRecordedLines();
    expect(bootLine?.level, 'open is a warning, not a detail').toBe('warn');
    expect(bootLine?.message, 'the line says what open means').toBe(
      'command API open to the whole network: any machine on it may send commands with no token (BAJAOVRLAY_API_OPEN=true)',
    );
    expect(bootLine?.api_token_names, 'the devices that still have a token').toEqual([
      'companion',
      'streamdeck',
    ]);
    expect(JSON.stringify(bootLine), 'no token in the line').not.toContain(companionToken);
    expect(JSON.stringify(bootLine), 'no token in the line').not.toContain(streamDeckToken);
  });

  it('names the devices when the API is on by token only', () => {
    // Arrange: Companion and the Stream Deck, not open.
    const { logger, readRecordedLines } = createRecordingLogger();
    const apiTokens = readApiTokensVariable(apiTokensOfTheDesk);

    // Act: write the boot line.
    logCommandApiAccessAtBoot({ logger, apiTokens, isOpenToTheNetwork: false });

    // Assert: information naming both devices, and no token.
    const [bootLine] = readRecordedLines();
    expect(bootLine?.level, 'by token is ordinary information').toBe('info');
    expect(bootLine?.message, 'the line says how it is reached').toBe('command API on, by token');
    expect(bootLine?.api_token_names, 'the devices listed').toEqual(['companion', 'streamdeck']);
    expect(JSON.stringify(bootLine), 'no token in the line').not.toContain(companionToken);
  });

  it('says the API is off, and how to turn it on, with neither variable', () => {
    // Arrange: a fresh install that set neither variable.
    const { logger, readRecordedLines } = createRecordingLogger();
    const apiTokens = readApiTokensVariable(undefined);

    // Act: write the boot line.
    logCommandApiAccessAtBoot({ logger, apiTokens, isOpenToTheNetwork: false });

    // Assert: information that it is off, naming both ways on.
    const [bootLine] = readRecordedLines();
    expect(bootLine?.level, 'off is ordinary information').toBe('info');
    expect(bootLine?.message, 'the line names both variables').toBe(
      'command API off: set BAJAOVRLAY_API_TOKENS, or BAJAOVRLAY_API_OPEN=true on a studio-only network',
    );
    expect(bootLine?.api_token_names, 'no device').toEqual([]);
  });
});
