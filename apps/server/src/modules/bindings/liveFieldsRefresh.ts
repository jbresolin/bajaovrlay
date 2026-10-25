import { isDeepStrictEqual } from 'node:util';

import {
  doesBindingReadTheTeams,
  type EntityLibrary,
  findClockFieldKeysByRole,
  type Graphic,
  type Instance,
  type InstanceBoundField,
  type InstanceEntityField,
  resolveBindingAgainstSources,
  type SourcesForBindings,
  wholeClockBindingPath,
} from '@bajaovrlay/shared';

import { listRequiredFieldKeysOfGraphic } from '../../core/store/graphicSchemaProperties.js';
import { readEntityFieldValuesForRefresh } from './liveEntityFieldsRefresh.js';

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
  /** Its fields that read the entity library (its entry's entityFields, or none). */
  entityFields: InstanceEntityField[];
  /** The entity library now. */
  entities: EntityLibrary;
  /** Whether a team, person, sponsor or slot changed since the last pass. */
  haveEntitiesChanged: boolean;
};

/**
 * The data to send as refreshBoundInstanceData for one instance, or undefined when
 * nothing would change on air. It reads the instance's live bound fields (never its
 * frozen ones, never the item) against the sources, and sends every live value as one
 * set whenever any of them differs from what is on air, so the whole clock always moves
 * as one reading. A field that cannot be read now is kept on air as it is, because nothing
 * on air is ever blanked by a failure (rule 4): a deleted source, a source with no data,
 * or a required field whose value is gone. A live binding whose transform reads the teams
 * (withTeamLogos) is read again when the library changed, even if its source did not. Only an optional field whose value the source
 * no longer has leaves the air (sent as null): showing a gap the car no longer has would
 * be wrong, and the graphic is built to do without it. The fields read from the entity
 * library are read only when it changed (liveEntityFieldsRefresh.ts, same rules) and go
 * in the same set.
 */
export function buildRefreshOfLiveBoundFields(
  request: LiveBoundFieldsRefreshRequest,
): Record<string, unknown> | undefined {
  const { instance, boundFields, graphic, sources, sourceIdsThatChanged } = request;
  const requiredFieldKeys = graphic === undefined ? [] : listRequiredFieldKeysOfGraphic(graphic);
  const clockFieldKeys = graphic === undefined ? undefined : findClockFieldKeysByRole(graphic);
  const valuesToSend: Record<string, unknown> = {};

  // The teams the transforms read (withTeamLogos): the library as it is now.
  const transformContext = { teams: request.entities.teams };

  for (const { fieldKey, binding } of boundFields) {
    const hasItsSourceChanged =
      sourceIdsThatChanged === undefined || sourceIdsThatChanged.has(binding.sourceId);
    // A team edit changes what a binding through withTeamLogos gives (a new logo, a plate)
    // even when its source sent nothing new (BAJAOVRLAY-47).
    const haveItsTeamsChanged = request.haveEntitiesChanged && doesBindingReadTheTeams(binding);
    const isReadNow = binding.isLive && (hasItsSourceChanged || haveItsTeamsChanged);
    if (!isReadNow) {
      continue;
    }
    const resolution = resolveBindingAgainstSources(binding, sources, transformContext);
    if (binding.path === wholeClockBindingPath) {
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

  if (request.haveEntitiesChanged) {
    const entityValues = readEntityFieldValuesForRefresh(
      request.entityFields,
      request.entities,
      requiredFieldKeys,
    );
    Object.assign(valuesToSend, entityValues);
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
