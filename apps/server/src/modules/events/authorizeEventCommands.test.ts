/**
 * Who may send the event inbox's commands (apps/server)
 *
 * What this module is for:
 *   The authorize step (core/store/authorizeCommand.ts) decides by the actor's role. The
 *   inbox adds five commands and one server actor, the event detection and runner,
 *   `sistema:eventos`. It may record what it detected and show an event (the runner's
 *   "No ar"), and nothing else: a bug in it must never dismiss an event, change a rule,
 *   type an event or put any other graphic on air. Operators may approve, dismiss, type
 *   and change rules, but never record a detection: no page can fake race events.
 *
 * What these tests prove, one row per actor and command:
 *   - `sistema:eventos` may send recordDetectedEvents and showEvent; it may not send
 *     dismissEvent, createManualEvent, updateEventRule, takeItem or clearLayer.
 *   - An operator may send showEvent, dismissEvent, createManualEvent and
 *     updateEventRule, and may not send recordDetectedEvents.
 *   - A renderer and a monitor may send none of them; the auto-out may only clear.
 *
 * What these tests deliberately do not cover:
 *   - What the commands do; the inbox's store tests cover them.
 *   - The roles of other server actors; authorizeCommand.test.ts covers them.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from '../../core/store/authorizeCommand.js';
import { eventInboxActor } from '../../core/store/commandActors.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const rendererActor = 'renderer:7d1c0b2e-5a44-4f8e-9c3d-2b6e1f0a9d57';
const monitorActor = 'monitor:0e9b8a7c-6d5f-4e3a-8b2c-1d0f9e8a7b6c';

/** Car 47's start penalty, as the detection records it. */
const recordTheStartPenalty: Command = {
  type: 'recordDetectedEvents',
  events: [
    {
      eventId: 'simulador-enduro:incident:ocorrencia-0007',
      kind: 'newIncident',
      sourceId: 'simulador-enduro',
      detectedAtMs: 1_818_252_060_000,
      payload: { carNumber: 47, reason: 'Queima de largada', penaltyText: '+30 segundos' },
    },
  ],
};
const showTheStartPenalty: Command = {
  type: 'showEvent',
  eventId: 'simulador-enduro:incident:ocorrencia-0007',
};
const dismissTheStartPenalty: Command = {
  type: 'dismissEvent',
  eventId: 'simulador-enduro:incident:ocorrencia-0007',
};
const typeAPenalty: Command = {
  type: 'createManualEvent',
  noticeKind: 'penalty',
  carNumber: 47,
  reason: 'Reabastecimento com o motor ligado',
};
const putFastestLapsOnHold: Command = { type: 'updateEventRule', kind: 'fastestLap', mode: 'ask' };
const takeTheClock: Command = { type: 'takeItem', itemId: 'relogio-aviso' };
const clearTheNoticeLayer: Command = { type: 'clearLayer', layerId: 'notice' };

const authorizationScenarios: Array<{
  name: string;
  actor: string;
  command: Command;
  isAllowed: boolean;
}> = [
  // The detection's one job: record what it found.
  {
    name: 'lets the detection record events',
    actor: eventInboxActor,
    command: recordTheStartPenalty,
    isAllowed: true,
  },
  // The runner's one job: show an auto event when its layer is free.
  {
    name: 'lets the runner show an event',
    actor: eventInboxActor,
    command: showTheStartPenalty,
    isAllowed: true,
  },
  // Saying no is the operator's decision, never the server's.
  {
    name: 'keeps the detection from dismissing an event',
    actor: eventInboxActor,
    command: dismissTheStartPenalty,
    isAllowed: false,
  },
  // The server never invents an event.
  {
    name: 'keeps the detection from typing an event',
    actor: eventInboxActor,
    command: typeAPenalty,
    isAllowed: false,
  },
  // The rules are João's and the operator's.
  {
    name: 'keeps the detection from changing a rule',
    actor: eventInboxActor,
    command: putFastestLapsOnHold,
    isAllowed: false,
  },
  // It shows events through showEvent only, never any item it likes.
  {
    name: 'keeps the detection from taking an item',
    actor: eventInboxActor,
    command: takeTheClock,
    isAllowed: false,
  },
  // Clearing is the auto-out's job; the runner waits for the layer instead.
  {
    name: 'keeps the detection from clearing a layer',
    actor: eventInboxActor,
    command: clearTheNoticeLayer,
    isAllowed: false,
  },
  // "No ar".
  {
    name: 'lets an operator show',
    actor: operatorActor,
    command: showTheStartPenalty,
    isAllowed: true,
  },
  // "Descartar".
  {
    name: 'lets an operator dismiss',
    actor: operatorActor,
    command: dismissTheStartPenalty,
    isAllowed: true,
  },
  // "+ Evento".
  {
    name: 'lets an operator type an event',
    actor: operatorActor,
    command: typeAPenalty,
    isAllowed: true,
  },
  // "Regras".
  {
    name: 'lets an operator change a rule',
    actor: operatorActor,
    command: putFastestLapsOnHold,
    isAllowed: true,
  },
  // No page may fake a detection: race events come from the sources.
  {
    name: 'keeps an operator from recording a detection',
    actor: operatorActor,
    command: recordTheStartPenalty,
    isAllowed: false,
  },
  // A screen only reports what it drew.
  {
    name: 'keeps a renderer from showing an event',
    actor: rendererActor,
    command: showTheStartPenalty,
    isAllowed: false,
  },
  // A monitor sends nothing at all.
  {
    name: 'keeps a monitor from dismissing an event',
    actor: monitorActor,
    command: dismissTheStartPenalty,
    isAllowed: false,
  },
  // The auto-out clears layers and nothing else.
  {
    name: 'keeps the auto-out from showing an event',
    actor: 'sistema:auto-out',
    command: showTheStartPenalty,
    isAllowed: false,
  },
];

describe('allowCommandForActorRole for the event inbox', () => {
  it.each(authorizationScenarios)('$name', ({ actor, command, isAllowed }) => {
    // Arrange: this row's actor and command.

    // Act: ask the authorize step.
    const answer = allowCommandForActorRole(command, actor);

    // Assert: the answer of this row.
    expect(answer, `${actor} sending ${command.type} must be ${String(isAllowed)}`).toBe(isAllowed);
  });
});
