import type { ObsSceneSwitch, ObsSlice } from '@bajaovrlay/shared';

/**
 * The cause written on a scene change nobody asked the server for: the director cut in
 * OBS itself (or a Stream Deck talking to OBS directly). It is no actor of the server, so
 * neither rule against loops ever drops it.
 */
export const sceneChangedInObsItself = 'obs';

/** A change of the scene on OBS's Program: the scene left, the scene entered, and why. */
export type ProgramSceneChange = {
  leftSceneName: string;
  enteredSceneName: string;
  /** The actor of the switch that made it, or sceneChangedInObsItself. */
  causedBy: string;
};

/** What one new reading of the `obs` slice says to the trigger service. */
export type ObsReading = {
  /** The change of Program in this reading, or undefined when there is none. */
  sceneChange: ProgramSceneChange | undefined;
  /** The number of the latest switch that may no longer be blamed for any change. */
  numberOfTheLastSwitchUsedUp: number | undefined;
};

/**
 * Reads one new state of the `obs` slice against the one before it: the change of
 * Program, if any, and who made it. Connecting (no scene before) and disconnecting (no
 * scene after) are no change: nobody entered or left a scene, the server only heard or
 * stopped hearing OBS.
 *
 * A change is blamed on the latest switch (rule 1 against loops reads this,
 * whenATriggerMayFire.ts) only while that switch is not used up: told apart by the switch
 * and the order of OBS's reports, never by the clock. A switch is used up by:
 * - the one change it is blamed for;
 * - a refusal, which is also how the connection reports a switch OBS left unanswered past
 *   its time limit;
 * - an answer of "feita" when its scene is already on Program: the change came before
 *   the answer (and was blamed then), or never comes;
 * - the reading after its answer: OBS reports the new scene right after it answers, so
 *   only that reading can still carry the switch's change.
 * Any change not blamed on a switch was made in OBS itself. What could go wrong: an OBS
 * that answers "feita" and then reports nothing until the director's next cut would have
 * that cut blamed on the switch if it goes to the same scene; OBS reports every change of
 * Program, so it is not expected.
 */
export function readObsReading(
  obsBefore: ObsSlice,
  obsAfter: ObsSlice,
  numberOfTheLastSwitchUsedUp: number | undefined,
): ObsReading {
  const sceneSwitch = obsAfter.sceneSwitch;
  const leftSceneName = obsBefore.programSceneName;
  const enteredSceneName = obsAfter.programSceneName;
  if (sceneSwitch === null) {
    return {
      sceneChange: findChangeMadeInObsItself(leftSceneName, enteredSceneName),
      numberOfTheLastSwitchUsedUp,
    };
  }

  const isProgramChanged =
    leftSceneName !== null && enteredSceneName !== null && leftSceneName !== enteredSceneName;
  const mayTheSwitchBeBlamed =
    sceneSwitch.number !== numberOfTheLastSwitchUsedUp &&
    sceneSwitch.status !== 'recusada' &&
    sceneSwitch.target === 'program' &&
    sceneSwitch.sceneName === enteredSceneName;
  if (isProgramChanged && mayTheSwitchBeBlamed) {
    return {
      sceneChange: { leftSceneName, enteredSceneName, causedBy: sceneSwitch.requestedBy },
      numberOfTheLastSwitchUsedUp: sceneSwitch.number,
    };
  }

  const isTheSwitchUsedUpNow = isSwitchSpentByThisReading(obsBefore, sceneSwitch, obsAfter);
  return {
    sceneChange: findChangeMadeInObsItself(leftSceneName, enteredSceneName),
    numberOfTheLastSwitchUsedUp: isTheSwitchUsedUpNow
      ? sceneSwitch.number
      : numberOfTheLastSwitchUsedUp,
  };
}

/** The change of Program between two scene names, made in OBS itself, or undefined. */
function findChangeMadeInObsItself(
  leftSceneName: string | null,
  enteredSceneName: string | null,
): ProgramSceneChange | undefined {
  if (leftSceneName === null || enteredSceneName === null || leftSceneName === enteredSceneName) {
    return undefined;
  }
  return { leftSceneName, enteredSceneName, causedBy: sceneChangedInObsItself };
}

/**
 * Whether this reading uses up the switch whatever changed: it was refused, or answered
 * "feita" with nothing more to come (its scene already on Program, or it switched
 * Preview), or answered in an earlier reading. A switch still waiting is never used up.
 */
function isSwitchSpentByThisReading(
  obsBefore: ObsSlice,
  sceneSwitch: ObsSceneSwitch,
  obsAfter: ObsSlice,
): boolean {
  if (sceneSwitch.status === 'enviada') {
    return false;
  }
  if (sceneSwitch.status === 'recusada') {
    return true;
  }
  const switchBefore = obsBefore.sceneSwitch;
  const wasAnsweredInAnEarlierReading =
    switchBefore !== null &&
    switchBefore.number === sceneSwitch.number &&
    switchBefore.status !== 'enviada';
  const hasNoChangeToCome =
    sceneSwitch.target !== 'program' || obsAfter.programSceneName === sceneSwitch.sceneName;
  return wasAnsweredInAnEarlierReading || hasNoChangeToCome;
}
