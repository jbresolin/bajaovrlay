/**
 * Reading BAJAOVRLAY_YOUTUBE_DAILY_UNITS at boot (apps/server)
 *
 * What this module is for:
 *   The YouTube source (BAJAOVRLAY-35) stops reading the chat when the server has spent
 *   its budget of the key's daily quota units. The budget is checked at boot, so a typo
 *   stops the server at once instead of stopping the Super Chats at the first poll of race
 *   day. The key itself is not read at boot: the source reads it at each request.
 *
 * What these tests prove:
 *   - Unset, the budget is 9 000; set, it is the number written.
 *   - A word, or a number above Google's 10 000, stops the boot naming the variable.
 *   - The settings hold no YouTube key, even when one is set.
 *
 * What these tests deliberately do not cover:
 *   - Every way the budget is read: youTubeQuota.test.ts in the data-source module.
 */
import { describe, expect, it } from 'vitest';

import { readServerEnvironment } from './readServerEnvironment.js';

describe('readServerEnvironment and BAJAOVRLAY_YOUTUBE_DAILY_UNITS', () => {
  it('reads unset as 9 000 units', () => {
    // Arrange: an environment without the variable, as most installs have.
    const environmentVariables = {};

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: the default budget.
    expect(environment.BAJAOVRLAY_YOUTUBE_DAILY_UNITS, 'unset must be 9 000').toBe(9_000);
  });

  it('reads the number written', () => {
    // Arrange: a budget of 6 000, for a key shared with another tool.
    const environmentVariables = { BAJAOVRLAY_YOUTUBE_DAILY_UNITS: '6000' };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: the budget written.
    expect(environment.BAJAOVRLAY_YOUTUBE_DAILY_UNITS, 'the budget must be read').toBe(6_000);
  });

  const typoScenarios = [
    // A word where a number belongs.
    { name: 'stops the boot on a word', text: 'nove mil' },
    // A zero too many: more than Google gives a key.
    { name: 'stops the boot above 10 000', text: '90000' },
  ];

  it.each(typoScenarios)('$name', ({ text }) => {
    // Arrange: the typo in the row.
    const environmentVariables = { BAJAOVRLAY_YOUTUBE_DAILY_UNITS: text };

    // Act: read the environment.
    const reading = () => readServerEnvironment(environmentVariables);

    // Assert: the boot stops naming the variable.
    expect(reading, 'a budget that cannot be used must stop the boot').toThrow(
      'BAJAOVRLAY_YOUTUBE_DAILY_UNITS',
    );
  });

  it('keeps no YouTube key in the settings', () => {
    // Arrange: an environment with the fake key set.
    const environmentVariables = { BAJAOVRLAY_YOUTUBE_API_KEY: 'youtube-test-api-key-0001' };

    // Act: read the environment.
    const environment = readServerEnvironment(environmentVariables);

    // Assert: nothing in the settings holds the key, so no log of them can print it.
    expect(JSON.stringify(environment), 'the settings must not hold the key').not.toContain(
      'youtube-test-api-key-0001',
    );
  });
});
