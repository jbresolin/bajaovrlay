// Test support for the event inbox's browser tests (BAJAOVRLAY-44): commands sent to a
// real server over a WebSocket of their own, as the control page sends them, with the
// server's answer; the notice items the tests show events with; the inbox and the notice
// layer as GET /api/v1/state answers them. Functions only; nothing is remembered.

/** An event of the inbox, as the tests read it. */
export type InboxEventAsTheTestsReadIt = {
  eventId: string;
  kind: string;
  status: string;
  detectedAtMs: number;
  payload: { carNumber: number; reason?: string };
};

/** The parts of GET /api/v1/state these tests read. */
type StateTheInboxTestsRead = {
  events: InboxEventAsTheTestsReadIt[];
  instances: Array<{ layerId: string; target: string; eventId?: string }>;
  dataSnapshots: Array<{ sourceId: string; receivedAtMs: number }>;
};

/** What the server answered a command: ok with the item it made, if any, or refused. */
type CommandAnswer = { ok: boolean; createdItemId?: string; errorCode?: string };

// Long enough for a slow CI machine, short enough to fail with a clear message first.
const waitLimitInMilliseconds = 5000;

/**
 * Sends one command to the server on this port and resolves with its answer. Rejects
 * when the server does not answer within five seconds.
 */
export function sendCommandToTheServerOnPort(
  port: number,
  command: Record<string, unknown>,
): Promise<CommandAnswer> {
  const requestId = `pedido-${crypto.randomUUID()}`;
  const socket = new WebSocket(`ws://127.0.0.1:${String(port)}/ws`);
  return new Promise((resolve, reject) => {
    const giveUpTimer = setTimeout(() => {
      socket.close();
      reject(new Error(`the server on ${String(port)} did not answer ${String(command.type)}`));
    }, waitLimitInMilliseconds);
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'command', requestId, command }));
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as {
        type: string;
        requestId?: string | null;
        ok?: boolean;
        createdItemId?: string;
        error?: { code: string };
      };
      if (message.type !== 'commandResult' || message.requestId !== requestId) {
        return;
      }
      clearTimeout(giveUpTimer);
      socket.close();
      const answer: CommandAnswer = { ok: message.ok === true };
      if (message.createdItemId !== undefined) {
        answer.createdItemId = message.createdItemId;
      }
      if (message.error !== undefined) {
        answer.errorCode = message.error.code;
      }
      resolve(answer);
    });
    socket.addEventListener('error', () => {
      clearTimeout(giveUpTimer);
      reject(new Error(`could not connect to the server on ${String(port)}`));
    });
  });
}

/** Sends a command and throws, naming it, when the server refuses it. */
export async function sendCommandOrFail(
  port: number,
  command: Record<string, unknown>,
): Promise<CommandAnswer> {
  const answer = await sendCommandToTheServerOnPort(port, command);
  if (!answer.ok) {
    throw new Error(`the server refused ${String(command.type)}: ${answer.errorCode ?? '?'}`);
  }
  return answer;
}

/** The state of the server on this port, as GET /api/v1/state answers it. */
export async function readInboxStateOfTheServerOnPort(
  port: number,
): Promise<StateTheInboxTestsRead> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/state`);
  if (!response.ok) {
    throw new Error(`GET /api/v1/state answered ${String(response.status)} on ${String(port)}`);
  }
  return (await response.json()) as StateTheInboxTestsRead;
}

/** The id of the event the notice layer's program instance carries, or undefined. */
export async function readEventIdOnTheNoticeLayer(port: number): Promise<string | undefined> {
  const state = await readInboxStateOfTheServerOnPort(port);
  return state.instances.find(
    (instance) => instance.layerId === 'notice' && instance.target === 'program',
  )?.eventId;
}

/**
 * Makes the two notice items the tests show events with ("Penalidade — teste" and
 * "Volta mais rápida — teste", on the "Atalhos" panel; the reset deletes the seeded ones),
 * and answers their ids.
 */
export async function createNoticeItemsOnTheServer(
  port: number,
): Promise<{ penaltyItemId: string; fastestLapItemId: string }> {
  const eventFieldsOfBothVariants = {
    carNumber: { kind: 'eventField', path: 'carNumber' },
    teamName: { kind: 'eventField', path: 'teamName' },
    schoolName: { kind: 'eventField', path: 'schoolName' },
  };
  const penaltyItem = await sendCommandOrFail(port, {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'notice',
    layerId: 'notice',
    label: 'Penalidade — teste',
    fields: {
      variant: { kind: 'literal', value: 'penalty' },
      noticeKind: { kind: 'eventField', path: 'noticeKind' },
      reason: { kind: 'eventField', path: 'reason' },
      penaltyText: { kind: 'eventField', path: 'penaltyText' },
      ...eventFieldsOfBothVariants,
    },
  });
  const fastestLapItem = await sendCommandOrFail(port, {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'notice',
    layerId: 'notice',
    label: 'Volta mais rápida — teste',
    fields: {
      variant: { kind: 'literal', value: 'fastestLap' },
      lapNumber: { kind: 'eventField', path: 'lapNumber' },
      lapTimeText: { kind: 'eventField', path: 'lapTimeText' },
      ...eventFieldsOfBothVariants,
    },
  });
  if (penaltyItem.createdItemId === undefined || fastestLapItem.createdItemId === undefined) {
    throw new Error('the server did not name the notice items it made');
  }
  return {
    penaltyItemId: penaltyItem.createdItemId,
    fastestLapItemId: fastestLapItem.createdItemId,
  };
}
