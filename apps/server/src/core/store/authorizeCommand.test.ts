/**
 * The authorisation hook (apps/server)
 *
 * What this module is for:
 *   Every command passes an authorisation step between validation and the reducer.
 *   There is no operator login yet, so the default hook, `allowCommandForActorRole`,
 *   only tells three kinds of sender apart by the role at the start of the actor name:
 *   a renderer (`renderer:<connection id>`) may report what is really on screen and
 *   nothing else; the server's own timers (`sistema:<what>`, today only the auto-out)
 *   may clear one layer and nothing else; and everyone else (`operador:<connection
 *   id>`) may do everything except pretend to be a renderer.
 *
 * What these tests prove:
 *   - The system may send clearLayer and is refused a take, the panic clear, a rundown
 *     take and a screen report.
 *   - An operator may send every command that changes what is on air, and each of the
 *     seven item and rundown commands.
 *   - `reportInstanceStatus` is allowed from a renderer and not from an operator.
 *   - A renderer may send no other command: a page that only draws must never be able
 *     to put a graphic on air or take one off, nor to change the rundown or its items.
 *
 * What these tests deliberately do not cover:
 *   - What the store does with a "no" (the NOT_ALLOWED refusal and its event-log row);
 *     createStateStore.test.ts covers it.
 *   - How a connection gets its actor name; ws/connectionActor.test.ts covers it.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const rendererActor = 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12';
// The name the auto-out scheduler signs its clears with; no connection has this role.
const systemActor = 'sistema:auto-out';

const takeRaceClock: Command = {
  type: 'takeGraphic',
  graphicId: 'race-clock',
  layerId: 'clock',
  data: { sessionName: 'Enduro de Resistência' },
  target: 'program',
};
const changeFlagToYellow: Command = {
  type: 'updateInstanceData',
  instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
  data: { state: 'yellow' },
};
const reportRaceClockOnAir: Command = {
  type: 'reportInstanceStatus',
  instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
  status: 'on-air',
};
const createYellowFlagItem: Command = {
  type: 'createItem',
  rundownId: 'sessao-principal',
  graphicId: 'race-clock',
  layerId: 'clock',
  fields: { state: { kind: 'literal', value: 'yellow' } },
  label: 'Bandeira amarela',
  color: 'warning',
  notes: '',
};
const renameYellowFlagItem: Command = {
  type: 'updateItemFields',
  itemId: 'item-bandeira-amarela',
  label: 'Amarela no setor 3',
};
const putYellowFlagBeforeTheStart: Command = {
  type: 'reorderItems',
  rundownId: 'sessao-principal',
  orderedItemIds: ['item-bandeira-amarela', 'item-largada-do-enduro'],
};
const putCursorOnTheYellowFlag: Command = {
  type: 'moveCursor',
  rundownId: 'sessao-principal',
  itemId: 'item-bandeira-amarela',
};

const authorisationScenarios: Array<{
  name: string;
  command: Command;
  actor: string;
  expectedIsAllowed: boolean;
}> = [
  // The command that puts graphics on air.
  {
    name: 'allows takeGraphic from an operator',
    command: takeRaceClock,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // Changing a graphic in place is an operator's job too.
  {
    name: 'allows updateInstanceData from an operator',
    command: changeFlagToYellow,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // Taking one layer off air.
  {
    name: 'allows clearLayer from an operator',
    command: { type: 'clearLayer', layerId: 'lower-third' },
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // The panic button must never be blocked for an operator.
  {
    name: 'allows clearAll from an operator',
    command: { type: 'clearAll' },
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // The renderer is the only one who knows what is really on screen.
  {
    name: 'allows reportInstanceStatus from a renderer',
    command: reportRaceClockOnAir,
    actor: rendererActor,
    expectedIsAllowed: true,
  },
  // An operator's page cannot see the OBS output, so it must not claim "on air".
  {
    name: 'refuses reportInstanceStatus from an operator',
    command: reportRaceClockOnAir,
    actor: operatorActor,
    expectedIsAllowed: false,
  },
  // A page that only draws must not be able to put a graphic on air.
  {
    name: 'refuses takeGraphic from a renderer',
    command: takeRaceClock,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Nor to change what a graphic shows.
  {
    name: 'refuses updateInstanceData from a renderer',
    command: changeFlagToYellow,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Nor to take everything off air.
  {
    name: 'refuses clearAll from a renderer',
    command: { type: 'clearAll' },
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Preparing the show is the operator's job: adding an item to the rundown.
  {
    name: 'allows createItem from an operator',
    command: createYellowFlagItem,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // Correcting a prepared item.
  {
    name: 'allows updateItemFields from an operator',
    command: renameYellowFlagItem,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // Removing a prepared item.
  {
    name: 'allows deleteItem from an operator',
    command: { type: 'deleteItem', itemId: 'item-bandeira-amarela' },
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // Dragging the rows of the rundown into another order.
  {
    name: 'allows reorderItems from an operator',
    command: putYellowFlagBeforeTheStart,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // Choosing which item is "next".
  {
    name: 'allows moveCursor from an operator',
    command: putCursorOnTheYellowFlag,
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // Firing one row of the rundown.
  {
    name: 'allows takeItem from an operator',
    command: { type: 'takeItem', itemId: 'item-bandeira-amarela' },
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // The Space key: firing the "next" item.
  {
    name: 'allows takeNext from an operator',
    command: { type: 'takeNext', rundownId: 'sessao-principal' },
    actor: operatorActor,
    expectedIsAllowed: true,
  },
  // A page that only draws must not write into the rundown either: not add an item.
  {
    name: 'refuses createItem from a renderer',
    command: createYellowFlagItem,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Nor change one.
  {
    name: 'refuses updateItemFields from a renderer',
    command: renameYellowFlagItem,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Nor remove one.
  {
    name: 'refuses deleteItem from a renderer',
    command: { type: 'deleteItem', itemId: 'item-bandeira-amarela' },
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Nor change the order of the show.
  {
    name: 'refuses reorderItems from a renderer',
    command: putYellowFlagBeforeTheStart,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Nor move the "next" mark.
  {
    name: 'refuses moveCursor from a renderer',
    command: putCursorOnTheYellowFlag,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Nor put an item on air: that is a take like any other.
  {
    name: 'refuses takeItem from a renderer',
    command: { type: 'takeItem', itemId: 'item-bandeira-amarela' },
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // Nor fire the "next" item.
  {
    name: 'refuses takeNext from a renderer',
    command: { type: 'takeNext', rundownId: 'sessao-principal' },
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // The one thing the server does by itself: the auto-out takes an item's layer off air.
  {
    name: 'allows clearLayer from the system',
    command: { type: 'clearLayer', layerId: 'lower-third' },
    actor: systemActor,
    expectedIsAllowed: true,
  },
  // Nothing in the server may put a graphic on air without an operator asking.
  {
    name: 'refuses takeGraphic from the system',
    command: takeRaceClock,
    actor: systemActor,
    expectedIsAllowed: false,
  },
  // The panic button clears every layer; the system only ever clears the one it timed.
  {
    name: 'refuses clearAll from the system',
    command: { type: 'clearAll' },
    actor: systemActor,
    expectedIsAllowed: false,
  },
  // Nor may it fire a row of the rundown: a take is the operator's decision.
  {
    name: 'refuses takeItem from the system',
    command: { type: 'takeItem', itemId: 'item-bandeira-amarela' },
    actor: systemActor,
    expectedIsAllowed: false,
  },
  // The system cannot see the OBS output any more than an operator's page can.
  {
    name: 'refuses reportInstanceStatus from the system',
    command: reportRaceClockOnAir,
    actor: systemActor,
    expectedIsAllowed: false,
  },
];

describe('allowCommandForActorRole', () => {
  it.each(authorisationScenarios)('$name', ({ command, actor, expectedIsAllowed }) => {
    // Arrange: the command and the actor of this scenario (see the table above).

    // Act: ask the default hook whether this actor may run this command.
    const isAllowed = allowCommandForActorRole(command, actor);

    // Assert: the answer is the one the role allows.
    expect(isAllowed, 'the role at the start of the actor name must decide').toBe(
      expectedIsAllowed,
    );
  });
});
