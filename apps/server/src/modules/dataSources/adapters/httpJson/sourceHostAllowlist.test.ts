/**
 * The list of hosts a flex source may fetch (apps/server)
 *
 * What this module is for:
 *   BAJAOVRLAY_SOURCE_ALLOWED_HOSTS (see .env.example) lists, comma-separated, the hosts a
 *   flex HTTP/JSON source may send a request to: "cronometragem.local" (any port) or
 *   "cronometragem.local:8080" (that port only). With the list set, a request to any
 *   other host is refused before it is built, so a BAJAOVRLAY_SOURCE_ secret cannot be
 *   sent to an address an operator typed. With the list unset, any host is allowed but
 *   no variable's value is sent (httpJsonRequestAddress.ts).
 *
 * What these tests prove:
 *   - Parsing: an unset or empty variable means "no list"; entries are trimmed, empty
 *     entries between commas are skipped, a host is compared in lower case, a port with
 *     leading zeros is the same port, an IPv6 host is written in brackets; an entry that
 *     is not a host or host:port (a path, a scheme, a port out of range, a bare IPv6) is
 *     refused, naming it.
 *   - Matching: a host entry allows that host on any port, a host:port entry only that
 *     port, a request with no port written uses 80 (http) or 443 (https), capitals do not
 *     matter, and a list that is not set allows every host.
 *   - The first request of a config to a host not on the list is found, with its id and host.
 *
 * What these tests deliberately do not cover:
 *   - Refusing a poll, a sample or a config with that answer: httpJsonHostAllowlist.test.ts,
 *     httpJsonSampleRouteHostAllowlist.test.ts, reducers/dataSourceHostAllowlist.test.ts
 *     and core/boot/startServerSourceHostAllowlist.test.ts.
 *   - Reading the variable at boot: core/env/readServerEnvironment.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  findFirstRequestToAHostNotAllowed,
  isHostOfAddressAllowed,
  parseSourceHostAllowlist,
  type SourceHostAllowlist,
} from './sourceHostAllowlist.js';

/** Parses a list that must be valid, failing the test with the bad entry otherwise. */
function parseValidAllowlist(text: string | undefined): SourceHostAllowlist {
  const parsing = parseSourceHostAllowlist(text);
  if (!parsing.isValid) {
    throw new Error(`the list was expected to be valid, but "${parsing.badEntry}" was refused`);
  }
  return parsing.allowlist;
}

describe('parseSourceHostAllowlist', () => {
  const validListScenarios = [
    // Most installs that never set it: no list at all.
    { name: 'reads an unset variable as no list', text: undefined, expected: { isSet: false } },
    // "BAJAOVRLAY_SOURCE_ALLOWED_HOSTS=" as copied from .env.example counts as unset too,
    // like a variable set to nothing elsewhere in the server.
    { name: 'reads an empty variable as no list', text: '', expected: { isSet: false } },
    // The timing system on the LAN and the federation's API, with spaces after the comma.
    {
      name: 'reads a host and a host:port, trimmed, the host in lower case',
      text: 'Cronometragem.LOCAL:8080, api.bajasaebrasil.org.br',
      expected: {
        isSet: true,
        allowedHosts: [
          { hostName: 'cronometragem.local', port: '8080' },
          { hostName: 'api.bajasaebrasil.org.br', port: undefined },
        ],
      },
    },
    // A trailing comma left after deleting an entry must not create an empty one.
    {
      name: 'skips empty entries between commas',
      text: '192.168.0.50:4790,,',
      expected: { isSet: true, allowedHosts: [{ hostName: '192.168.0.50', port: '4790' }] },
    },
    // "08080" and "8080" are the same port, as the request address writes it.
    {
      name: 'reads a port with leading zeros as the same port',
      text: 'cronometragem.local:08080',
      expected: { isSet: true, allowedHosts: [{ hostName: 'cronometragem.local', port: '8080' }] },
    },
    // An IPv6 host is written in brackets, as in an address; the address writes it short.
    {
      name: 'reads an IPv6 host in brackets, with and without a port',
      text: '[::1]:4790, [FE80:0:0:0::7]',
      expected: {
        isSet: true,
        allowedHosts: [
          { hostName: '[::1]', port: '4790' },
          { hostName: '[fe80::7]', port: undefined },
        ],
      },
    },
  ];

  it.each(validListScenarios)('$name', ({ text, expected }) => {
    // Arrange: the variable's text, from the row above.

    // Act: parse it.
    const parsing = parseSourceHostAllowlist(text);

    // Assert: it is the list the row expects.
    expect(parsing, 'the list must be read as the row says').toEqual({
      isValid: true,
      allowlist: expected,
    });
  });

  const badEntryScenarios = [
    // Pasted a whole address: the scheme and path are not part of a host.
    { name: 'refuses an address with a scheme', text: 'http://cronometragem.local' },
    // A path would read as if only that path were allowed, which is not what is checked.
    { name: 'refuses a host with a path', text: 'cronometragem.local/api' },
    // No port 70 000 exists.
    { name: 'refuses a port out of range', text: 'cronometragem.local:70000' },
    // A port of letters is a typo.
    { name: 'refuses a port that is not a number', text: 'cronometragem.local:http' },
    // A bare IPv6 cannot be told from host:port, so it must be in brackets.
    { name: 'refuses an IPv6 host without brackets', text: 'fe80::7' },
    // A colon with nothing after it is a port left out by mistake.
    { name: 'refuses an empty port', text: 'cronometragem.local:' },
  ];

  it.each(badEntryScenarios)('$name', ({ text }) => {
    // Arrange: a list holding a good entry and the row's bad one.
    const listWithABadEntry = `api.bajasaebrasil.org.br, ${text}`;

    // Act: parse it.
    const parsing = parseSourceHostAllowlist(listWithABadEntry);

    // Assert: the list is refused, naming the bad entry as it was written.
    expect(parsing, 'the bad entry must be named').toEqual({ isValid: false, badEntry: text });
  });
});

