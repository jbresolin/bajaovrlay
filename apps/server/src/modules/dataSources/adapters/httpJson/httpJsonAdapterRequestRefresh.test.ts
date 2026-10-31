/**
 * A request fetched less often than its source is polled (apps/server)
 *
 * What this module is for:
 *   A flex source joining a teams list (BAJAOVRLAY-53) would fetch that list at every
 *   poll, every 2 s, though it changes once an event. A request may set `refreshEveryMs`:
 *   between refreshes the poll reuses that request's last good response instead of
 *   fetching it again. A refresh that fails fails the poll like any failed request, and the
 *   next poll tries again, so a stale teams list is never reused past its time.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1, real fetch, the poll's clock
 * moved by hand):
 *   - The teams list is fetched at the first poll, reused until its 10 minutes are up (the
 *     race still fetched at every poll), and fetched again after; the names on air follow
 *     the list as of its last fetch.
 *   - A refresh that fails fails the poll, and the next poll fetches the list again.
 *   - A request without refreshEveryMs is fetched at every poll, as before.
 *   - A config change, the source's preparation (turned on, or its config saved) and a
 *     restart (a new adapter) all fetch the list again.
 *
 * What these tests deliberately do not cover:
 *   - The range of refreshEveryMs (1 minute to 1 hour): the shared config schema's tests.
 *   - The lookup that joins the list: the shared mapping's tests.
 */
