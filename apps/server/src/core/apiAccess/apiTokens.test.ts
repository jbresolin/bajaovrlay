/**
 * The API tokens: reading BAJAOVRLAY_API_TOKENS, the Authorization header, and matching (apps/server)
 *
 * What this module is for:
 *   Companion, a Stream Deck or a script sends commands over HTTP (BAJAOVRLAY-28). Each
 *   device has its own token, listed in one variable as `name=token` pairs separated by
 *   commas; the request sends `Authorization: Bearer <token>`, and the server finds which
 *   device it is by comparing in constant time. A token is a secret: no message this
 *   module writes ever repeats one, only the device's name or the entry's position.
 *
 * What these tests prove:
 *   - Unset or blank, the variable means the API is off.
 *   - Pairs are read with the spaces around names and tokens trimmed, so a token pasted
 *     with a space still works; an empty entry from a trailing comma is skipped.
 *   - An entry with no "=", a name that cannot be an actor name, a token shorter than 16
 *     characters or with a space inside, a name listed twice and a token given to two
 *     devices are each refused, and the message never contains a token.
 *   - The Authorization header is read only as `Bearer <token>` (the word in any case).
 *   - A presented token is matched to its device's name, and a wrong one to none.
 *
 * What these tests deliberately do not cover:
 *   - The answers a route gives (403, 401); apiTokenAuth.test.ts in api/v1.
 *   - That the comparison takes the same time whatever the token: it compares SHA-256
 *     digests with timingSafeEqual, which is Node's job to keep constant; a timing test
 *     would be flaky.
 */
import { describe, expect, it } from 'vitest';

import {
  findNameOfMatchingApiToken,
  parseApiTokens,
  readBearerTokenFromAuthorizationHeader,
} from './apiTokens.js';
import { companionToken, sharedToken, streamDeckToken } from './fakeApiTokens.testSupport.js';

describe('parseApiTokens', () => {
  const variablesThatTurnTheApiOff = [
    // Most installs: the variable is not in .env at all.
    { name: 'reads an unset variable as the API off', text: undefined },
    // `BAJAOVRLAY_API_TOKENS=` left empty in .env.
    { name: 'reads an empty variable as the API off', text: '' },
    // Only spaces, from an editor that kept them.
    { name: 'reads a blank variable as the API off', text: '   ' },
  ];

  it.each(variablesThatTurnTheApiOff)('$name', ({ text }) => {
    // Arrange: the variable as given in the table.

    // Act: parse it.
    const parsing = parseApiTokens(text);

    // Assert: valid, and off.
    expect(parsing, 'no token means the command API is off').toEqual({
      isValid: true,
      apiTokens: { isSet: false },
    });
  });

  it('reads two devices with the spaces around names and tokens trimmed', () => {
    // Arrange: Companion's token pasted with a space before and after, and a trailing comma.
    const text = ` companion = ${companionToken} ,streamdeck=${streamDeckToken},`;

    // Act: parse it.
    const parsing = parseApiTokens(text);

    // Assert: both devices, trimmed, and nothing for the empty entry after the last comma.
    expect(parsing, 'both devices must be read, trimmed').toEqual({
      isValid: true,
      apiTokens: {
        isSet: true,
        tokens: [
          { name: 'companion', token: companionToken },
          { name: 'streamdeck', token: streamDeckToken },
        ],
      },
    });
  });

  const variablesThatStopTheBoot = [
    // A token pasted alone, without its device's name: the message must not repeat it.
    {
      name: 'refuses an entry with no "=", naming its position',
      text: `companion=${companionToken},${streamDeckToken}`,
      expectedProblem: 'entry 2 has no "=": write it as name=token',
    },
    // A name with a space would make an actor name the event log cannot show plainly.
    {
      name: 'refuses a name that is not letters, digits, "-" or "_"',
      text: `stream deck=${streamDeckToken}`,
      expectedProblem:
        'entry 1 has a name that is not 1 to 40 letters, digits, "-" or "_" (for example streamdeck)',
    },
    // A short token can be guessed by anyone on the LAN.
    {
      name: 'refuses a token shorter than 16 characters',
      text: 'companion=1234',
      expectedProblem:
        'the token of "companion" is shorter than 16 characters (make one with openssl rand -hex 16)',
    },
    // A space inside is a paste that went wrong; a Bearer header cannot carry it.
    {
      name: 'refuses a token with a space inside',
      text: 'companion=companion-test token-0001',
      expectedProblem: 'the token of "companion" has a space inside',
    },
    // Two lines for one device: which token counts would be a guess.
    {
      name: 'refuses a name listed twice',
      text: `companion=${companionToken},companion=${streamDeckToken}`,
      expectedProblem: '"companion" is listed twice',
    },
    // One token for two devices: the event log could not say which one pressed.
    {
      name: 'refuses one token given to two devices',
      text: `companion=${sharedToken},streamdeck=${sharedToken}`,
      expectedProblem: '"companion" and "streamdeck" have the same token',
    },
  ];

  it.each(variablesThatStopTheBoot)('$name', ({ text, expectedProblem }) => {
    // Arrange: the variable as given in the table.

    // Act: parse it.
    const parsing = parseApiTokens(text);

    // Assert: refused with the expected words, and neither token repeated.
    expect(parsing, 'the variable must be refused with a plain reason').toEqual({
      isValid: false,
      problem: expectedProblem,
    });
    const problemText = parsing.isValid ? '' : parsing.problem;
    expect(problemText, 'a refusal never repeats a token').not.toContain(companionToken);
    expect(problemText, 'a refusal never repeats a token').not.toContain(streamDeckToken);
    expect(problemText, 'a refusal never repeats a token').not.toContain(sharedToken);
  });
});

