import type { ObsSlice } from '@bajaovrlay/shared';

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
  /** The number of that switch, so it is never counted as the cause of a later change. */
  switchNumberCounted: number | undefined;
};

/**
 * The change of Program between two readings of the `obs` slice, or undefined when there
 * is none. Connecting (no scene before) and disconnecting (no scene after) are no change:
 * nobody entered or left a scene, the server only heard or stopped hearing OBS.
 * The cause is the latest scene switch when that switch was for Program, to the scene now
 * entered, not refused, and not already counted as the cause of an earlier change; any
 * other change was made in OBS itself. So a macro's switch to Box is the cause of the one
 * change to Box that followed it, and of nothing after (rule 1 against loops reads this,
 * whenATriggerMayFire.ts): told apart by the switch, never by timing.
 */
export function findProgramSceneChange(
  obsBefore: ObsSlice,
  obsAfter: ObsSlice,
  numberOfTheLastSwitchCounted: number | undefined,
): ProgramSceneChange | undefined {
  const leftSceneName = obsBefore.programSceneName;
  const enteredSceneName = obsAfter.programSceneName;
  if (leftSceneName === null || enteredSceneName === null || leftSceneName === enteredSceneName) {
    return undefined;
  }
  const sceneSwitch = obsAfter.sceneSwitch;
  const isMadeByTheLatestSwitch =
    sceneSwitch !== null &&
    sceneSwitch.target === 'program' &&
    sceneSwitch.sceneName === enteredSceneName &&
    sceneSwitch.status !== 'recusada' &&
    sceneSwitch.number !== numberOfTheLastSwitchCounted;
  if (!isMadeByTheLatestSwitch) {
    return {
      leftSceneName,
      enteredSceneName,
      causedBy: sceneChangedInObsItself,
      switchNumberCounted: undefined,
    };
  }
  return {
    leftSceneName,
    enteredSceneName,
    causedBy: sceneSwitch.requestedBy,
    switchNumberCounted: sceneSwitch.number,
  };
}
