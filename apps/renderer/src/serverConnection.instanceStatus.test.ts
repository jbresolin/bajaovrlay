/**
 * The renderer's connection to the server: what the renderer says (apps/renderer)
 *
 * What this module is for:
 *   The renderer is the only part that can see the screen. Over the same WebSocket it
 *   listens on, it tells the server what really happened to each instance with an
 *   `instanceStatus` message: `on-air`, or `failed` with a few words about why. The server
 *   turns that into its `reportInstanceStatus` command and the control page shows it.
 *
 * What these tests prove:
 *   - An `on-air` report is sent as one JSON text that passes the shared protocol, with no
 *     `detail` key at all; a `failed` report carries its detail.
 *   - A report made while there is no open socket (before the first one opens, or after a
 *     drop) is not sent and not kept for later; it is logged as a warning. After the
 *     reconnect the server's hello makes the renderer rebuild the stage, which reports
 *     every instance again, so nothing is lost by not keeping it.
 *   - After a reconnect, reports go out on the new socket.
 *   - A `commandResult` in which the server refuses something is logged as a warning
 *     with the server's code and message, so the reason can be read in the OBS console.
 *
 * What these tests deliberately do not cover:
 *   - When the renderer decides to report, and with which detail;
 *     instancePlayer.status.test.ts.
 *   - A real WebSocket and the address the page dials (`/ws?role=renderer`);
 *     e2e/instanceStatus.e2e.ts.
 *   - What the server does with the report; the server's own tests.
 */
import { ClientMessageSchema } from '@bajaovrlay/shared';
import { describe, expect, it, vi } from 'vitest';

import { enduroClockInstanceId } from './instancesOnAir.testSupport.js';
import { startConnectionForTests } from './serverConnection.testSupport.js';

const enduroClockIsOnAir = {
  type: 'instanceStatus' as const,
  instanceId: enduroClockInstanceId,
  status: 'on-air' as const,
};

const enduroClockFailedToLoad = {
  type: 'instanceStatus' as const,
  instanceId: enduroClockInstanceId,
  status: 'failed' as const,
  detail: 'its load failed or was refused: it answered 400: O campo sessionName é obrigatório.',
};

const warningThatAReportWasNotSent = {
  level: 'warn',
  message: 'instance status not sent: no open connection to the server',
};

describe('reporting an instance status to the server', () => {
  const reportScenarios = [
    // The everyday report: the clock finished its in-animation.
    {
      name: 'sends an on-air report as one protocol message, with no detail key',
      statusReport: enduroClockIsOnAir,
    },
    // The graphic refused its data: the operator must be able to read why.
    {
      name: 'sends a failed report with its detail',
      statusReport: enduroClockFailedToLoad,
    },
  ];

  it.each(reportScenarios)('$name', ({ statusReport }) => {
    // Arrange: a connection whose socket is open.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateOpen();

    // Act: the renderer reports the status of the row.
    connection.sendInstanceStatus(statusReport);

    // Assert: one text went out; read back as JSON it is exactly the report, and it is
    // a message the shared protocol allows a client to send.
    const textsSent = connection.latestSocket().textsSentByTheRenderer;
    const messageSent: unknown = JSON.parse(textsSent[0] ?? 'null');
    expect(textsSent, 'exactly one text must be sent for one report').toHaveLength(1);
    expect(messageSent, 'the message must carry the report and nothing else').toEqual(statusReport);
    expect(
      ClientMessageSchema.safeParse(messageSent).success,
      'the message must pass the shared ClientMessageSchema',
    ).toBe(true);
  });

  it('does not send a report made before the socket has opened, and logs a warning', () => {
    // Arrange: a connection whose first socket is still connecting.
    const connection = startConnectionForTests();

    // Act: the renderer reports the clock on air; only afterwards does the socket open.
    connection.sendInstanceStatus(enduroClockIsOnAir);
    connection.latestSocket().simulateOpen();

    // Assert: nothing went out, not even once the socket opened (the report is not
    // kept), and a warning says so.
    expect(
      connection.latestSocket().textsSentByTheRenderer,
      'a report made with no open socket must not be sent, then or later',
    ).toEqual([]);
    expect(connection.readWarnings(), 'the report that was not sent must be logged').toEqual([
      warningThatAReportWasNotSent,
    ]);
  });

  it('does not send on a socket that dropped, and sends on the new one after the reconnect', () => {
    // Arrange: a connection whose first socket opened and then dropped.
    const connection = startConnectionForTests();
    const firstSocket = connection.latestSocket();
    firstSocket.simulateOpen();
    firstSocket.simulateDrop();

    // Act: the renderer reports while disconnected; then the reconnect wait passes, the
    // second socket opens, and the renderer reports again.
    connection.sendInstanceStatus(enduroClockIsOnAir);
    vi.advanceTimersByTime(500);
    const secondSocket = connection.latestSocket();
    secondSocket.simulateOpen();
    connection.sendInstanceStatus(enduroClockFailedToLoad);

    // Assert: the dropped socket got nothing, the new one got only the second report,
    // and the first report is in the log as not sent.
    expect(
      firstSocket.textsSentByTheRenderer,
      'nothing may be sent on a socket that has dropped',
    ).toEqual([]);
    expect(
      secondSocket.textsSentByTheRenderer.map((text) => JSON.parse(text) as unknown),
      'after the reconnect, reports must go out on the new socket',
    ).toEqual([enduroClockFailedToLoad]);
    expect(
      connection.readWarnings(),
      'the report made while disconnected must be logged as not sent',
    ).toContainEqual(warningThatAReportWasNotSent);
  });
});

describe('a commandResult in which the server refuses something', () => {
  it('is logged as a warning with the code and the message of the server', () => {
    // Arrange: a connection that received its hello and reported the clock on air.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateOpen();
    connection.sendInstanceStatus(enduroClockIsOnAir);

    // Act: the server answers that the instance no longer exists (it was cleared while
    // its in-animation was still running).
    connection.latestSocket().simulateMessage({
      type: 'commandResult',
      requestId: null,
      ok: false,
      error: { code: 'INSTANCE_NOT_FOUND', message: 'A instância não existe mais.' },
    });

    // Assert: one warning carrying what the server said, so it can be read in OBS.
    expect(
      connection.logLinesWithDetails.filter((line) => line.level === 'warn'),
      'a refusal from the server must be logged with its code and its pt-BR message',
    ).toEqual([
      {
        level: 'warn',
        message: 'server refused a message from the renderer',
        details: { code: 'INSTANCE_NOT_FOUND', serverMessage: 'A instância não existe mais.' },
      },
    ]);
  });
});
