import { findClockFieldKeysByRole, type Slices } from '@bajaovrlay/shared';

/**
 * Answers whether a clock is running on any output, program or preview: an instance of
 * a graphic that marks the four clock roles, whose clockRunning field is true. Found by
 * the roles, never by a graphic's name, so a new clock graphic counts with no change
 * here. A clock on preview counts too: the preview monitor shows it to the operator.
 */
export function isAnyClockRunningOnAnOutput(slices: Slices): boolean {
  return slices.instances.some((instance) => {
    const graphic = slices.graphics.find((candidate) => candidate.id === instance.graphicId);
    if (graphic === undefined) {
      return false;
    }
    const clockFieldKeys = findClockFieldKeysByRole(graphic);
    if (clockFieldKeys === undefined) {
      return false;
    }
    return instance.resolvedData[clockFieldKeys.clockRunning] === true;
  });
}
