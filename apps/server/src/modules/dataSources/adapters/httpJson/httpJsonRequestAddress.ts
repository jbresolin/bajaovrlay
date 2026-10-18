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

/**
 * Builds the address (the config's URL with its query parameters added) and the headers
 * of one request, reading every BAJAOVRLAY_SOURCE_ variable it names at this moment, so a
 * token changed on the server is sent from the next poll on. A variable that is not set,
 * or set to nothing, stops the request with a pt-BR error naming it; a header value with
 * a line break is refused by name. Neither error quotes a value.
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
    const isFromAVariable = header.valueFromEnvironment !== undefined;
    if (isFromAVariable && lineBreakOrNulPattern.test(resolved.value)) {
      const variableName = header.valueFromEnvironment ?? '';
      return {
        ok: false,
        error: ptBR.httpJsonErrors.environmentVariableWithLineBreak(variableName),
      };
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
