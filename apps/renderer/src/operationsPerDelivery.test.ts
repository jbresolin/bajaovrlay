/**
 * What the stage does for each delivery of slices (apps/renderer)
 *
 * What this module is for:
 *   renderer.ts hands every delivery of the server connection to operationsPerDelivery,
 *   which remembers what the delivery before listed and asks the reconciler what to do on
 *   each layer (a rebuild after a hello, otherwise only the difference). One command can
 *   change two slices the preview page reads: "Prévia: limpar" on a previewed layer
 *   removes the preview from `instances` and marks the layer in `previewClearedLayerIds`.
 *   If those reach the reconciler one at a time, it sees the moment between them.
 *
 * What these tests prove, on a page that draws the preview output:
 *   - The reviewer's probe: two deliveries, first "preview gone" then "layer marked",
 *     make the reconciler cut the program clock in and then stop it, so the clock flashes
 *     on the Prévia page. One delivery with both makes it stop the preview, and nothing else.
 *   - Driven through the real server connection, the server's `slices` message for
 *     "Prévia: limpar" (and for previewMacro clearing a previewed layer, the same pair of
 *     slices) is ONE delivery, so the reconciler only stops the preview.
 *   - A hello is still a rebuild.
 *
 * What these tests deliberately do not cover:
 *   - Every rule of the reconciler; instanceReconciler.*.test.ts.
 *   - What the player then calls on the graphics; instancePlayer.*.test.ts.
 *   - The real browser page; e2e/previewPage.e2e.ts.
 */
import type { Instance, Slices } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { LayerOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createFinalClockInstance,
  enduroClockInstanceId,
  finalClockInstanceId,
} from './instancesOnAir.testSupport.js';
import { createOperationsPerDelivery } from './operationsPerDelivery.js';
import {
  createSlicesWithInstances,
  startConnectionForTests,
} from './serverConnection.testSupport.js';

const enduroClockOnAir = createEnduroClockInstance();
const rehearsedFinalClock: Instance = { ...createFinalClockInstance(), target: 'preview' };

/** The slices of a stream with the enduro clock on air and the final clock previewed over it. */
function createSlicesWithFinalClockPreviewedOverTheEnduroClock(): Slices {
  return createSlicesWithInstances([enduroClockOnAir, rehearsedFinalClock]);
}

// What the preview page must do when the previewed clock layer is marked "will be
// cleared": stop the preview with its out-animation, as the screen after the take is empty.
const onlyStopTheRehearsedClock: LayerOperations[] = [
  { layerId: 'clock', operations: [{ kind: 'stopAndDispose', instanceId: finalClockInstanceId }] },
];

