/**
 * The WebSocket and the operator login (apps/server)
 *
 * What this module is for:
 *   With the PINs set (BAJAOVRLAY-29) the control page's WebSocket needs the session cookie
 *   its login set: without one the upgrade is refused, and the page goes to "#/entrar".
 *   Renderer pages (OBS's at `/ws?role=renderer`, the control page's monitor frames at
 *   `/ws?role=monitor`) stay without a login on the LAN, and can only report what is on
 *   screen, as before. A logged-in connection signs its commands with its role and station
 *   (`produtor:Mesa 1`), so every event-log row names them; "Sair" closes it.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - A connection to /ws with no cookie, or with a cookie the server did not sign, is
 *     refused with 401; one with a role of renderer or monitor opens and gets its hello.
 *   - The Produtor's connection takes the race clock, and the event log names
 *     `produtor:Mesa 1`.
 *   - Dados's connection is refused the same take in pt-BR ("O papel Dados não pode …"),
 *     and the refusal is logged under `dados:Mesa 2`.
 *   - "Sair" closes that session's connection (code 4401), and only that one.
 *   - A connection whose session expired is closed at its next message, which is not run.
 *   - With the login off, a connection with no cookie opens as `operador:<id>`, as before.
 *
 * What these tests deliberately do not cover:
 *   - The login itself, the cookie and the lockout; core/operatorLogin's tests.
 *   - Which command each role may send; authorizeCommandsByRole.test.ts and the shared list.
 */
import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  dataRoleTestPin,
  operatorPinsOfTheTests,
  producerTestPin,
} from '../operatorLogin/fakeOperatorPins.testSupport.js';
import {
  momentTheServerClockIsHeldAt,
  prepareTheTakeOfTheClockItem,
  startServerOnARandomPort,
} from './webSocketHubOnARandomPort.testSupport.js';
import {
  connectWebSocketTestClient,
  tryWebSocketAndReadTheAnswer,
} from './webSocketTestClient.testSupport.js';

/** True for any `commandResult` message. */
function isCommandResultMessage(message: ServerMessage): boolean {
  return message.type === 'commandResult';
}

/** True for the `hello` message. */
function isHelloMessage(message: ServerMessage): boolean {
  return message.type === 'hello';
}

/** Logs in over HTTP as a browser does and gives back the cookie to send on /ws. */
async function logInOnTheRunningServer(
  port: number,
  login: { role: 'produtor' | 'dados'; pin: string; station: string },
): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(login),
  });
  if (response.status !== 200) {
    throw new Error(`the login as ${login.role} answered ${String(response.status)}`);
  }
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

/** Sends "Sair" over HTTP with the cookie, as the header's button does. */
async function logOutOnTheRunningServer(port: number, cookie: string): Promise<void> {
  await fetch(`http://127.0.0.1:${String(port)}/api/v1/session`, {
    method: 'DELETE',
    headers: { cookie },
  });
}

/** A server with the tests' two PINs, its clock held unless the test moves it. */
async function startServerWithTheLoginOn(readCurrentTime?: () => Date) {
  return startServerOnARandomPort({ operatorPins: operatorPinsOfTheTests, readCurrentTime });
}

