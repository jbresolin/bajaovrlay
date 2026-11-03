/**
 * WebSocket messages from the server (packages/shared)
 *
 * What this module is for:
 *   The control page and the renderer talk to the server over one WebSocket at `/ws`.
 *   The server sends `hello` (every slice, on connect), `slice` (one slice that
 *   changed), `slices` (several slices one state change changed), `dataSnapshot` (one
 *   source's last good data, to operators only), `commandResult` (ok,
 *   or an error with a pt-BR message) and, every ten seconds, `time` (what its clock
 *   shows, and nothing else). Clients check every
 *   message they receive against ServerMessageSchema.
 *
 * What these tests prove:
 *   - A `slice` message is accepted only when its contents match the slice it names.
 *   - `hello` and `slice` may carry `serverNowMs`, the time of the server's clock in
 *     whole milliseconds; it survives validation, and a wrong kind of value is refused.
 *   - A `time` message must carry `serverNowMs` as a whole number: the time is all it
 *     has to say, so one without it, or with text or a fraction, is refused.
 *   - An ok `commandResult` echoes the requestId, and after a createItem it may name the
 *     item the server made (`createdItemId`); an error one must carry a code from the
 *     closed list and a pt-BR message.
 *   - A message with an unknown `type` is refused.
 *
 * What these tests deliberately do not cover:
 *   - The `slices` message; serverMessages.slicesMessage.test.ts.
 *   - The `dataSnapshot` message; serverMessages.dataSnapshotMessage.test.ts.
 *   - The JSON examples in README.md; protocolReadmeExamples.test.ts checks those.
 *   - Sending and receiving on a real socket; apps/server's webSocketHub tests do.
 */
import { describe, expect, it } from 'vitest';

import { obsSliceWithoutObs } from '../obs/obsSlice.js';
import { ServerMessageSchema } from './serverMessages.js';

const lowerThirdLayer = {
  id: 'lower-third',
  outputId: 'program',
  name: 'Tarja',
  zIndex: 40,
  replacePolicy: 'out-then-in',
  persistent: false,
};