import { type HttpJsonConfig, HttpJsonConfigSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../../../core/logger/createLogger.js';
import { createHttpJsonAdapter } from './httpJsonAdapter.js';
import { noSourceHostAllowlist } from './sourceHostAllowlist.js';
import {
  startTimingSystemTestServer,
  type TimingSystemTestServer,
} from './timingSystemTestServer.testSupport.js';

/** The first poll of these tests: 14:00:00 in Brasília on the enduro's day. */
const firstPollAtMs = Date.UTC(2026, 2, 28, 17, 0, 0);

/** Ten minutes: how often the teams list is fetched in these tests. */
const tenMinutesMs = 600_000;

/** The race's address and the teams list's on the test server. */
const racePath = '/resultados/corrida';
const teamsPath = '/resultados/equipes';

/** A race answer with one car, car 4, on its third lap. */
const raceAnswer = { prova_id: 'END', cars: [{ number: 4, team: 'Pato Baja', laps: 3 }] };

/** A teams answer naming car 4 with `shortName`. */
function buildTeamsAnswer(shortName: string) {
  return { teams: [{ number: 4, short_name: shortName }] };
}

/**
 * The flex source's config: the race at every poll, the teams every `teamsRefreshEveryMs`
 * (or at every poll when undefined), joined on the car's number.
 */
function buildRaceWithTeamsConfig(
  baseUrl: string,
  teamsRefreshEveryMs: number | undefined,
): HttpJsonConfig {
  const teamsRequest: Record<string, unknown> = {
    requestId: 'equipes',
    url: `${baseUrl}${teamsPath}`,
  };
  if (teamsRefreshEveryMs !== undefined) {
    teamsRequest.refreshEveryMs = teamsRefreshEveryMs;
  }
  return HttpJsonConfigSchema.parse({
    requests: [{ requestId: 'corrida', url: `${baseUrl}${racePath}` }, teamsRequest],
    mappings: [
      {
        shapeKey: 'positions',
        requestId: 'corrida',
        entriesPath: 'cars',
        lookups: [
          {
            lookupName: 'equipes',
            requestId: 'equipes',
            listPath: 'teams',
            keyPath: 'number',
            entryKeyPath: 'number',
          },
        ],
        fields: [{ targetField: 'sessionId', fromPath: 'prova_id' }],
        entryFields: [
          { targetField: 'carNumber', fromPath: 'number' },
          {
            targetField: 'teamName',
            firstOf: [
              { fromLookup: { lookup: 'equipes', path: 'short_name' } },
              { fromPath: 'team' },
            ],
          },
        ],
      },
    ],
  });
}

/** The adapter as the server builds it, silent, with no host list. */
function createAdapterForRefreshTests() {
  return createHttpJsonAdapter({
    logger: createLogger({ level: 'silent' }),
    readEnvironmentVariable: () => undefined,
    sourceHostAllowlist: noSourceHostAllowlist,
  });
}

/** A poll context whose clock reads `secondsAfterTheFirstPoll` after the first poll. */
function buildPollContextAt(secondsAfterTheFirstPoll: number) {
  return {
    readCurrentTime: () => new Date(firstPollAtMs + secondsAfterTheFirstPoll * 1_000),
    signal: new AbortController().signal,
  };
}

/** How many times the test server was asked for `path`. */
function countRequestsFor(server: TimingSystemTestServer, path: string): number {
  return server.readRequestsReceived().filter((request) => request.pathWithQuery === path).length;
}

/** The team name the poll put on car 4. */
function readTeamNameOfCarFour(answer: { shapes: Record<string, unknown> }): unknown {
  const positions = answer.shapes.positions as { entries: Array<{ teamName: unknown }> };
  return positions.entries[0]?.teamName;
}

/** Starts the test server answering the race and the teams list naming car 4 "Pato". */
async function startResultsServer(): Promise<TimingSystemTestServer> {
  const server = await startTimingSystemTestServer();
  server.answer(racePath, { kind: 'json', body: raceAnswer });
  server.answer(teamsPath, { kind: 'json', body: buildTeamsAnswer('Pato') });
  return server;
}

describe('a request with its own refresh time', () => {
  it('fetches the teams at the first poll, reuses them for 10 minutes, then fetches again', async () => {
    // Arrange: the results server, and the teams refreshed every 10 minutes.
    const server = await startResultsServer();
    const config = buildRaceWithTeamsConfig(server.baseUrl, tenMinutesMs);
    const adapter = createAdapterForRefreshTests();

    // Act: poll at 0 s and 2 s; rename the team; poll at 599 s, then at 600 s.
    const answerAtStart = await adapter.pollOnce(config, buildPollContextAt(0));
    await adapter.pollOnce(config, buildPollContextAt(2));
    server.answer(teamsPath, { kind: 'json', body: buildTeamsAnswer('Pato Baja UTFPR') });
    const answerJustBeforeTheRefresh = await adapter.pollOnce(config, buildPollContextAt(599));
    const teamsFetchesBeforeTheRefresh = countRequestsFor(server, teamsPath);
    const answerAtTheRefresh = await adapter.pollOnce(config, buildPollContextAt(600));

    // Assert: the race fetched at all four polls, the teams once before the refresh and
    // again at it; the name on air follows the teams list as of its last fetch.
    expect(countRequestsFor(server, racePath), 'the race must be fetched at every poll').toBe(4);
    expect(teamsFetchesBeforeTheRefresh, 'the teams must be fetched once in 10 minutes').toBe(1);
    expect(
      countRequestsFor(server, teamsPath),
      'the teams must be fetched again at 10 minutes',
    ).toBe(2);
    expect(readTeamNameOfCarFour(answerAtStart), 'the first fetch names car 4').toBe('Pato');
    expect(
      readTeamNameOfCarFour(answerJustBeforeTheRefresh),
      'the reused list still names car 4 as it was fetched',
    ).toBe('Pato');
    expect(readTeamNameOfCarFour(answerAtTheRefresh), 'the refreshed list renames car 4').toBe(
      'Pato Baja UTFPR',
    );
  });

  it('fails the poll when the refresh fails, and tries again at the next poll', async () => {
    // Arrange: the teams fetched at the first poll, then the teams address failing.
    const server = await startResultsServer();
    const config = buildRaceWithTeamsConfig(server.baseUrl, tenMinutesMs);
    const adapter = createAdapterForRefreshTests();
    await adapter.pollOnce(config, buildPollContextAt(0));
    server.answer(teamsPath, { kind: 'json', status: 503, body: { erro: 'manutenção' } });

    // Act: poll when the 10 minutes are up, then put the teams back and poll 2 s later.
    const refreshPolling = adapter.pollOnce(config, buildPollContextAt(600));
    await expect(refreshPolling, 'a failed refresh must fail the poll').rejects.toThrow(
      'A fonte respondeu 503 (Service Unavailable) em equipes',
    );
    server.answer(teamsPath, { kind: 'json', body: buildTeamsAnswer('Pato') });
    await adapter.pollOnce(config, buildPollContextAt(602));

    // Assert: three fetches of the teams: the first, the failed refresh, the retry.
    expect(countRequestsFor(server, teamsPath), 'the next poll must try the teams again').toBe(3);
  });

  it('fetches a request without a refresh time at every poll, as before', async () => {
    // Arrange: the teams with no refreshEveryMs.
    const server = await startResultsServer();
    const config = buildRaceWithTeamsConfig(server.baseUrl, undefined);
    const adapter = createAdapterForRefreshTests();

    // Act: poll three times, 2 s apart.
    await adapter.pollOnce(config, buildPollContextAt(0));
    await adapter.pollOnce(config, buildPollContextAt(2));
    await adapter.pollOnce(config, buildPollContextAt(4));

    // Assert: the teams fetched at every poll.
    expect(countRequestsFor(server, teamsPath), 'the teams must be fetched every poll').toBe(3);
  });

  const fetchedAgainScenarios: Array<{
    name: string;
    pollAgain: (options: {
      adapter: ReturnType<typeof createAdapterForRefreshTests>;
      config: HttpJsonConfig;
      baseUrl: string;
    }) => Promise<unknown>;
  }> = [
    // A config saved with a change (here the teams' refresh time) is a new config.
    {
      name: 'fetches the teams again after a config change',
      pollAgain: ({ adapter, baseUrl }) =>
        adapter.pollOnce(
          buildRaceWithTeamsConfig(baseUrl, 2 * tenMinutesMs),
          buildPollContextAt(2),
        ),
    },
    // The poller prepares a source when it is turned on and when its config is saved.
    {
      name: 'fetches the teams again after the source is prepared once more',
      pollAgain: ({ adapter, config }) => {
        adapter.prepareForPolling?.(config);
        return adapter.pollOnce(config, buildPollContextAt(2));
      },
    },
    // A restarted server builds a new adapter, which remembers nothing.
    {
      name: 'fetches the teams again after a restart',
      pollAgain: ({ config }) =>
        createAdapterForRefreshTests().pollOnce(config, buildPollContextAt(2)),
    },
  ];

  it.each(fetchedAgainScenarios)('$name', async ({ pollAgain }) => {
    // Arrange: the teams fetched at the first poll, refreshed every 10 minutes.
    const server = await startResultsServer();
    const config = buildRaceWithTeamsConfig(server.baseUrl, tenMinutesMs);
    const adapter = createAdapterForRefreshTests();
    await adapter.pollOnce(config, buildPollContextAt(0));

    // Act: poll again 2 s later, after this row's change.
    await pollAgain({ adapter, config, baseUrl: server.baseUrl });

    // Assert: the teams fetched twice, though their 10 minutes are not up.
    expect(countRequestsFor(server, teamsPath), 'the teams must be fetched again').toBe(2);
  });
});