describe('operationsPerDelivery on the preview page', () => {
  it('flashes the program clock when "preview gone" and "layer marked" arrive as two deliveries', () => {
    // Arrange: a preview page that has drawn the final clock previewed over the enduro clock.
    const operationsPerDelivery = createOperationsPerDelivery('preview');
    const slicesBefore = createSlicesWithFinalClockPreviewedOverTheEnduroClock();
    operationsPerDelivery.decideOperationsForDelivery({
      slices: slicesBefore,
      isFullSnapshot: true,
    });

    // Act: the slices of "Prévia: limpar" arrive one at a time, as before the slices message.
    const operationsOfPreviewGone = operationsPerDelivery.decideOperationsForDelivery({
      slices: { ...slicesBefore, instances: [enduroClockOnAir] },
      isFullSnapshot: false,
    });
    const operationsOfLayerMarked = operationsPerDelivery.decideOperationsForDelivery({
      slices: { ...slicesBefore, instances: [enduroClockOnAir], previewClearedLayerIds: ['clock'] },
      isFullSnapshot: false,
    });

    // Assert: the in-between moment is drawn: the program clock is cut in, then stopped.
    expect(
      operationsOfPreviewGone,
      'with the marker still missing, the page cuts the program clock in',
    ).toStrictEqual([
      {
        layerId: 'clock',
        operations: [
          {
            kind: 'replace',
            outgoingInstanceId: finalClockInstanceId,
            incomingInstance: enduroClockOnAir,
            replacePolicy: 'cut',
          },
        ],
      },
    ]);
    expect(
      operationsOfLayerMarked,
      'then the marker arrives and the program clock it just showed is stopped',
    ).toStrictEqual([
      {
        layerId: 'clock',
        operations: [{ kind: 'stopAndDispose', instanceId: enduroClockInstanceId }],
      },
    ]);
  });

  it('only stops the preview when "preview gone" and "layer marked" arrive as one delivery', () => {
    // Arrange: the same preview page, the final clock previewed over the enduro clock.
    const operationsPerDelivery = createOperationsPerDelivery('preview');
    const slicesBefore = createSlicesWithFinalClockPreviewedOverTheEnduroClock();
    operationsPerDelivery.decideOperationsForDelivery({
      slices: slicesBefore,
      isFullSnapshot: true,
    });

    // Act: both slices of "Prévia: limpar" arrive together.
    const operations = operationsPerDelivery.decideOperationsForDelivery({
      slices: { ...slicesBefore, instances: [enduroClockOnAir], previewClearedLayerIds: ['clock'] },
      isFullSnapshot: false,
    });

    // Assert: the preview is stopped, and the program clock never appears.
    expect(operations, 'the page must go straight to the empty layer').toStrictEqual(
      onlyStopTheRehearsedClock,
    );
  });

  const groupedChangeScenarios = [
    // "Prévia: limpar" on the previewed clock layer.
    {
      name: 'gives one delivery for the slices message of "Prévia: limpar"',
      commandType: 'previewClearLayer',
    },
    // A macro previewed whose end state clears the clock layer: the server throws the
    // preview away and marks the layer in the same state change.
    {
      name: 'gives one delivery for the slices message of previewMacro clearing the layer',
      commandType: 'previewMacro',
    },
  ];

  it.each(groupedChangeScenarios)('$name', ({ commandType }) => {
    // Arrange: the real server connection, a preview page following its deliveries, and
    // the hello with the final clock previewed over the enduro clock.
    const connection = startConnectionForTests();
    const operationsPerDelivery = createOperationsPerDelivery('preview');
    connection.latestSocket().simulateOpen();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithFinalClockPreviewedOverTheEnduroClock(),
      serverNowMs: 1_791_556_325_000,
    });

    // Act: the server sends the slices that command changed, in one slices message, and
    // the page decides what to do for every delivery it got.
    connection.latestSocket().simulateMessage({
      type: 'slices',
      slices: {
        instances: [enduroClockOnAir],
        previewClearedLayerIds: ['clock'],
        eventLog: [
          {
            id: 18,
            ts: '2026-10-09T14:32:05.000Z',
            actor: 'operador:3f2a9c1e',
            command: commandType,
            payload: { type: commandType },
            result: { status: 'ok' },
          },
        ],
      },
      serverNowMs: 1_791_556_325_000,
    });
    const operationsOfEachDelivery = connection.deliveries.map((delivery) =>
      operationsPerDelivery.decideOperationsForDelivery(delivery),
    );

    // Assert: the hello rebuilt the stage, and the slices message was ONE delivery that
    // only stops the preview: no replace, then stop.
    expect(connection.deliveries, 'the hello and the slices message, nothing more').toHaveLength(2);
    expect(
      operationsOfEachDelivery[1],
      'the one delivery of the slices message must only stop the preview',
    ).toStrictEqual(onlyStopTheRehearsedClock);
  });

  it('rebuilds the stage on a hello', () => {
    // Arrange: a preview page that has drawn nothing yet.
    const operationsPerDelivery = createOperationsPerDelivery('preview');

    // Act: the hello arrives with the final clock previewed over the enduro clock.
    const operations = operationsPerDelivery.decideOperationsForDelivery({
      slices: createSlicesWithFinalClockPreviewedOverTheEnduroClock(),
      isFullSnapshot: true,
    });

    // Assert: the preview is loaded with its in-animation skipped, as every rebuild does.
    expect(operations, 'a hello must rebuild the stage without animations').toStrictEqual([
      {
        layerId: 'clock',
        operations: [{ kind: 'loadAndPlay', instance: rehearsedFinalClock, skipAnimation: true }],
      },
    ]);
  });
});
