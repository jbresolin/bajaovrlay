import type { ObsSceneSwitch, SwitchObsSceneCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  refusePreviewWithStudioModeOff,
  refuseSceneObsDoesNotHave,
  refuseSwitchWhileObsIsNotConnected,
  refuseSwitchWhileOneIsPending,
  refuseSwitchWithoutObsConfigured,
} from '../obsRefusals.js';

/**
 * switchObsScene: records the switch as `enviada`, numbered one past the switch before it.
 * A reducer is pure, so it asks OBS nothing: the OBS connection (../obsConnection.ts)
 * watches the slice, asks OBS, and records OBS's answer with recordObsSceneSwitchAnswer.
 * Recording it is also what writes the event-log row naming the scene.
 * Refused, in this order, with OBS not configured, not connected, a scene the slice does
 * not list, Preview with Studio Mode off, and while the switch before has no answer yet:
 * one at a time, so a macro waiting for its own answer never reads another switch's.
 * What could go wrong: the slice can be a moment behind OBS (a scene deleted just now);
 * OBS then refuses the switch itself and its answer says so.
 */
export function reduceSwitchObsScene(
  slices: SlicesChangedByCommands,
  command: SwitchObsSceneCommand,
): ReducerOutcome {
  const obs = slices.obs;
  if (obs.address === null) {
    return { status: 'refused', error: refuseSwitchWithoutObsConfigured() };
  }
  if (obs.connectionState !== 'conectado') {
    return { status: 'refused', error: refuseSwitchWhileObsIsNotConnected() };
  }
  if (!obs.sceneNames.includes(command.sceneName)) {
    return { status: 'refused', error: refuseSceneObsDoesNotHave(command.sceneName) };
  }
  if (command.target === 'preview' && !obs.isStudioModeOn) {
    return { status: 'refused', error: refusePreviewWithStudioModeOff() };
  }
  if (obs.sceneSwitch?.status === 'enviada') {
    return { status: 'refused', error: refuseSwitchWhileOneIsPending(obs.sceneSwitch.sceneName) };
  }

  const numberOfTheSwitchBefore = obs.sceneSwitch?.number ?? 0;
  const sceneSwitch: ObsSceneSwitch = {
    number: numberOfTheSwitchBefore + 1,
    sceneName: command.sceneName,
    target: command.target,
    status: 'enviada',
    refusalReason: null,
  };
  return { status: 'applied', slices: { ...slices, obs: { ...obs, sceneSwitch } } };
}
