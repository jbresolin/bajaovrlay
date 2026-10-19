/**
 * Header names a flex source may not set (packages/shared)
 *
 * What this module is for:
 *   A flex source's request carries headers the operator types, often copied from the
 *   browser's devtools. Node's fetch (undici) manages a few headers itself and throws
 *   before sending anything when a request sets one of them: Connection, Keep-Alive,
 *   Transfer-Encoding, Upgrade, Content-Length and Expect. Left in a config, such a
 *   header would make every poll fail as a "falha de rede", sending the operator to look
 *   for a network problem that does not exist. HttpJsonConfigSchema refuses them at save.
 *
 * What these tests prove:
 *   - Each of the six names is refused at the header's name, with a pt-BR sentence
 *     saying the server controls that header, whatever its capitals.
 *   - A header these names only resemble (Accept-Encoding, X-Connection-Id) is accepted.
 *
 * What these tests deliberately do not cover:
 *   - Every other header rule (token names, line breaks, Latin-1 values, variables):
 *     httpJsonConfig.test.ts covers them.
 *   - That fetch really throws on these names: that was checked by hand against Node 22
 *     (UND_ERR_INVALID_ARG, UND_ERR_NOT_SUPPORTED for Expect) and is a fact of undici.
 */
import { describe, expect, it } from 'vitest';

import { HttpJsonConfigSchema } from './httpJsonConfig.js';
import {
  buildConfigWithRequestChanges,
  findFirstIssue,
} from './httpJsonConfigExamples.testSupport.js';

const headerNamesFetchRefusesScenarios = [
  // Copied from devtools with every browser request: the case that started this rule.
  {
    name: 'refuses Connection, as devtools shows it',
    header: { name: 'Connection', value: 'keep-alive' },
  },
  // Also in devtools copies from older browsers and proxies.
  {
    name: 'refuses Keep-Alive',
    header: { name: 'Keep-Alive', value: 'timeout=5' },
  },
  // The server frames the request itself; a typed one would contradict it.
  {
    name: 'refuses Transfer-Encoding',
    header: { name: 'Transfer-Encoding', value: 'chunked' },
  },
  // A poll is a plain GET; switching protocols is not something a poll can do.
  {
    name: 'refuses Upgrade',
    header: { name: 'Upgrade', value: 'websocket' },
  },
  // fetch counts the body's length itself, and a GET has no body.
  {
    name: 'refuses Content-Length',
    header: { name: 'Content-Length', value: '0' },
  },
  // fetch does not support Expect at all (UND_ERR_NOT_SUPPORTED).
  {
    name: 'refuses Expect',
    header: { name: 'Expect', value: '100-continue' },
  },
  // Header names are case-insensitive, so the lower-case spelling is the same header.
  {
    name: 'refuses connection written in lower case',
    header: { name: 'connection', value: 'close' },
  },
];

describe('HttpJsonConfigSchema and the headers fetch sets itself', () => {
  it.each(headerNamesFetchRefusesScenarios)('$name', ({ header }) => {
    // Arrange: the classification request with that one header, as an operator pasted it.
    const config = buildConfigWithRequestChanges({ headers: [header] });

    // Act: check it as a saved config is checked.
    const firstIssue = findFirstIssue(config);

    // Assert: refused at the header's name, saying the server controls that header.
    expect(firstIssue, 'a header fetch sets itself must be refused at its name').toEqual({
      path: 'requests.0.headers.0.name',
      message: `O cabeçalho "${header.name}" é controlado pelo próprio servidor e não pode ser definido.`,
    });
  });

  it('accepts headers that only resemble those names', () => {
    // Arrange: two real headers whose names contain "Encoding" and "Connection".
    const config = buildConfigWithRequestChanges({
      headers: [
        { name: 'Accept-Encoding', value: 'gzip' },
        { name: 'X-Connection-Id', value: 'baja-ufpr-42' },
      ],
    });

    // Act: check it as a saved config is checked.
    const parsing = HttpJsonConfigSchema.safeParse(config);

    // Assert: accepted, since only the exact names are the server's.
    expect(parsing.success, 'a name that merely contains a refused word must pass').toBe(true);
  });
});