describe('/ws with the login on', () => {
  const refusedScenarios = [
    // A control page opened with no login.
    { name: 'refuses a connection with no cookie', cookie: undefined },
    // A cookie made up by hand.
    {
      name: 'refuses a connection with a cookie the server did not sign',
      cookie: 'bajaovrlay_sessao=sessao-inventada.assinatura-inventada',
    },
  ];

  it.each(refusedScenarios)('$name', async ({ cookie }) => {
    // Arrange: a running server with the two PINs set.
    const runningServer = await startServerWithTheLoginOn();

    // Act: open /ws as a control page would, with the row's cookie.
    const answer = await tryWebSocketAndReadTheAnswer(runningServer.port, { cookie });

    // Assert: refused with 401.
    expect(answer, 'a control page needs a session to connect').toBe(401);
  });

  const screenScenarios = [
    // The renderer page OBS loads: no login on the LAN.
    { name: 'opens a renderer’s connection with no cookie', role: 'renderer' as const },
    // The control page's "Programa" and "Prévia" frames.
    { name: 'opens a monitor’s connection with no cookie', role: 'monitor' as const },
  ];

  it.each(screenScenarios)('$name', async ({ role }) => {
    // Arrange: a running server with the two PINs set.
    const runningServer = await startServerWithTheLoginOn();

    // Act: connect as the screen, with no cookie, and wait for the hello.
    const screen = await connectWebSocketTestClient(runningServer.port, { role });
    const hello = await screen.waitForMessage('hello', isHelloMessage);

    // Assert: the screen gets its hello, as before the login.
    expect(hello.type, 'a screen needs no login').toBe('hello');
  });

  it('signs the Produtor’s take with its role and station in the event log', async () => {
    // Arrange: the race clock prepared, and the Produtor logged in at "Mesa 1" and connected.
    const runningServer = await startServerWithTheLoginOn();
    const takeOfTheClock = prepareTheTakeOfTheClockItem(runningServer.stateStore);
    const cookie = await logInOnTheRunningServer(runningServer.port, {
      role: 'produtor',
      pin: producerTestPin,
      station: 'Mesa 1',
    });
    const controlPage = await connectWebSocketTestClient(runningServer.port, { cookie });

    // Act: take the race clock.
    controlPage.sendJson({ type: 'command', requestId: 'pedido-1', command: takeOfTheClock });
    const result = await controlPage.waitForMessage('take result', isCommandResultMessage);

    // Assert: accepted, and the event log names "produtor:Mesa 1".
    expect(result, 'the Produtor may take').toMatchObject({ ok: true });
    const lastRow = runningServer.stateStore.readAllSlices().eventLog.at(-1);
    expect(lastRow?.actor, 'the row names the role and the station').toBe('produtor:Mesa 1');
  });

  it('refuses Dados’s take in pt-BR and logs the refusal under its role and station', async () => {
    // Arrange: the race clock prepared, and Dados logged in at "Mesa 2" and connected.
    const runningServer = await startServerWithTheLoginOn();
    const takeOfTheClock = prepareTheTakeOfTheClockItem(runningServer.stateStore);
    const cookie = await logInOnTheRunningServer(runningServer.port, {
      role: 'dados',
      pin: dataRoleTestPin,
      station: 'Mesa 2',
    });
    const controlPage = await connectWebSocketTestClient(runningServer.port, { cookie });

    // Act: try to take the race clock.
    controlPage.sendJson({ type: 'command', requestId: 'pedido-1', command: takeOfTheClock });
    const result = await controlPage.waitForMessage('take result', isCommandResultMessage);

    // Assert: refused with the role's sentence, logged as failed under "dados:Mesa 2".
    expect(result, 'Dados may not take').toMatchObject({
      ok: false,
      error: {
        code: 'NOT_ALLOWED',
        message: 'O papel Dados não pode mudar o que está no ar. Peça ao Produtor.',
      },
    });
    const lastRow = runningServer.stateStore.readAllSlices().eventLog.at(-1);
    expect(lastRow, 'the refusal is logged under Dados at "Mesa 2"').toMatchObject({
      actor: 'dados:Mesa 2',
      result: { status: 'failed' },
    });
    expect(runningServer.stateStore.readAllSlices().instances, 'nothing went on air').toEqual([]);
  });

  it('closes the connection of a session ended by "Sair", and only that one', async () => {
    // Arrange: the Produtor at "Mesa 1" and Dados at "Mesa 2", both connected.
    const runningServer = await startServerWithTheLoginOn();
    const producerCookie = await logInOnTheRunningServer(runningServer.port, {
      role: 'produtor',
      pin: producerTestPin,
      station: 'Mesa 1',
    });
    const dataRoleCookie = await logInOnTheRunningServer(runningServer.port, {
      role: 'dados',
      pin: dataRoleTestPin,
      station: 'Mesa 2',
    });
    const producerPage = await connectWebSocketTestClient(runningServer.port, {
      cookie: producerCookie,
    });
    const dataRolePage = await connectWebSocketTestClient(runningServer.port, {
      cookie: dataRoleCookie,
    });
    await dataRolePage.waitForMessage('hello', isHelloMessage);

    // Act: Dados presses "Sair".
    await logOutOnTheRunningServer(runningServer.port, dataRoleCookie);
    await dataRolePage.waitUntilClosed();

    // Assert: Dados's page is closed with the session's code, the Produtor's stays open.
    expect(dataRolePage.readCloseCode(), 'closed because its session ended').toBe(4401);
    expect(producerPage.isOpen(), 'another session’s page stays connected').toBe(true);
  });

  it('closes a connection whose session expired at its next message, without running it', async () => {
    // Arrange: a clock the test moves, the race clock prepared, and the Produtor connected.
    let nowInMilliseconds = Date.parse(momentTheServerClockIsHeldAt);
    const runningServer = await startServerWithTheLoginOn(() => new Date(nowInMilliseconds));
    const takeOfTheClock = prepareTheTakeOfTheClockItem(runningServer.stateStore);
    const cookie = await logInOnTheRunningServer(runningServer.port, {
      role: 'produtor',
      pin: producerTestPin,
      station: 'Mesa 1',
    });
    const controlPage = await connectWebSocketTestClient(runningServer.port, { cookie });
    await controlPage.waitForMessage('hello', isHelloMessage);
    nowInMilliseconds += 18 * 60 * 60 * 1000;

    // Act: 18 hours later, the page sends a take.
    controlPage.sendJson({ type: 'command', requestId: 'pedido-1', command: takeOfTheClock });
    await controlPage.waitUntilClosed();

    // Assert: closed with the session's code, and nothing went on air.
    expect(controlPage.readCloseCode(), 'closed because its session expired').toBe(4401);
    expect(runningServer.stateStore.readAllSlices().instances, 'the take was not run').toEqual([]);
  });
});

describe('/ws with the login off', () => {
  it('opens a connection with no cookie as an operator, as before', async () => {
    // Arrange: a running server with no PINs set.
    const runningServer = await startServerOnARandomPort();

    // Act: open /ws with no cookie.
    const answer = await tryWebSocketAndReadTheAnswer(runningServer.port);

    // Assert: opened.
    expect(answer, 'with no PINs the page connects as before').toBe('opened');
  });
});
