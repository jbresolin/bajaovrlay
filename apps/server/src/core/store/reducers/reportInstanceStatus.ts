import type { Instance, ReportInstanceStatusCommand } from '@bajaovrlay/shared';

import { refuseUnknownInstance } from '../commandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * reportInstanceStatus: records what a renderer says really happened to an instance.
 * A `loading` instance becomes `on-air`, or `failed` with the renderer's detail, and an
 * `on-air` instance becomes `failed`. Every other report leaves the instance exactly as
 * it is (the same array is handed back). Refused only if the instance is not there.
 */
export function reduceReportInstanceStatus(
  slices: SlicesChangedByCommands,
  command: ReportInstanceStatusCommand,
): ReducerOutcome {
  const reportedInstance = slices.instances.find((instance) => instance.id === command.instanceId);
  if (reportedInstance === undefined) {
    return { status: 'refused', error: refuseUnknownInstance(command.instanceId) };
  }

  // Several renderers show the same instance (OBS, the control page's monitor) and each
  // one reports, so a failure wins over a success (João's ruling, 2026-10-10):
  // - a `failed` after `on-air` turns the badge red, because some screen is not showing
  //   the graphic and the operator must know;
  // - an `on-air` after `failed` must not hide a failure the operator has not dealt
  //   with, and a second `failed` must not replace the reason already being read: a
  //   failed instance stays as it is until it is cleared or replaced;
  // - a second `on-air` is expected and changes nothing.
  // What could go wrong: the badge says "Falhou" while OBS is in fact showing the
  // graphic, when it was only the control page's monitor that failed. And since a
  // report that changes nothing is not written to the event log either, a second
  // failure's detail is recorded nowhere on the server (only in that renderer's log).
  const isWaitingForItsFirstReport = reportedInstance.status === 'loading';
  const isFailureAfterOnAir = reportedInstance.status === 'on-air' && command.status === 'failed';
  if (!isWaitingForItsFirstReport && !isFailureAfterOnAir) {
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
