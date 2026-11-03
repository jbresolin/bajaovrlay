// The refusals of switchObsScene and the event-log error of OBS's own refusal, each with
// its stable code and pt-BR message.
import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/** The refusal for a switch with BAJAOVRLAY_OBS_URL not set: nothing to connect to. */
export function refuseSwitchWithoutObsConfigured(): CommandError {
  return { code: 'OBS_NOT_CONNECTED', message: ptBR.obs.notConfigured };
}

/** The refusal for a switch while OBS is configured but not connected now. */
export function refuseSwitchWhileObsIsNotConnected(): CommandError {
  return { code: 'OBS_NOT_CONNECTED', message: ptBR.obs.notConnected };
}

/** The refusal for a scene the slice does not list (renamed, deleted or mistyped). */
export function refuseSceneObsDoesNotHave(sceneName: string): CommandError {
  return { code: 'OBS_SCENE_NOT_FOUND', message: ptBR.obs.sceneNotFound(sceneName) };
}

/** The refusal for a switch of Preview while Studio Mode is off. */
export function refusePreviewWithStudioModeOff(): CommandError {
  return { code: 'OBS_STUDIO_MODE_OFF', message: ptBR.obs.studioModeOff };
}

/** The refusal for a switch while OBS has not answered the one before, named by its scene. */
export function refuseSwitchWhileOneIsPending(pendingSceneName: string): CommandError {
  return { code: 'OBS_SCENE_SWITCH_PENDING', message: ptBR.obs.switchPending(pendingSceneName) };
}

/** The failed event-log row's error when OBS did not do a switch the server sent. */
export function describeObsRefusalOfASwitch(refusalReason: string): CommandError {
  return { code: 'OBS_REFUSED_SCENE_SWITCH', message: refusalReason };
}
