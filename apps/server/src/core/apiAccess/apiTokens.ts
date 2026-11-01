// The tokens of the command API (BAJAOVRLAY-28): read from BAJAOVRLAY_API_TOKENS at boot,
// read from a request's Authorization header, and matched in constant time. A token is a
// secret, so nothing written here ever repeats one: messages name the device, or the
// entry's position when even the name cannot be trusted to be a name.
import { createHash, timingSafeEqual } from 'node:crypto';

/** One device that may use the command API: its name (in `api:<name>`) and its token. */
export type ApiToken = { name: string; token: string };

/** BAJAOVRLAY_API_TOKENS after reading: off (unset or blank), or the devices it lists. */
export type ApiTokens = { isSet: false } | { isSet: true; tokens: ApiToken[] };

/** How parseApiTokens answers: the tokens, or a plain reason that names no token. */
export type ApiTokensParsing =
  { isValid: true; apiTokens: ApiTokens } | { isValid: false; problem: string };

/** The command API off: what an unset variable gives, and what tests start from. */
export const apiTurnedOff: ApiTokens = { isSet: false };

/**
 * The name a call with no token is signed with (`api:rede`) when BAJAOVRLAY_API_OPEN=true,
 * so no device may take it: the event log could not tell the device from the network.
 */
export const apiCallerNameWithoutAToken = 'rede';

// A name becomes part of the actor `api:<name>` in the event log, so it stays plain.
const apiTokenNamePattern = /^[A-Za-z0-9_-]{1,40}$/;
// 16 characters is 64 bits of `openssl rand -hex 16` at the least; shorter is guessable.
const shortestTokenLength = 16;

/**
 * Reads BAJAOVRLAY_API_TOKENS: `name=token` pairs separated by commas, spaces around a
 * name or a token trimmed and an empty entry (a trailing comma) skipped. Unset or blank
 * is the API off. The first entry that cannot be used is refused, with a reason.
 */
export function parseApiTokens(text: string | undefined): ApiTokensParsing {
  if (text === undefined || text.trim() === '') {
    return { isValid: true, apiTokens: apiTurnedOff };
  }
  const tokens: ApiToken[] = [];
  const entries = text.split(',');
  for (const [entryIndex, entry] of entries.entries()) {
    if (entry.trim() === '') {
      continue;
    }
    const entryNumber = entryIndex + 1;
    const equalsSignIndex = entry.indexOf('=');
    if (equalsSignIndex === -1) {
      return { isValid: false, problem: `entry ${entryNumber} has no "=": write it as name=token` };
    }
    const name = entry.slice(0, equalsSignIndex).trim();
    const token = entry.slice(equalsSignIndex + 1).trim();
    const problem = findProblemOfOneEntry(name, token, entryNumber, tokens);
    if (problem !== undefined) {
      return { isValid: false, problem };
    }
    tokens.push({ name, token });
  }
  if (tokens.length === 0) {
    return { isValid: true, apiTokens: apiTurnedOff };
  }
  return { isValid: true, apiTokens: { isSet: true, tokens } };
}

/** What is wrong with one entry, given the entries read before it, or undefined. */
function findProblemOfOneEntry(
  name: string,
  token: string,
  entryNumber: number,
  tokensReadBefore: ApiToken[],
): string | undefined {
  if (!apiTokenNamePattern.test(name)) {
    return `entry ${entryNumber} has a name that is not 1 to 40 letters, digits, "-" or "_" (for example streamdeck)`;
  }
  // Any case: "Rede" beside "api:rede" in the event log would read as the same caller.
  if (name.toLowerCase() === apiCallerNameWithoutAToken) {
    return `the name "${name}" is kept for calls with no token (BAJAOVRLAY_API_OPEN): name the device otherwise`;
  }
  if (token.length < shortestTokenLength) {
    return `the token of "${name}" is shorter than ${shortestTokenLength} characters (make one with openssl rand -hex 16)`;
  }
  if (/\s/.test(token)) {
    return `the token of "${name}" has a space inside`;
  }
  if (tokensReadBefore.some((earlier) => earlier.name === name)) {
    return `"${name}" is listed twice`;
  }
  const deviceWithTheSameToken = tokensReadBefore.find((earlier) => earlier.token === token);
  if (deviceWithTheSameToken !== undefined) {
    return `"${deviceWithTheSameToken.name}" and "${name}" have the same token`;
  }
  return undefined;
}

/**
 * The token of an `Authorization: Bearer <token>` header (the word in any case, as RFC
 * 9110 allows; spaces around the token trimmed), or undefined for a missing header, any
 * other scheme, or the word with nothing after it.
 */
export function readBearerTokenFromAuthorizationHeader(
  headerValue: string | undefined,
): string | undefined {
  if (headerValue === undefined) {
    return undefined;
  }
  const bearerPrefix = 'bearer ';
  const startsWithBearer = headerValue.slice(0, bearerPrefix.length).toLowerCase() === bearerPrefix;
  if (!startsWithBearer) {
    return undefined;
  }
  const token = headerValue.slice(bearerPrefix.length).trim();
  if (token === '') {
    return undefined;
  }
  return token;
}

/**
 * The name of the device whose token was presented, or undefined. Every listed token is
 * compared, and each comparison is of two SHA-256 digests with timingSafeEqual, so how
 * long it takes says nothing about how much of a token was right, nor its length.
 */
export function findNameOfMatchingApiToken(
  tokens: ApiToken[],
  presentedToken: string,
): string | undefined {
  const presentedDigest = computeDigestOfToken(presentedToken);
  let matchingName: string | undefined;
  for (const listed of tokens) {
    const isThisDevice = timingSafeEqual(presentedDigest, computeDigestOfToken(listed.token));
    // No early return: the loop takes as long for the first device as for none.
    if (isThisDevice) {
      matchingName = listed.name;
    }
  }
  return matchingName;
}

/** The SHA-256 of a token: 32 bytes whatever its length, as timingSafeEqual needs. */
function computeDigestOfToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}
