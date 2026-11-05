/**
 * GET /api/v1/event-log, the older pages of the history (apps/server)
 *
 * What this module is for:
 *   The history page (`#/historico`, BAJAOVRLAY-30) shows every change of the show in
 *   plain pt-BR. The eventLog slice carries the newest 200 rows live; anything older is
 *   read from the event_log table through this route, a page at a time ("Carregar mais"),
 *   newest first. The page's filters (who, group of commands, layer, only refusals, free
 *   text over the sentence) run here for those older pages, with the same shared rules the
 *   page runs on its live rows. The control page reads the route as it reads /state; a
 *   caller from outside (a script, Companion) goes through the command API's access rules.
 *
 * What these tests prove (on a real store and SQLite file, the app called in memory):
 *   - Rows come newest first; `limit` caps a page, `before` continues below a row id, and
 *     `hasOlder` says whether there is more; with no limit a page is 100 rows; a limit over
 *     500 is refused in pt-BR.
 *   - Each filter keeps only its rows: who sent it, the group of commands, a layer, only
 *     refusals, and a free text matched without caring about accents or capitals.
 *   - The control page (a same-origin request, no token) reads it with the command API off;
 *     from outside it answers 403 with the API off, 401 to a wrong token, 200 to a right
 *     token, and 200 with no token when the API is open to the network.
 *
 * What these tests deliberately do not cover:
 *   - The sentence of each command type; packages/shared's sentenceOfEachCommandType.test.ts.
 *   - The page that calls it; apps/control's HistoryPage tests.
 */
import { describe, expect, it } from 'vitest';

import {
  apiTokensOfTheDesk,
  companionToken,
  wrongToken,
} from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  createAppWithTheCommandApi,
  operatorActor,
  prepareTheRaceDay,
} from './commandApiOnTheApp.testSupport.js';

/** What the route answers, as these tests read it. */
type EventLogPageAsRead = {
  entries: Array<{ id: number; actor: string; command: string; result: { status: string } }>;
  hasOlder: boolean;
};

/** The headers a browser sends with the control page's own fetch: same site, no token. */
const headersOfTheControlPage = { 'sec-fetch-site': 'same-origin' };

/**
 * A race day on an app with Companion's token: the items and macro of prepareTheRaceDay,
 * then the enduro clock taken by the operator, the clock layer cleared by Companion and a
 * take of an item that does not exist, refused.
 */
function createAppWithARaceDayLogged() {
  const appWithTheApi = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
  const raceDay = prepareTheRaceDay(appWithTheApi.stateStore);
  applyOrThrow(appWithTheApi.stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });
  appWithTheApi.stateStore.applyCommand({ type: 'clearLayer', layerId: 'clock' }, 'api:companion');
  appWithTheApi.stateStore.applyCommand(
    { type: 'takeItem', itemId: 'item-tarja-apagada' },
    operatorActor,
  );
  return appWithTheApi;
}

/** Asks the route as the control page does and reads the page it answers. */
async function readEventLogPageAsTheControlPage(
  app: ReturnType<typeof createAppWithTheCommandApi>['app'],
  query: string,
): Promise<EventLogPageAsRead> {
  const response = await app.request(`http://localhost/api/v1/event-log${query}`, {
    headers: headersOfTheControlPage,
  });
  if (response.status !== 200) {
    throw new Error(`the route answered ${String(response.status)}: ${await response.text()}`);
  }
  return (await response.json()) as EventLogPageAsRead;
}

/** The ids of every row the store has logged, newest first. */
function readIdsOfEveryRowNewestFirst(stateStore: StateStore): number[] {
  return stateStore
    .readAllSlices()
    .eventLog.map((entry) => entry.id)
    .reverse();
}

describe('GET /api/v1/event-log, paging', () => {
  it('answers the newest rows first, a page at a time, and says when there are older ones', async () => {
    // Arrange: the race day's rows.
    const { app, stateStore } = createAppWithARaceDayLogged();
    const everyIdNewestFirst = readIdsOfEveryRowNewestFirst(stateStore);

    // Act: read three rows, then the three below the last one read, then the rest.
    const firstPage = await readEventLogPageAsTheControlPage(app, '?limit=3');
    const lastIdOfFirstPage = firstPage.entries.at(-1)?.id ?? 0;
    const secondPage = await readEventLogPageAsTheControlPage(
      app,
      `?limit=3&before=${String(lastIdOfFirstPage)}`,
    );
    const lastIdOfSecondPage = secondPage.entries.at(-1)?.id ?? 0;
    const thirdPage = await readEventLogPageAsTheControlPage(
      app,
      `?limit=3&before=${String(lastIdOfSecondPage)}`,
    );

    // Assert: the pages follow one another with no gap and no repeat, newest first.
    const idsReadInTurn = [...firstPage.entries, ...secondPage.entries, ...thirdPage.entries].map(
      (entry) => entry.id,
    );
    expect(idsReadInTurn, 'three pages must give every row once, newest first').toEqual(
      everyIdNewestFirst,
    );
    expect(firstPage.hasOlder, 'the first page has more below it').toBe(true);
    expect(thirdPage.hasOlder, 'the last page has nothing below it').toBe(false);
  });

  it('answers 100 rows when no limit is asked for', async () => {
    // Arrange: the race day, then the rundown's cursor moved by hand 110 times.
    const { app, stateStore } = createAppWithARaceDayLogged();
    const enduroClockItem = stateStore
      .readAllSlices()
      .items.find((item) => item.home.kind === 'rundown');
    for (let move = 0; move < 110; move += 1) {
      applyOrThrow(stateStore, {
        type: 'moveCursor',
        rundownId: 'sessao-principal',
        itemId: move % 2 === 0 ? null : (enduroClockItem?.id ?? null),
      });
    }

    // Act: read one page with no limit.
    const page = await readEventLogPageAsTheControlPage(app, '');

    // Assert: 100 rows, and more below.
    expect(page.entries.length, 'a page is 100 rows unless asked otherwise').toBe(100);
    expect(page.hasOlder, 'there are more rows than one page').toBe(true);
  });

  it('refuses a limit over 500 in pt-BR', async () => {
    // Arrange: the race day.
    const { app } = createAppWithARaceDayLogged();

    // Act: ask for 501 rows.
    const response = await app.request('http://localhost/api/v1/event-log?limit=501', {
      headers: headersOfTheControlPage,
    });

    // Assert: 400, with the reason in pt-BR.
    expect(response.status, 'a page over 500 rows is refused').toBe(400);
    expect(await response.json(), 'the refusal must say what is allowed').toEqual({
      error: {
        code: 'INVALID_EVENT_LOG_QUERY',
        message:
          'Consulta do histórico inválida: "limit" vai de 1 a 500, "before" é o número de uma linha e cada filtro aceita só os seus valores.',
      },
    });
  });
});

