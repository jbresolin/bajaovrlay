import type { Instance, ReportInstanceStatusCommand } from '@bajaovrlay/shared';

import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * reportInstanceStatus: records what a renderer says really happened to an instance.
 * A `loading` instance becomes `on-air`, or `failed` with the renderer's detail, and an
 * `on-air` instance becomes `failed`. Every other report leaves the instance exactly as
 * it is (the same slices are handed back), including a report about an instance that is
 * no longer there. This reducer never refuses.
 */
export function reduceReportInstanceStatus(
  slices: SlicesChangedByCommands,
  command: ReportInstanceStatusCommand,
): ReducerOutcome {
  const reportedInstance = slices.instances.find((instance) => instance.id === command.instanceId);
  if (reportedInstance === undefined) {
    // A late report is normal, not a mistake: the operator cleared the layer while the
    // graphic was still playing in, and the renderer's report was already on its way
    // (João's ruling, 2026-10-11). Refusing it would write a failed command to the event
    // log on every quick clear. Handing back the same slices makes the store save, log
    // and broadcast nothing. What could go wrong: a report carrying an instance id that
    // never existed (a renderer bug) is accepted just as silently.
    return { status: 'applied', slices };
  }

  // Only renderer pages on the program output report (what OBS loads); the control
  // page's program monitor shows the same graphics but connects without the renderer
  // role and never reports, so the badge speaks for the program output alone (João's
  // ruling, 2026-10-11). There can still be more than one reporting renderer (a second
  // OBS machine, or OBS reloading its browser source), so a failure wins over a success
  // (João's ruling, 2026-10-10):
  // - a `failed` after `on-air` turns the badge red, because some program screen is not
  //   showing the graphic and the operator must know;
  // - an `on-air` after `failed` must not hide a failure the operator has not dealt
  //   with, and a second `failed` must not replace the reason already being read: a
  //   failed instance stays as it is until it is cleared or replaced;
  // - a second `on-air` is expected and changes nothing.
  // What could go wrong: a failure the monitor alone suffers is never shown as a badge;
  // with two OBS machines the badge says "Falhou" while one of them shows the graphic;
  // and with no OBS connected nothing reports, so the badge stays "Carregando". And
  // since a report that changes nothing is not written to the event log either, a
  // second failure's detail is recorded nowhere on the server (only in that renderer's
  // log).
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
