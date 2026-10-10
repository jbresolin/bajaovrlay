/**
 * The authorisation hook (apps/server)
 *
 * What this module is for:
 *   Every command passes an authorisation step between validation and the reducer.
 *   There is no operator login yet, so the default hook, `allowCommandForActorRole`,
 *   only tells two kinds of sender apart by the role at the start of the actor name:
 *   a renderer (`renderer:<connection id>`) may report what is really on screen and
 *   nothing else, and everyone else (`operador:<connection id>`) may do everything
 *   except pretend to be a renderer.
 *
 * What these tests prove:
 *   - An operator may send every command that changes what is on air.
 *   - `reportInstanceStatus` is allowed from a renderer and not from an operator.
 *   - A renderer may send no other command: a page that only draws must never be able
 *     to put a graphic on air or take one off.
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
