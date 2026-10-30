/**
 * A change made while the hub is still being told of another (apps/server)
 *
 * What this module is for:
 *   The store tells its listeners of each change one after the other. A listener may apply
 *   a command of its own while it is being told, and the store then tells every listener of
 *   that second change at once, before the hub has heard of the first. Since gate 2 of PR
 *   #32 the hub spares a screen a slice whose copy for it did not change. It compares what
 *   it would send with the text it last sent that screen, not with the slices from before
 *   the change: with the slices from before, the second change moved "before" past the
 *   first, and the first (a take) then looked like no change and never reached the screen.
 *   No listener applies a command while being told today (they all wait for a timer), so
 *   this test registers one that does.
 *
 * What these tests prove (with a real hub and store, and a real socket):
 *   - A take on the PiP still reaches the PiP's renderer when a listener told of it first
 *     adds a layer to the PiP right away, and the new layer reaches it too.
 *
 * What these tests deliberately do not cover:
 *   - Which slices a screen of an output is sent; webSocketHubScreensPerOutput.test.ts.
 *   - The skip itself (a take on the PiP sends program's screens nothing);
 *     webSocketHubChangesPerOutput.test.ts.
 */
import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { StateStore } from '../store/createStateStore.js';
import {
  connectAndWaitForHello,
  startHubWhoseChangesTheTestCanAnnounce,
  waitUntilTheScreenHasEverythingSentSoFar,
} from './webSocketHubWithAnnouncedChanges.testSupport.js';

const operatorActor = 'operador:conexao-7';

/**
 * Registers a listener that, the first time it is told the instances changed, adds the
 * frame under the PiP's caption at once, inside its own call: the nested command the hub
 * must survive.
 */
function addTheFrameRightAfterTheFirstTake(realStateStore: StateStore): void {
  let hasAddedTheFrame = false;
  realStateStore.subscribeToSliceChanges((changedSliceNames) => {
    if (hasAddedTheFrame || !changedSliceNames.includes('instances')) {
      return;
    }
    hasAddedTheFrame = true;
    realStateStore.applyCommand(
      {
        type: 'createLayer',
        layerId: 'moldura-pip',
        outputId: 'pip',
        name: 'Moldura',
        zIndex: 10,
        replacePolicy: 'cut',
        persistent: true,
      },
      'regra:moldura-na-pip',
    );
  });
}

/** Adds the PiP and its caption, and a race clock item on the caption; answers the item's id. */
function setUpThePipWithAClockOnItsCaption(realStateStore: StateStore): string {
  realStateStore.applyCommand(
    { type: 'createOutput', outputId: 'pip', name: 'PiP' },
    operatorActor,
  );
  realStateStore.applyCommand(
    {
      type: 'createLayer',
      layerId: 'legenda-pip',
      outputId: 'pip',
      name: 'Legenda',
      zIndex: 20,
      replacePolicy: 'out-then-in',
      persistent: false,
    },
    operatorActor,
  );
  const created = realStateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'quickFire', panelId: 'atalhos' },
      graphicId: 'race-clock',
      layerId: 'legenda-pip',
      label: 'Relógio na PiP',
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'green' },
        clockMode: { kind: 'literal', value: 'elapsed' },
        referenceTimeMs: { kind: 'literal', value: 3_900_000 },
        referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
        running: { kind: 'literal', value: true },
      },
    },
    operatorActor,
  );
  return created.ok && created.createdItemId !== undefined ? created.createdItemId : '';
}

/** The layers of every instances list the screen was sent, one list per message. */
function readLayersOfEachInstancesListSent(messages: ServerMessage[]): string[][] {
  const lists: string[][] = [];
  for (const message of messages) {
    if (message.type === 'slice' && message.name === 'instances') {
      lists.push(message.slice.map((instance) => instance.layerId));
    }
    if (message.type === 'slices' && message.slices.instances !== undefined) {
      lists.push(message.slices.instances.map((instance) => instance.layerId));
    }
  }
  return lists;
}

/** The ids of every layers list the screen was sent, one list per message. */
function readIdsOfEachLayersListSent(messages: ServerMessage[]): string[][] {
  const lists: string[][] = [];
  for (const message of messages) {
    if (message.type === 'slice' && message.name === 'layers') {
      lists.push(message.slice.map((layer) => layer.id));
    }
    if (message.type === 'slices' && message.slices.layers !== undefined) {
      lists.push(message.slices.layers.map((layer) => layer.id));
    }
  }
  return lists;
}

describe('a command applied by a listener while the hub is still to hear of another', () => {
  it("still sends the PiP's renderer the take, and then the layer added because of it", async () => {
    // Arrange: a hub whose store first tells a listener that adds the PiP's frame on the
    // first take; the PiP with a clock ready on its caption; the PiP renderer connected.
    const { port, realStateStore } = await startHubWhoseChangesTheTestCanAnnounce({
      registerBeforeTheHub: addTheFrameRightAfterTheFirstTake,
    });
    const clockItemId = setUpThePipWithAClockOnItsCaption(realStateStore);
    const { client: pipRenderer } = await connectAndWaitForHello(port, {
      role: 'renderer',
      output: 'pip',
    });

    // Act: the operator takes the clock, and we wait until the renderer has everything.
    realStateStore.applyCommand({ type: 'takeItem', itemId: clockItemId }, operatorActor);
    await waitUntilTheScreenHasEverythingSentSoFar(pipRenderer);

    // Assert: the take reached the renderer, and so did the frame added because of it.
    const messagesAfterTheHello = pipRenderer
      .readReceivedMessages()
      .filter((message) => message.type !== 'hello');
    expect(
      readLayersOfEachInstancesListSent(messagesAfterTheHello),
      'the take on the caption reaches the PiP renderer once',
    ).toEqual([['legenda-pip']]);
    expect(
      readIdsOfEachLayersListSent(messagesAfterTheHello),
      'the frame added during the take reaches it too, under the caption',
    ).toEqual([['moldura-pip', 'legenda-pip']]);
  });
});
