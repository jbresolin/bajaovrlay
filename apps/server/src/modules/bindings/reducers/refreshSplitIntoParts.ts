import type { ClockFieldKeysByRole } from '@bajaovrlay/shared';

/**
 * A refused refresh cut into the parts tried one by one (refreshBoundInstanceData.ts):
 * the clock group first, its four fields together (a time without its moment would make
 * the clock jump), then every other field alone, in the order sent. A graphic with no
 * clock, or a refresh with no clock field, gives one part per field.
 */
export function splitRefreshIntoParts(
  data: Record<string, unknown>,
  clockFieldKeys: ClockFieldKeysByRole | undefined,
): Array<Record<string, unknown>> {
  const keysOfTheClock = clockFieldKeys === undefined ? [] : Object.values(clockFieldKeys);
  const clockPart: Record<string, unknown> = {};
  const otherParts: Array<Record<string, unknown>> = [];
  for (const [fieldKey, value] of Object.entries(data)) {
    if (keysOfTheClock.includes(fieldKey)) {
      clockPart[fieldKey] = value;
    } else {
      otherParts.push({ [fieldKey]: value });
    }
  }
  const hasClockPart = Object.keys(clockPart).length > 0;
  return hasClockPart ? [clockPart, ...otherParts] : otherParts;
}