const filterScenarios = [
  // Companion's "Limpar" is the one row an API device sent.
  {
    name: 'keeps the rows of one kind of sender',
    query: '?who=api',
    expectedCommands: ['clearLayer'],
  },
  // A take, a clear and the refused take are takes and clears; the items are not.
  {
    name: 'keeps the rows of one group of commands',
    query: '?group=takesAndClears',
    expectedCommands: ['takeItem', 'clearLayer', 'takeItem'],
  },
  // The clock layer's take and clear, and the enduro clock made for that layer; the
  // refused take names an item that is gone, so no layer.
  {
    name: 'keeps the rows that touch one layer',
    query: '?layerId=clock',
    expectedCommands: ['clearLayer', 'takeItem', 'createItem'],
  },
  // Only the take of an item that does not exist was refused.
  {
    name: 'keeps only the refusals',
    query: '?onlyRefusals=true',
    expectedCommands: ['takeItem'],
  },
  // Typed without the accent and in capitals, as an operator types in a hurry.
  {
    name: 'keeps the rows whose sentence holds the text, accents and capitals aside',
    query: '?text=RELOGIO%20DO%20ENDURO',
    expectedCommands: ['takeItem', 'createItem'],
  },
];

describe('GET /api/v1/event-log, filters', () => {
  it.each(filterScenarios)('$name', async ({ query, expectedCommands }) => {
    // Arrange: the race day's rows.
    const { app } = createAppWithARaceDayLogged();

    // Act: read the page with the filter.
    const page = await readEventLogPageAsTheControlPage(app, query);

    // Assert: exactly the rows the filter keeps, newest first.
    expect(
      page.entries.map((entry) => entry.command),
      'the filter must keep exactly its rows',
    ).toEqual(expectedCommands);
  });
});

const accessScenarios: Array<{
  name: string;
  apiTokensVariable: string | undefined;
  isApiOpenToTheNetwork: boolean;
  headers: Record<string, string>;
  expectedStatus: number;
}> = [
  // The control page reads it as it reads /state, with or without the command API.
  {
    name: 'answers the control page with the command API off',
    apiTokensVariable: undefined,
    isApiOpenToTheNetwork: false,
    headers: headersOfTheControlPage,
    expectedStatus: 200,
  },
  // A script on the network with the API off learns how to turn it on.
  {
    name: 'answers 403 to a caller from outside with the command API off',
    apiTokensVariable: undefined,
    isApiOpenToTheNetwork: false,
    headers: {},
    expectedStatus: 403,
  },
  // An old token is told so.
  {
    name: 'answers 401 to a wrong token',
    apiTokensVariable: apiTokensOfTheDesk,
    isApiOpenToTheNetwork: false,
    headers: { authorization: `Bearer ${wrongToken}` },
    expectedStatus: 401,
  },
  // Companion with its own token reads it.
  {
    name: 'answers a device with its right token',
    apiTokensVariable: apiTokensOfTheDesk,
    isApiOpenToTheNetwork: false,
    headers: { authorization: `Bearer ${companionToken}` },
    expectedStatus: 200,
  },
  // On the studio's own network, open mode lets any caller in, as for the commands.
  {
    name: 'answers a caller with no token when the API is open to the network',
    apiTokensVariable: undefined,
    isApiOpenToTheNetwork: true,
    headers: {},
    expectedStatus: 200,
  },
  // A page of another site cannot pass for the control page by the header alone being
  // missing: a cross-site fetch says cross-site, and needs a token like any outside caller.
  {
    name: 'answers 403 to a page of another site with the command API off',
    apiTokensVariable: undefined,
    isApiOpenToTheNetwork: false,
    headers: { 'sec-fetch-site': 'cross-site' },
    expectedStatus: 403,
  },
];

describe('GET /api/v1/event-log, access', () => {
  it.each(accessScenarios)(
    '$name',
    async ({ apiTokensVariable, isApiOpenToTheNetwork, headers, expectedStatus }) => {
      // Arrange: an app with the command API as the row says.
      const { app } = createAppWithTheCommandApi({ apiTokensVariable, isApiOpenToTheNetwork });

      // Act: ask for the history with the row's headers.
      const response = await app.request('http://localhost/api/v1/event-log', { headers });

      // Assert: the status the access rules give.
      expect(response.status, 'the route must follow the command API’s access rules').toBe(
        expectedStatus,
      );
    },
  );
});
