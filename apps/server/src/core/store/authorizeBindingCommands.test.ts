/**
 * The authorisation hook for the live refresh of bound fields (apps/server)
 *
 * What this module is for:
 *   BAJAOVRLAY-20 gives the server one more job: when a source's data changes, its
 *   refresher sends refreshBoundInstanceData for each instance whose live bound fields
 *   changed, signed `sistema:vinculos`. That actor may send that command and nothing
 *   else (a bug in the refresher must never take a graphic, clear a layer or change an
 *   item), and nobody else may send it: an operator who could would write values the
 *   source never gave, unseen as a correction (an override is the honest way, "Corrigir
 *   valor da fonte…").
 *
 * What these tests prove:
 *   - `sistema:vinculos` may send refreshBoundInstanceData, and is refused takeItem,
 *     clearLayer, updateInstanceData and recordDataSourcePoll.
 *   - An operator, a renderer, a monitor, the auto-out and a data-source poller are
 *     refused refreshBoundInstanceData.
 *
 * What these tests deliberately do not cover:
 *   - The NOT_ALLOWED refusal through a real store; storeAuthorisation.test.ts shows it.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';
import { bindingRefresherActor, buildDataSourcePollerActor } from './commandActors.js';

const refreshOfTheClockOnAir: Command = {
  type: 'refreshBoundInstanceData',
  instanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
  data: { state: 'yellow' },
};

describe('allowCommandForActorRole and the refresher of bound fields', () => {
  it('lets sistema:vinculos send refreshBoundInstanceData', () => {
    // Arrange: the refresher's actor and its one command.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(refreshOfTheClockOnAir, bindingRefresherActor);

    // Assert: allowed.
    expect(isAllowed, 'the refresher must be allowed its refresh').toBe(true);
  });

  const commandsTheRefresherMayNotSend: Array<{ name: string; command: Command }> = [
    // Putting a graphic on air is the operator's call.
    { name: 'takeItem', command: { type: 'takeItem', itemId: 'item-largada-do-enduro' } },
    // Emptying a layer is too.
    { name: 'clearLayer', command: { type: 'clearLayer', layerId: 'clock' } },
    // An operator's edit would mark the field "alterado no ar".
    {
      name: 'updateInstanceData',
      command: {
        type: 'updateInstanceData',
        instanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
        data: { state: 'yellow' },
        takeTimeFieldKeys: [],
      },
    },
    // Race data comes from the poller of its source alone.
    {
      name: 'recordDataSourcePoll',
      command: {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: { ok: false, error: 'Falha simulada.', attemptedAtMs: 1_786_717_925_000 },
      },
    },
  ];

  it.each(commandsTheRefresherMayNotSend)('refuses $name from sistema:vinculos', ({ command }) => {
    // Arrange: a command that is not a refresh.

    // Act: ask the hook for the refresher.
    const isAllowed = allowCommandForActorRole(command, bindingRefresherActor);

    // Assert: refused.
    expect(isAllowed, 'the refresher may send its refresh and nothing else').toBe(false);
  });

  const actorsThatMayNotRefresh = [
    // An operator's page: a value typed over a live field is an override, not a refresh.
    { name: 'an operator', actor: 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81' },
    // The OBS page only reports what is on screen.
    { name: 'a renderer', actor: 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12' },
    // The Programa and Prévia frames send nothing.
    { name: 'a monitor', actor: 'monitor:5c1e7a90-3b2d-4f68-9e0a-7d2c4b6e8f13' },
    // Another server timer keeps its own one command.
    { name: 'the auto-out', actor: 'sistema:auto-out' },
    // A poller reports polls; turning them into on-air data is the refresher's job.
    { name: 'the simulator poller', actor: buildDataSourcePollerActor('simulador-enduro') },
  ];

  it.each(actorsThatMayNotRefresh)('refuses refreshBoundInstanceData from $name', ({ actor }) => {
    // Arrange: the refresh of the clock on air, sent by this row's actor.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(refreshOfTheClockOnAir, actor);

    // Assert: refused.
    expect(isAllowed, 'only sistema:vinculos may refresh bound fields').toBe(false);
  });
});
