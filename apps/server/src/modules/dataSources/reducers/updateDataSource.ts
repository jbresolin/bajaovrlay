import {
  areJsonValuesEqual,
  type DataSource,
  type UpdateDataSourceCommand,
} from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { computeStaleAfterMs } from '../dataSourceHealth.js';
import { findDataSource, replaceDataSource } from '../dataSourceListing.js';
import {
  findRefusalOfThePollIntervalOfTheKind,
  refuseUnknownDataSource,
} from '../dataSourceRefusals.js';
import { carryTheTimelineStartIntoTheEdit } from '../dataSourceTimeline.js';
import { checkDataSourceConfig } from '../schema.js';

/**
 * updateDataSource ("Editar"): changes only what the command carries. A new poll
 * interval moves the stale limit with it; a new config replaces the whole config,
 * completed by the schema of the source's kind; the timeline start stays the stored one,
 * except that a replay switched to another recording, offset or speed starts again from
 * the top (see carryTheTimelineStartIntoTheEdit). Hands back the same slices when nothing changes (the
 * edit form saved untouched). Refused for an unknown source and for a config that fails
 * its schema or the host list, like createDataSource. An edit without a config (a rename)
 * is not checked against the host list. A YouTube live chat's interval may not go under
 * 10 s, as at createDataSource.
 */
export function reduceUpdateDataSource(
  slices: SlicesChangedByCommands,
  command: UpdateDataSourceCommand,
  context: ReducerContext,
): ReducerOutcome {
  const storedSource = findDataSource(slices.dataSources, command.sourceId);
  if (storedSource === undefined) {
    return { status: 'refused', error: refuseUnknownDataSource(command.sourceId) };
  }

  let updatedSource: DataSource = storedSource;
  if (command.label !== undefined) {
    updatedSource = { ...updatedSource, label: command.label };
  }
  if (command.pollIntervalMs !== undefined) {
    const intervalRefusal = findRefusalOfThePollIntervalOfTheKind(
      storedSource.kind,
      command.pollIntervalMs,
    );
    if (intervalRefusal !== undefined) {
      return { status: 'refused', error: intervalRefusal };
    }
    const staleAfterMs = computeStaleAfterMs(command.pollIntervalMs);
    updatedSource = {
      ...updatedSource,
      pollIntervalMs: command.pollIntervalMs,
      status: { ...updatedSource.status, staleAfterMs },
    };
  }
  if (command.config !== undefined) {
    const configCheck = checkDataSourceConfig(
      storedSource.kind,
      command.config,
      slices.recordings,
      context.sourceHostAllowlist,
    );
    if (!configCheck.isValid) {
      return { status: 'refused', error: configCheck.error };
    }
    const nowMs = Date.parse(context.now);
    const kindAndConfig = carryTheTimelineStartIntoTheEdit(
      storedSource,
      configCheck.kindAndConfig,
      nowMs,
    );
    updatedSource = { ...updatedSource, ...kindAndConfig };
  }

  const isNothingChanged = areJsonValuesEqual(updatedSource, storedSource);
  if (isNothingChanged) {
    return { status: 'applied', slices };
  }
  const dataSources = replaceDataSource(slices.dataSources, updatedSource);
  return { status: 'applied', slices: { ...slices, dataSources } };
}
