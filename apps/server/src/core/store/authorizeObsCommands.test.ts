/**
 * The authorisation hook and OBS control's commands (apps/server)
 *
 * What this module is for:
 *   OBS control (BAJAOVRLAY-27) adds three commands. switchObsScene is the operator's: the
 *   control page, a pad through the command API, and a macro's obsScene step send it.
 *   recordObsState and recordObsSceneSwitchAnswer report what OBS did; only the server's
 *   OBS connection hears OBS, so only it, signed `sistema:obs`, may send them.
 *
 * What these tests prove:
 *   - An operator, a pad and a macro's runner may switch OBS's scene.
 *   - A renderer, a monitor and another server timer (the auto-out) may not.
 *   - `sistema:obs` may send its two reports and nothing else: not a switch, not a take.
 *   - An operator, a pad and a macro's runner may not send either report: no page may
 *     claim OBS shows a scene it does not, nor answer a switch for OBS.
 *
 * What these tests deliberately do not cover:
 *   - The store's NOT_ALLOWED refusal and its event-log row; createStateStore.test.ts.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const companionActor = 'api:companion';
const macroRunnerActor = 'sistema:macro:macro-pista-e-torre';
const rendererActor = 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12';
const monitorActor = 'monitor:0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const autoOutActor = 'sistema:auto-out';
const obsConnectionActor = 'sistema:obs';

const switchToTheTrack: Command = {
  type: 'switchObsScene',
  sceneName: 'Pista',
  target: 'program',
};
const reportObsOnTheTrack: Command = {
  type: 'recordObsState',
  status: {
    connectionState: 'conectado',
    address: 'ws://127.0.0.1:4455',
    lastError: null,
    sceneNames: ['Pista', 'Box', 'Pódio'],
    programSceneName: 'Pista',
    isStudioModeOn: false,
    previewSceneName: null,
  },
};
const answerTheFirstSwitch: Command = {
  type: 'recordObsSceneSwitchAnswer',
  number: 1,
  isDone: true,
  refusalReason: null,
};
const clearTheClock: Command = { type: 'clearLayer', layerId: 'clock' };

const authorisationScenarios = [
  // The control page's scene buttons.
  {
    name: 'lets an operator switch OBS’s scene',
    actor: operatorActor,
    command: switchToTheTrack,
    expectedIsAllowed: true,
  },
  // A pad's scene button, through POST /api/v1/obs-scene/{sceneName}.
  {
    name: 'lets a pad switch OBS’s scene',
    actor: companionActor,
    command: switchToTheTrack,
    expectedIsAllowed: true,
  },
  // "Pista + torre": the obsScene step.
  {
    name: 'lets a macro’s runner switch OBS’s scene',
    actor: macroRunnerActor,
    command: switchToTheTrack,
    expectedIsAllowed: true,
  },
  // A page that only draws must never change what OBS shows.
  {
    name: 'refuses a renderer’s switch',
    actor: rendererActor,
    command: switchToTheTrack,
    expectedIsAllowed: false,
  },
  // The Programa and Prévia frames send nothing at all.
  {
    name: 'refuses a monitor’s switch',
    actor: monitorActor,
    command: switchToTheTrack,
    expectedIsAllowed: false,
  },
  // A timer that clears a layer has no business with OBS.
  {
    name: 'refuses the auto-out’s switch',
    actor: autoOutActor,
    command: switchToTheTrack,
    expectedIsAllowed: false,
  },
  // The connection's two reports.
  {
    name: 'lets the OBS connection report OBS’s status',
    actor: obsConnectionActor,
    command: reportObsOnTheTrack,
    expectedIsAllowed: true,
  },
  {
    name: 'lets the OBS connection report OBS’s answer to a switch',
    actor: obsConnectionActor,
    command: answerTheFirstSwitch,
    expectedIsAllowed: true,
  },
  // The connection reports; it never decides what goes on OBS or on air.
  {
    name: 'refuses a switch from the OBS connection',
    actor: obsConnectionActor,
    command: switchToTheTrack,
    expectedIsAllowed: false,
  },
  {
    name: 'refuses a clear from the OBS connection',
    actor: obsConnectionActor,
    command: clearTheClock,
    expectedIsAllowed: false,
  },
  // No page may claim OBS shows a scene it does not.
  {
    name: 'refuses an operator’s report of OBS’s status',
    actor: operatorActor,
    command: reportObsOnTheTrack,
    expectedIsAllowed: false,
  },
  // No pad may answer a switch for OBS, which would let a macro go on over the wrong scene.
  {
    name: 'refuses a pad’s answer to a switch',
    actor: companionActor,
    command: answerTheFirstSwitch,
    expectedIsAllowed: false,
  },
  // A macro's runner waits for OBS's answer; it may not write one.
  {
    name: 'refuses a macro runner’s answer to a switch',
    actor: macroRunnerActor,
    command: answerTheFirstSwitch,
    expectedIsAllowed: false,
  },
];

describe('allowCommandForActorRole with OBS control’s commands', () => {
  it.each(authorisationScenarios)('$name', ({ actor, command, expectedIsAllowed }) => {
    // Arrange: the row's actor and command (in the table above).

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, actor);

    // Assert: allowed or refused as the row says.
    expect(
      isAllowed,
      `${actor} must ${expectedIsAllowed ? 'be allowed' : 'be refused'} ${command.type}`,
    ).toBe(expectedIsAllowed);
  });
});
