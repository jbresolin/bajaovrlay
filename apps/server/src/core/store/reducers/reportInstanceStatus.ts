import type { Instance, ReportInstanceStatusCommand } from '@bajaovrlay/shared';

import { refuseUnknownInstance } from '../commandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * reportInstanceStatus: records what a renderer says really happened to an instance.
 * A `loading` instance becomes `on-air`, or `failed` with the renderer's detail. An
 * instance in any other status is left exactly as it is (the same array is handed
 * back). Refused only if the instance is not there.
 */
export function reduceReportInstanceStatus(
  slices: SlicesChangedByCommands,
  command: ReportInstanceStatusCommand,
): ReducerOutcome {
  const reportedInstance = slices.instances.find((instance) => instance.id === command.instanceId);
  if (reportedInstance === undefined) {
    return { status: 'refused', error: refuseUnknownInstance(command.instanceId) };
  }

  // Only the first report about an instance counts. Several renderers show the same
  // instance (OBS, the control page's monitor) and each one reports, so:
  // - a second `on-air` is expected and must not cause a save and a broadcast;
  // - a `failed` after `on-air` must not turn the badge red while OBS is showing the
  //   graphic, and an `on-air` after `failed` must not hide a failure the operator has
  //   not dealt with: a failed instance stays until it is cleared or replaced.
  // What goes unseen: a renderer that fails after another already reported `on-air`.
  // That report is still in the event log, with its detail.
  const isWaitingForItsFirstReport = reportedInstance.status === 'loading';
  if (!isWaitingForItsFirstReport) {
    return { status: 'applied', slices };
  }

  const instanceAfterReport: Instance = { ...reportedInstance, status: command.status };
  // The detail is optional in the report; the key is left off rather than set to an
  // empty text, which InstanceSchema refuses (and a stored slice that fails its schema
  // stops the next boot).
  if (command.status === 'failed' && command.detail !== undefined) {
    instanceAfterReport.statusDetail = command.detail;
  }
  const instancesAfterReport = slices.instances.map((instance) =>
    instance.id === command.instanceId ? instanceAfterReport : instance,
  );
  return { status: 'applied', slices: { ...slices, instances: instancesAfterReport } };
}
