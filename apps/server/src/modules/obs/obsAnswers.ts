// What OBS answers, read into what the server keeps: the scene list and Studio Mode into
// the slice's status, and every way a connection or a switch can fail into its pt-BR
// reason. OBS's answers cross a boundary, so they are checked with Zod before any field
// is trusted. Split from obsConnection.ts, whose job is the connection's life.
import type { ObsStatus } from '@bajaovrlay/shared';
import { OBSWebSocketError } from 'obs-websocket-js/json';
import { z } from 'zod';

import { ptBR } from '../../core/messages/ptBR.js';

// obs-websocket 5's numbers for the answers the server tells apart (protocol.md).
const authenticationFailedCloseCode = 4009;
const unsupportedRpcVersionCloseCode = 4010;
const studioModeNotActiveStatusCode = 506;
const resourceNotFoundStatusCode = 600;

/** GetSceneList's answer, as far as the server reads it. */
const SceneListAnswerSchema = z.object({
  currentProgramSceneName: z.string(),
  currentPreviewSceneName: z.string().nullable(),
  scenes: z.array(z.object({ sceneName: z.string(), sceneIndex: z.number() })),
});

/** GetStudioModeEnabled's answer. */
const StudioModeAnswerSchema = z.object({ studioModeEnabled: z.boolean() });

/** Thrown when OBS did not answer a request within the time it has. */
export class ObsAnswerTooLateError extends Error {
  constructor(requestType: string) {
    super(`OBS did not answer ${requestType} in time`);
  }
}

/** Thrown into a request still waiting when the connection dropped or the server stopped. */
export class ObsConnectionGoneError extends Error {
  constructor() {
    super('the OBS connection closed before OBS answered');
  }
}

/**
 * The connected status read from OBS's two answers. The scenes come in the order of
 * OBS's Scenes panel, top first: obs-websocket lists them bottom first and gives the top
 * the highest sceneIndex. Preview is named only while Studio Mode is on. Throws when an
 * answer does not have the expected shape.
 */
export function buildConnectedStatusFromObsAnswers(answers: {
  address: string;
  lastError: string | null;
  sceneListAnswer: unknown;
  studioModeAnswer: unknown;
}): ObsStatus {
  const sceneList = SceneListAnswerSchema.parse(answers.sceneListAnswer);
  const studioMode = StudioModeAnswerSchema.parse(answers.studioModeAnswer);
  const scenesTopFirst = [...sceneList.scenes].sort(
    (higher, lower) => lower.sceneIndex - higher.sceneIndex,
  );
  const isStudioModeOn = studioMode.studioModeEnabled;
  return {
    connectionState: 'conectado',
    address: answers.address,
    lastError: answers.lastError,
    sceneNames: scenesTopFirst.map((scene) => scene.sceneName),
    programSceneName: sceneList.currentProgramSceneName,
    isStudioModeOn,
    previewSceneName: isStudioModeOn ? sceneList.currentPreviewSceneName : null,
  };
}

/**
 * Why an attempt to connect failed, in pt-BR: the password refused (or asked for and not
 * given), an OBS too old for obs-websocket 5, or, for anything else, OBS not answering
 * at that address. Never quotes the password.
 */
export function describeWhyTheConnectionFailed(
  connectError: unknown,
  isPasswordGiven: boolean,
  address: string,
): string {
  const closeCode = connectError instanceof OBSWebSocketError ? connectError.code : undefined;
  if (closeCode === authenticationFailedCloseCode) {
    return isPasswordGiven ? ptBR.obs.passwordRefused : ptBR.obs.passwordMissing;
  }
  if (closeCode === unsupportedRpcVersionCloseCode) {
    return ptBR.obs.unsupportedVersion;
  }
  return ptBR.obs.notAnswering(address);
}

/**
 * Why OBS did not do a switch, in pt-BR: the scene is gone, Studio Mode went off, OBS did
 * not answer in time, the connection dropped first, or OBS's own words for anything else.
 */
export function describeWhyTheSwitchFailed(switchError: unknown, sceneName: string): string {
  if (switchError instanceof ObsAnswerTooLateError) {
    return ptBR.obs.noAnswerInTime(sceneName);
  }
  if (switchError instanceof ObsConnectionGoneError) {
    return ptBR.obs.droppedBeforeTheAnswer(sceneName);
  }
  if (switchError instanceof OBSWebSocketError) {
    if (switchError.code === resourceNotFoundStatusCode) {
      return ptBR.obs.obsRefusedTheSwitch(sceneName, ptBR.obs.obsReasons.sceneGone);
    }
    if (switchError.code === studioModeNotActiveStatusCode) {
      return ptBR.obs.obsRefusedTheSwitch(sceneName, ptBR.obs.obsReasons.studioModeOff);
    }
    return ptBR.obs.obsRefusedTheSwitch(sceneName, ptBR.obs.obsReasons.other(switchError.message));
  }
  return ptBR.obs.droppedBeforeTheAnswer(sceneName);
}

/** The address as the tally shows it: scheme, host and port, never anything else. */
export function describeObsAddress(url: string): string {
  const parsedUrl = new URL(url);
  return `${parsedUrl.protocol}//${parsedUrl.host}`;
}
