import { isDeepStrictEqual } from 'node:util';

import {
  findClockFieldKeysByRole,
  type Graphic,
  type Instance,
  type InstanceBoundField,
  resolveBindingAgainstSources,
  type SourcesForBindings,
} from '@bajaovrlay/shared';

import { listRequiredFieldKeysOfGraphic } from '../../core/store/graphicSchemaProperties.js';

/** What the refresher hands buildRefreshOfLiveBoundFields for one instance. */
export type LiveBoundFieldsRefreshRequest = {
  /** The instance on air or in preview, with the data it shows now. */
  instance: Instance;
  /** Its entry of `instanceBindings`; frozen fields there are skipped. */
  boundFields: InstanceBoundField[];
  /** Its graphic as registered now: which fields are required, the clock fields by role. */
  graphic: Graphic | undefined;
  /** The sources, their last good snapshots and the overrides. */
  sources: SourcesForBindings;
  /** The sources whose data changed; undefined means every source (an override changed). */
  sourceIdsThatChanged: ReadonlySet<string> | undefined;
};

/** The session path that reads the whole clock at once (the clock group). */
const wholeClockPath = 'clock';

/**
 * The data to send as refreshBoundInstanceData for one instance, or undefined when
 * nothing would change on air. It reads the instance's live bound fields (never its
 * frozen ones, never the item) against the sources, and sends every live value as one
 * set whenever any of them differs from what is on air, so the whole clock always moves
 * as one reading. A field that cannot be read now is kept on air as it is, because nothing
 * on air is ever blanked by a failure (rule 4): a deleted source, a source with no data,
 * or a required field whose value is gone. Only an optional field whose value the source
 * no longer has leaves the air (sent as null): showing a gap the car no longer has would
 * be wrong, and the graphic is built to do without it.
 */
export function buildRefreshOfLiveBoundFields(
  request: LiveBoundFieldsRefreshRequest,
): Record<string, unknown> | undefined {
  const { instance, boundFields, graphic, sources, sourceIdsThatChanged } = request;
  const requiredFieldKeys = graphic === undefined ? [] : listRequiredFieldKeysOfGraphic(graphic);
  const clockFieldKeys = graphic === undefined ? undefined : findClockFieldKeysByRole(graphic);
  const valuesToSend: Record<string, unknown> = {};

  for (const { fieldKey, binding } of boundFields) {
    const isReadNow =
      binding.isLive &&
      (sourceIdsThatChanged === undefined || sourceIdsThatChanged.has(binding.sourceId));
    if (!isReadNow) {
      continue;
    }
    const resolution = resolveBindingAgainstSources(binding, sources);
    if (binding.path === wholeClockPath) {
      const clockReading = resolution.status === 'resolved' ? resolution.value : undefined;
      const isClockReading =
        typeof clockReading === 'object' && clockReading !== null && !Array.isArray(clockReading);
      if (clockFieldKeys !== undefined && isClockReading) {
        valuesToSend[clockFieldKeys.clockTime] = clockReading.referenceTimeMs;
        valuesToSend[clockFieldKeys.wallClock] = clockReading.referenceWallClockMs;
        valuesToSend[clockFieldKeys.clockRunning] = clockReading.running;
        valuesToSend[clockFieldKeys.clockMode] = clockReading.clockMode;
      }
      continue;
    }
    if (resolution.status === 'resolved') {
      valuesToSend[fieldKey] = resolution.value;
      continue;
    }
    const isOptionalValueGone =
      resolution.status === 'valueAbsent' && !requiredFieldKeys.includes(fieldKey);
    if (isOptionalValueGone) {
      valuesToSend[fieldKey] = null;
    }
  }

  const isAnyValueDifferentFromAir = Object.entries(valuesToSend).some(([fieldKey, value]) =>
    doesValueDifferFromAir(instance.resolvedData, fieldKey, value),
  );
  return isAnyValueDifferentFromAir ? valuesToSend : undefined;
}

/** Whether a value to send differs from the air: a null equals a field not on air. */
function doesValueDifferFromAir(
  dataOnAir: Record<string, unknown>,
  fieldKey: string,
  value: unknown,
): boolean {
  const isOnAir = Object.hasOwn(dataOnAir, fieldKey);
  if (value === null) {
    return isOnAir;
  }
  return !isOnAir || !isDeepStrictEqual(dataOnAir[fieldKey], value);
}
