/**
 * Who may press "Próximo" (apps/server)
 *
 * What this module is for:
 *   nextOnLayer moves the graphic on air to its next step (the podium's places,
 *   BAJAOVRLAY-47). It changes what is on air, so it is an operator's decision, like a
 *   take or a clear. The authorisation step decides by the actor's role
 *   (authorizeCommand.ts); this file lists every role against this one command.
 *
 * What these tests prove:
 *   - An operator may send nextOnLayer.
 *   - A renderer, a monitor, a macro runner, the macro watchdog, the auto-out, the
 *     refresher of bound fields, the event inbox, the media store, a source's poller and
 *     the recorder may not: none of them may advance what the operator reveals.
 *
 * What these tests deliberately do not cover:
 *   - What nextOnLayer does; nextOnLayer.test.ts.
 *   - The store's NOT_ALLOWED refusal; createStateStore.test.ts.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';
import {
  bindingRefresherActor,
  buildDataSourcePollerActor,
  buildMacroRunnerActor,
  buildMonitorActor,
  buildOperatorActor,
  buildRendererActor,
  dataSourceRecorderActor,
  eventInboxActor,
  macroWatchdogActor,
  mediaStoreActor,
} from './commandActors.js';

/** "Próximo" on the podium at its head, as the Camadas row sends it. */
const nextStepOfThePodium: Command = { type: 'nextOnLayer', layerId: 'fullscreen', fromStep: 0 };

const actorScenarios = [
  // The operator at the desk reveals the places, one per press.
  { name: 'allows an operator', actor: buildOperatorActor('mesa-1'), expectedIsAllowed: true },
  // OBS's page only reports what it draws.
  { name: 'refuses a renderer', actor: buildRendererActor('obs-1'), expectedIsAllowed: false },
  // A monitor sends no command at all.
  { name: 'refuses a monitor', actor: buildMonitorActor('monitor-1'), expectedIsAllowed: false },
  // A macro step is a take, a clear or a wait; stepping is not among them.
  {
    name: 'refuses a macro runner',
    actor: buildMacroRunnerActor('macro-podio'),
    expectedIsAllowed: false,
  },
  // The watchdog only ends a stuck macro run.
  { name: 'refuses the macro watchdog', actor: macroWatchdogActor, expectedIsAllowed: false },
  // The auto-out only ever clears a layer.
  { name: 'refuses the auto-out', actor: 'sistema:auto-out', expectedIsAllowed: false },
  // The refresher only writes a source's new values.
  {
    name: 'refuses the refresher of bound fields',
    actor: bindingRefresherActor,
    expectedIsAllowed: false,
  },
  // The event inbox records events and shows the ones its rules allow, nothing else.
  { name: 'refuses the event inbox', actor: eventInboxActor, expectedIsAllowed: false },
  // The media store only records uploaded files.
  { name: 'refuses the media store', actor: mediaStoreActor, expectedIsAllowed: false },
  // A poller only records its source's polls.
  {
    name: 'refuses a source’s poller',
    actor: buildDataSourcePollerActor('simulador-enduro'),
    expectedIsAllowed: false,
  },
  // The recorder only keeps its recording's books.
  { name: 'refuses the recorder', actor: dataSourceRecorderActor, expectedIsAllowed: false },
];

describe('nextOnLayer and the actor roles', () => {
  it.each(actorScenarios)('$name', ({ actor, expectedIsAllowed }) => {
    // Arrange: the actor of this row and "Próximo" on the podium.

    // Act: ask the default hook whether this actor may press it.
    const isAllowed = allowCommandForActorRole(nextStepOfThePodium, actor);

    // Assert: only an operator may.
    expect(isAllowed, 'only an operator may advance what is on air').toBe(expectedIsAllowed);
  });
});