describe('readBearerTokenFromAuthorizationHeader', () => {
  const headers = [
    // What Companion sends when the header is typed as the docs say.
    { name: 'reads a Bearer header', header: `Bearer ${companionToken}`, expected: companionToken },
    // RFC 9110: the scheme's word is not case-sensitive; some tools send it in lower case.
    {
      name: 'reads the scheme in any case',
      header: `bearer ${companionToken}`,
      expected: companionToken,
    },
    // A stray space after the token, from a copy and paste into a tool's header field.
    {
      name: 'trims a space after the token',
      header: `Bearer ${companionToken} `,
      expected: companionToken,
    },
    // No header at all.
    { name: 'reads nothing from a missing header', header: undefined, expected: undefined },
    // Basic authentication is not what this API speaks.
    {
      name: 'reads nothing from a Basic header',
      header: 'Basic Y29tcGFuaW9uOnNlbmhh',
      expected: undefined,
    },
    // The token pasted without the word Bearer.
    { name: 'reads nothing from a token alone', header: companionToken, expected: undefined },
    // The word with nothing after it.
    { name: 'reads nothing from "Bearer" alone', header: 'Bearer ', expected: undefined },
  ];

  it.each(headers)('$name', ({ header, expected }) => {
    // Arrange: the header as given in the table.

    // Act: read the token from it.
    const token = readBearerTokenFromAuthorizationHeader(header);

    // Assert: the expected token, or none.
    expect(token, 'only "Bearer <token>" carries a token').toBe(expected);
  });
});

describe('findNameOfMatchingApiToken', () => {
  const twoDevices = [
    { name: 'companion', token: companionToken },
    { name: 'streamdeck', token: streamDeckToken },
  ];

  it('names the device whose token was presented', () => {
    // Arrange: the Stream Deck's token, the second of two.
    const presentedToken = streamDeckToken;

    // Act: find whose it is.
    const deviceName = findNameOfMatchingApiToken(twoDevices, presentedToken);

    // Assert: the Stream Deck.
    expect(deviceName, 'the second device’s token must name the second device').toBe('streamdeck');
  });

  it('names no device for a wrong token', () => {
    // Arrange: Companion's token with its last character changed.
    const presentedToken = `${companionToken.slice(0, -1)}f`;

    // Act: find whose it is.
    const deviceName = findNameOfMatchingApiToken(twoDevices, presentedToken);

    // Assert: nobody's.
    expect(deviceName, 'a token one character off matches nobody').toBeUndefined();
  });
});
