// The address and headers one request of a flex source is sent with, its values from
// environment variables read now. Kept apart from the fetch so the one place that holds
// a secret in memory is small enough to read whole.
import type { HttpJsonHeader, HttpJsonQueryParameter, HttpJsonRequest } from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';

/**
 * Reads one environment variable of the server, or undefined when it is not set. The
 * server reads process.env; tests hand in a plain table.
 */
export type ReadEnvironmentVariable = (variableName: string) => string | undefined;

/** Reads one variable of the server's own environment (process.env) as it is now. */
export function readServerEnvironmentVariable(variableName: string): string | undefined {
  return process.env[variableName];
}

/**
 * The address and headers to send, or why the request cannot be sent. The address and
 * headers may hold secrets: they go to fetch and nowhere else (never a log, never an error).
 */
export type HttpJsonRequestToSend =
  { ok: true; address: URL; headers: Array<[string, string]> } | { ok: false; error: string };

// The value of one header or query parameter, or why it has none.
type ResolvedValue = { ok: true; value: string } | { ok: false; error: string };

// A line break or NUL in a header value would let one value write a second header.
const lineBreakOrNulPattern = /[\r\n\0]/;

// What Node's fetch lets into a header value: tab, the visible ASCII and space, and the
// rest of Latin-1 (the same rule the config schema applies to a typed value). Anything
// else makes fetch throw before sending, which would read as a network failure.
const headerValueCharactersPattern = /^[\t\x20-\x7e\x80-\xff]*$/;

/**
 * Builds the address (the config's URL with its query parameters added) and the headers
 * of one request, reading every BAJAOVRLAY_SOURCE_ variable it names at this moment, so a
 * token changed on the server is sent from the next poll on. A variable that is not set,
 * or set to nothing, stops the request with a pt-BR error naming it; a header value from
 * a variable with a line break, or with a character fetch refuses (an emoji), is refused
 * by the variable's name. No error quotes a value.
 */
export function buildHttpJsonRequestToSend(
  request: HttpJsonRequest,
  readEnvironmentVariable: ReadEnvironmentVariable,
): HttpJsonRequestToSend {
  const address = new URL(request.url);
  for (const queryParameter of request.queryParameters) {
    const resolved = resolveValue(queryParameter, readEnvironmentVariable);
    if (!resolved.ok) {
      return resolved;
    }
    address.searchParams.append(queryParameter.name, resolved.value);
  }

  const headers: Array<[string, string]> = [];
  for (const header of request.headers) {
    const resolved = resolveValue(header, readEnvironmentVariable);
    if (!resolved.ok) {
      return resolved;
    }
    const variableName = header.valueFromEnvironment;
    if (variableName !== undefined) {
      const variableProblem = findWhyAVariableCannotGoInAHeader(variableName, resolved.value);
      if (variableProblem !== undefined) {
        return { ok: false, error: variableProblem };
      }
    }
    headers.push([header.name, resolved.value]);
  }

  return { ok: true, address, headers };
}

/** The value of a header or query parameter: as written, or read from its variable now. */
function resolveValue(
  nameAndValue: HttpJsonHeader | HttpJsonQueryParameter,
  readEnvironmentVariable: ReadEnvironmentVariable,
): ResolvedValue {
  if (nameAndValue.value !== undefined) {
    return { ok: true, value: nameAndValue.value };
  }
  // The config schema makes sure exactly one of the two is there.
  const variableName = nameAndValue.valueFromEnvironment ?? '';
  const valueOfTheVariable = readEnvironmentVariable(variableName);
  // Set to nothing counts as not set: an empty token is never what the operator meant.
  if (valueOfTheVariable === undefined || valueOfTheVariable === '') {
    return { ok: false, error: ptBR.httpJsonErrors.environmentVariableNotSet(variableName) };
  }
  return { ok: true, value: valueOfTheVariable };
}

/**
 * The pt-BR reason a variable's value cannot be sent as a header, or undefined when it
 * can. The schema checked a typed value when the config was saved; a variable's value is
 * only known now. The reason names the variable, never its value.
 */
function findWhyAVariableCannotGoInAHeader(
  variableName: string,
  valueOfTheVariable: string,
): string | undefined {
  if (lineBreakOrNulPattern.test(valueOfTheVariable)) {
    return ptBR.httpJsonErrors.environmentVariableWithLineBreak(variableName);
  }
  if (!headerValueCharactersPattern.test(valueOfTheVariable)) {
    return ptBR.httpJsonErrors.environmentVariableWithCharacterHttpRefuses(variableName);
  }
  return undefined;
}