describe('ServerMessageSchema', () => {
  it('accepts a slice message whose contents match the slice it names', () => {
    // Arrange: the server tells clients the layer list changed.
    const layersSliceMessage = { type: 'slice', name: 'layers', slice: [lowerThirdLayer] };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(layersSliceMessage);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a well-formed layers slice message must be accepted').toBe(true);
    expect(result.data, 'the accepted message must not be altered').toEqual(layersSliceMessage);
  });

  it('refuses a slice message whose contents belong to another slice', () => {
    // Arrange: a message that says "instances" but carries layers.
    const mislabelledSliceMessage = { type: 'slice', name: 'instances', slice: [lowerThirdLayer] };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(mislabelledSliceMessage);

    // Assert: it is refused, so a client never stores layers as instances.
    expect(result.success, 'the slice contents must match the slice name').toBe(false);
  });

  const serverClockScenarios = [
    // What the server sends: the time of its own clock, in whole milliseconds since 1970.
    {
      name: 'accepts a slice message carrying the time of the server clock',
      message: {
        type: 'slice',
        name: 'layers',
        slice: [lowerThirdLayer],
        serverNowMs: 1_791_556_325_000,
      },
      isAccepted: true,
    },
    // The same on the first message of a connection.
    {
      name: 'accepts a hello carrying the time of the server clock',
      message: {
        type: 'hello',
        slices: {
          outputs: [{ outputId: 'program', name: 'Programa', order: 0 }],
          layers: [],
          graphics: [],
          instances: [],
          previewClearedLayerIds: [],
          instanceBindings: [],
          overrides: [],
          rundowns: [],
          items: [],
          quickFirePanels: [],
          macros: [],
          macroRuns: [],
          macroStops: [],
          obs: obsSliceWithoutObs,
          triggers: [],
          triggerActivity: { isPaused: false, lastFiredAtMsByTriggerId: {}, firings: [] },
          dataSources: [],
          dataSnapshots: [],
          recordings: [],
          events: [],
          eventRules: [],
          teams: [],
          people: [],
          sponsors: [],
          scheduleSlots: [],
          media: [],
          eventLog: [],
        },
        serverNowMs: 1_791_556_325_000,
      },
      isAccepted: true,
    },
    // Optional in the schema (see serverMessages.ts): test stand-ins for the server that
    // were written before the field existed leave it out, and a client then takes no sample.
    {
      name: 'accepts a hello that leaves the time of the server clock out',
      message: {
        type: 'hello',
        slices: {
          outputs: [{ outputId: 'program', name: 'Programa', order: 0 }],
          layers: [],
          graphics: [],
          instances: [],
          previewClearedLayerIds: [],
          instanceBindings: [],
          overrides: [],
          rundowns: [],
          items: [],
          quickFirePanels: [],
          macros: [],
          macroRuns: [],
          macroStops: [],
          obs: obsSliceWithoutObs,
          triggers: [],
          triggerActivity: { isPaused: false, lastFiredAtMsByTriggerId: {}, firings: [] },
          dataSources: [],
          dataSnapshots: [],
          recordings: [],
          events: [],
          eventRules: [],
          teams: [],
          people: [],
          sponsors: [],
          scheduleSlots: [],
          media: [],
          eventLog: [],
        },
      },
      isAccepted: true,
    },
    // A clock in text would be added to a number as text by a careless client.
    {
      name: 'refuses a server clock time written as text',
      message: {
        type: 'slice',
        name: 'layers',
        slice: [lowerThirdLayer],
        serverNowMs: '2026-10-09T14:32:05.000Z',
      },
      isAccepted: false,
    },
    // Milliseconds are whole; a fraction means something other than Date.now() wrote it.
    {
      name: 'refuses a server clock time with a fraction of a millisecond',
      message: {
        type: 'slice',
        name: 'layers',
        slice: [lowerThirdLayer],
        serverNowMs: 1_791_556_325_000.5,
      },
      isAccepted: false,
    },
  ];

  it.each(serverClockScenarios)('$name', ({ message, isAccepted }) => {
    // Arrange: a hello or slice message (from the table above).
    const messageWithOrWithoutTheServerClock = message;

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(messageWithOrWithoutTheServerClock);

    // Assert: it is accepted or refused as the row says.
    expect(result.success, 'the server clock time must be judged as the scenario says').toBe(
      isAccepted,
    );
  });

  it('keeps the time of the server clock on the message it accepts', () => {
    // Arrange: an instances slice stamped by the server at 14:32:05 UTC on 9 October 2026.
    const stampedSliceMessage = {
      type: 'slice',
      name: 'instances',
      slice: [],
      serverNowMs: 1_791_556_325_000,
    };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(stampedSliceMessage);

    // Assert: the time is still there after validation, so the renderer can read it.
    expect(result.data, 'validation must not drop the server clock time').toEqual(
      stampedSliceMessage,
    );
  });

  const timeMessageScenarios = [
    // What the server sends every ten seconds: its clock, in whole milliseconds since 1970.
    {
      name: 'accepts a time message carrying the time of the server clock',
      message: { type: 'time', serverNowMs: 1_791_556_335_000 },
      isAccepted: true,
    },
    // Unlike hello and slice, the time is the whole message: without it there is nothing.
    {
      name: 'refuses a time message that leaves the time out',
      message: { type: 'time' },
      isAccepted: false,
    },
    // A clock in text would be added to a number as text by a careless client.
    {
      name: 'refuses a time message whose time is written as text',
      message: { type: 'time', serverNowMs: '2026-10-09T14:32:15.000Z' },
      isAccepted: false,
    },
    // Milliseconds are whole; a fraction means something other than Date.now() wrote it.
    {
      name: 'refuses a time message with a fraction of a millisecond',
      message: { type: 'time', serverNowMs: 1_791_556_335_000.5 },
      isAccepted: false,
    },
  ];

  it.each(timeMessageScenarios)('$name', ({ message, isAccepted }) => {
    // Arrange: a time message (from the table above).
    const timeMessage = message;

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(timeMessage);

    // Assert: it is accepted or refused as the row says.
    expect(result.success, 'the time message must be judged as the scenario says').toBe(isAccepted);
  });

  it('keeps the time of the server clock on the time message it accepts', () => {
    // Arrange: the time message of 14:32:15 UTC on 9 October 2026.
    const timeMessage = { type: 'time', serverNowMs: 1_791_556_335_000 };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(timeMessage);

    // Assert: it comes out exactly as it went in, so a page can read the time.
    expect(result.data, 'validation must not alter a time message').toEqual(timeMessage);
  });

  const commandResultScenarios = [
    // The usual answer: the command worked, echoing the client's requestId.
    {
      name: 'accepts an ok result echoing the requestId',
      message: { type: 'commandResult', requestId: 'pedido-17', ok: true },
      isAccepted: true,
    },
    // An accepted createItem names the item the server made, so the item editor's "Salvar
    // e disparar" can take that item next (BAJAOVRLAY-37).
    {
      name: 'accepts an ok result naming the item a createItem made',
      message: {
        type: 'commandResult',
        requestId: 'pedido-18',
        ok: true,
        createdItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
      },
      isAccepted: true,
    },
    // An empty id names no item, and a take of it could only be refused.
    {
      name: 'refuses an ok result naming an empty created item id',
      message: { type: 'commandResult', requestId: 'pedido-18', ok: true, createdItemId: '' },
      isAccepted: false,
    },
    // A refusal must tell the operator why, in pt-BR, with a stable code.
    {
      name: 'accepts an error result with a code and a pt-BR message',
      message: {
        type: 'commandResult',
        requestId: null,
        ok: false,
        error: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
      },
      isAccepted: true,
    },
    // A failure with nothing to show the operator is a server bug.
    {
      name: 'refuses an error result without the error',
      message: { type: 'commandResult', requestId: null, ok: false },
      isAccepted: false,
    },
    // Codes are a closed list so clients can react to them reliably.
    {
      name: 'refuses an error code that is not in the list',
      message: {
        type: 'commandResult',
        requestId: null,
        ok: false,
        error: { code: 'SOMETHING_ODD', message: 'Algo estranho aconteceu.' },
      },
      isAccepted: false,
    },
  ];

  it.each(commandResultScenarios)('$name', ({ message, isAccepted }) => {
    // Arrange: a commandResult message (from the table above).
    const commandResultMessage = message;

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(commandResultMessage);

    // Assert: it is accepted or refused as the row says.
    expect(result.success, 'the commandResult must be judged as the scenario says').toBe(
      isAccepted,
    );
  });

  it('refuses a message type the protocol does not have', () => {
    // Arrange: a message type that does not exist.
    const unknownMessage = { type: 'goodbye' };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(unknownMessage);

    // Assert: it is refused.
    expect(
      result.success,
      'only hello, slice, slices, dataSnapshot, commandResult and time come from the server',
    ).toBe(false);
  });
});
