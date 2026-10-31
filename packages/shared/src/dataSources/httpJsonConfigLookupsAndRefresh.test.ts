/**
 * A flex source's lookups and per-request refresh time, in its config (packages/shared)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-53 a mapping may join a list from another request (a lookup), and a
 *   request may be fetched less often than the source is polled (`refreshEveryMs`), for a
 *   list that changes once an event, such as the teams. HttpJsonConfigSchema checks both
 *   when the source is saved.
 *
 * What these tests prove:
 *   - A config with a teams request refreshed every 10 minutes, joined by a lookup, passes.
 *   - A lookup reading a request the source does not have is refused, naming the shape and
 *     the lookup.
 *   - A refresh time under one minute (the longest poll interval) or over one hour, or not
 *     a whole number of ms, is refused.
 *
 * What these tests deliberately do not cover:
 *   - The lookup's own fields and the rules that read it: flexMappingConfigAdditions.test.ts.
 *   - Reusing a response between refreshes: the server's httpJson adapter tests.
 */
import { describe, expect, it } from 'vitest';

import {
  buildClassificationRequest,
  buildPositionsMappingFrom,
  findFirstIssue,
} from './httpJsonConfigExamples.testSupport.js';

/** The teams request of an imaginary results API, refreshed every `refreshEveryMs`. */
function buildTeamsRequest(refreshEveryMs: unknown): Record<string, unknown> {
  return {
    requestId: 'equipes',
    url: 'http://resultados.local/equipes',
    refreshEveryMs,
  };
}

/** The classification's positions mapping, its names joined from request `requestId`. */
function buildPositionsMappingJoiningTeamsFrom(requestId: string): Record<string, unknown> {
  return {
    ...buildPositionsMappingFrom('classificacao'),
    lookups: [
      {
        lookupName: 'equipes',
        requestId,
        listPath: 'teams',
        keyPath: 'number',
        entryKeyPath: 'carro',
      },
    ],
  };
}

/** The whole config: the classification and the teams request, and the joining mapping. */
function buildConfigJoiningTeams(options: {
  refreshEveryMs: unknown;
  lookupRequestId: string;
}): Record<string, unknown> {
  return {
    requests: [buildClassificationRequest(), buildTeamsRequest(options.refreshEveryMs)],
    mappings: [buildPositionsMappingJoiningTeamsFrom(options.lookupRequestId)],
  };
}

describe('HttpJsonConfigSchema, lookups and refresh times', () => {
  it('accepts a teams request refreshed every 10 minutes and joined by a lookup', () => {
    // Arrange: the classification polled as usual, the teams every 10 minutes.
    const config = buildConfigJoiningTeams({ refreshEveryMs: 600_000, lookupRequestId: 'equipes' });

    // Act: check it as a saved config is checked.
    const firstIssue = findFirstIssue(config);

    // Assert: no problem.
    expect(firstIssue, 'the config must pass').toBeUndefined();
  });

  it('refuses a lookup reading a request the source does not have', () => {
    // Arrange: the lookup names "times", a request this source does not make.
    const config = buildConfigJoiningTeams({ refreshEveryMs: 600_000, lookupRequestId: 'times' });

    // Act: check it.
    const firstIssue = findFirstIssue(config);

    // Assert: refused at the lookup's request, naming the shape and the lookup.
    expect(firstIssue, 'the lookup must name one of the requests').toEqual({
      path: 'mappings.0.lookups.0.requestId',
      message: 'A consulta "equipes" de Posições lê a requisição "times", que não existe nesta fonte.',
    });
  });

  const refusedRefreshScenarios: Array<{ name: string; refreshEveryMs: unknown }> = [
    // Under a minute could be shorter than the poll interval, where it would mean nothing.
    { name: 'refuses a refresh every 30 seconds', refreshEveryMs: 30_000 },
    // Over an hour, a teams list fixed during the event could stay wrong for too long.
    { name: 'refuses a refresh every two hours', refreshEveryMs: 7_200_000 },
    // A time in ms is a whole number.
    { name: 'refuses a refresh time with a fraction of a ms', refreshEveryMs: 600_000.5 },
  ];

  it.each(refusedRefreshScenarios)('$name', ({ refreshEveryMs }) => {
    // Arrange: the teams request with this row's refresh time.
    const config = buildConfigJoiningTeams({ refreshEveryMs, lookupRequestId: 'equipes' });

    // Act: check it.
    const firstIssue = findFirstIssue(config);

    // Assert: refused at the refresh time, with the range in the sentence.
    expect(firstIssue, 'the refresh time must be refused').toEqual({
      path: 'requests.1.refreshEveryMs',
      message:
        'O tempo de atualização da requisição vai de 1 minuto (60000 ms) a 1 hora (3600000 ms), em milissegundos inteiros.',
    });
  });
});
