// The reducers of the two commands only the server's OBS connection sends (sistema:obs):
// recordObsState and recordObsSceneSwitchAnswer. Neither is ever refused, and both stay
// out of the event log like the other bookkeeping of the server's own loops (decision
// D11): OBS's status changes whenever someone works OBS, and the operator's history
// would drown in it. The one exception is OBS refusing a switch, which is logged as a
// failed row, since the operator asked for that switch and must be able to see why it
// did not happen.
import type {
  ObsStatus,
  RecordObsSceneSwitchAnswerCommand,
  RecordObsStateCommand,
} from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { describeObsRefusalOfASwitch } from '../obsRefusals.js';

/**
 * recordObsState: replaces OBS's status with the one read now, keeping the latest switch.
 * A status equal to the one held hands back the same slices, so a refresh that found
 * nothing new is not broadcast.
 */
export function reduceRecordObsState(
  slices: SlicesChangedByCommands,
  command: RecordObsStateCommand,
): ReducerOutcome {
  if (isSameObsStatus(slices.obs, command.status)) {
    return { status: 'applied', slices };
  }
  const obs = { ...command.status, sceneSwitch: slices.obs.sceneSwitch };
  return { status: 'applied', slices: { ...slices, obs }, isLeftOutOfTheEventLog: true };
}

/**
 * recordObsSceneSwitchAnswer: settles the switch of that number as `feita` or `recusada`.
 * An answer about any other switch, or one already settled (a late answer after the
 * connection dropped and settled it), hands back the same slices.
 */
export function reduceRecordObsSceneSwitchAnswer(
  slices: SlicesChangedByCommands,
  command: RecordObsSceneSwitchAnswerCommand,
): ReducerOutcome {
  const sceneSwitch = slices.obs.sceneSwitch;
  const isTheSwitchWaitingForThisAnswer =
    sceneSwitch !== null &&
    sceneSwitch.number === command.number &&
    sceneSwitch.status === 'enviada';
  if (!isTheSwitchWaitingForThisAnswer) {
    return { status: 'applied', slices };
  }
  if (command.isDone) {
    const doneSwitch = { ...sceneSwitch, status: 'feita' as const, refusalReason: null };
    const obs = { ...slices.obs, sceneSwitch: doneSwitch };
    return { status: 'applied', slices: { ...slices, obs }, isLeftOutOfTheEventLog: true };
  }
  const refusalReason = command.refusalReason ?? '';
  const refusedSwitch = { ...sceneSwitch, status: 'recusada' as const, refusalReason };
  const obs = { ...slices.obs, sceneSwitch: refusedSwitch };
  return {
    status: 'applied',
    slices: { ...slices, obs },
    refusalWrittenToTheEventLog: describeObsRefusalOfASwitch(refusalReason),
  };
}

/** Whether two statuses say the same, field by field (the scene list in order). */
function isSameObsStatus(heldStatus: ObsStatus, readStatus: ObsStatus): boolean {
  const isSameSceneList =
    heldStatus.sceneNames.length === readStatus.sceneNames.length &&
    heldStatus.sceneNames.every((sceneName, index) => sceneName === readStatus.sceneNames[index]);
  return (
    isSameSceneList &&
    heldStatus.connectionState === readStatus.connectionState &&
    heldStatus.address === readStatus.address &&
    heldStatus.lastError === readStatus.lastError &&
    heldStatus.programSceneName === readStatus.programSceneName &&
    heldStatus.isStudioModeOn === readStatus.isStudioModeOn &&
    heldStatus.previewSceneName === readStatus.previewSceneName
  );
}