describe('isHostOfAddressAllowed', () => {
  const matchingScenarios = [
    // The plain case: a host entry, a request on its own port.
    {
      name: 'allows a listed host on any port',
      list: 'cronometragem.local',
      address: 'http://cronometragem.local:8080/api/classificacao',
      isAllowed: true,
    },
    // A port entry allows that port only: another service on the same machine is refused.
    {
      name: 'refuses a listed host on a port other than the listed one',
      list: 'cronometragem.local:8080',
      address: 'http://cronometragem.local:9000/api/classificacao',
      isAllowed: false,
    },
    // A request with no port written goes to 80 for http, so it matches ":80".
    {
      name: 'reads an http address with no port as port 80',
      list: 'cronometragem.local:80',
      address: 'http://cronometragem.local/api/classificacao',
      isAllowed: true,
    },
    // And to 443 for https, so ":80" does not match it.
    {
      name: 'reads an https address with no port as port 443',
      list: 'api.bajasaebrasil.org.br:80',
      address: 'https://api.bajasaebrasil.org.br/v1/enduro',
      isAllowed: false,
    },
    // Capitals in the typed address do not matter.
    {
      name: 'compares hosts without regard to capitals',
      list: 'cronometragem.local',
      address: 'http://CRONOMETRAGEM.Local:8080/api/classificacao',
      isAllowed: true,
    },
    // A host whose name only starts like a listed one is another host.
    {
      name: 'refuses a host that only shares the beginning of a listed one',
      list: 'cronometragem.local',
      address: 'http://cronometragem.local.coletor.example/api',
      isAllowed: false,
    },
    // The IPv6 loopback, as the address writes it.
    {
      name: 'allows an IPv6 host listed in brackets',
      list: '[::1]:4790',
      address: 'http://[::1]:4790/cronometragem/classificacao',
      isAllowed: true,
    },
  ];

  it.each(matchingScenarios)('$name', ({ list, address, isAllowed }) => {
    // Arrange: the list and the address of the row.
    const allowlist = parseValidAllowlist(list);

    // Act: ask whether the address's host is on the list.
    const answer = isHostOfAddressAllowed(new URL(address), allowlist);

    // Assert: the answer is the row's.
    expect(answer, 'the host must be allowed or refused as the row says').toBe(isAllowed);
  });

  it('allows every host when no list is set', () => {
    // Arrange: no list.
    const allowlist = parseValidAllowlist(undefined);

    // Act: ask about an address on the internet.
    const answer = isHostOfAddressAllowed(new URL('https://coletor.example/recebe'), allowlist);

    // Assert: it is allowed (no variable's value is sent then, see httpJsonRequestAddress.ts).
    expect(answer, 'without a list every host is allowed').toBe(true);
  });
});

describe('findFirstRequestToAHostNotAllowed', () => {
  it('names the first request of a config whose host is not on the list', () => {
    // Arrange: a list with the timing system only, and a config whose second and third
    // requests go elsewhere.
    const allowlist = parseValidAllowlist('cronometragem.local:8080');
    const requests = [
      { requestId: 'classificacao', url: 'http://cronometragem.local:8080/api/classificacao' },
      { requestId: 'direcao_de_prova', url: 'http://coletor.example:8443/recebe' },
      { requestId: 'boletim', url: 'https://outro.example/boletim' },
    ].map((request) => ({ ...request, headers: [], queryParameters: [] }));

    // Act: look for a request the list does not allow.
    const requestNotAllowed = findFirstRequestToAHostNotAllowed(requests, allowlist);

    // Assert: the second request, with its host and port as the address writes them.
    expect(requestNotAllowed, 'the first request off the list must be named').toEqual({
      requestId: 'direcao_de_prova',
      host: 'coletor.example:8443',
    });
  });
});
