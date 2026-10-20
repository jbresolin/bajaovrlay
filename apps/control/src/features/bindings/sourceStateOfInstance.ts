/**
 * What a Camadas row says about the sources of its instance's live bindings: the worst
 * state among them ("fonte excluída", then "fonte com erro", then "fonte atrasada", by the
 * "Fontes" page's health rule) and whether a correction changed a bound value now.
 */
import type { Graphic } from '@bajaovrlay/shared';

import { findHealthOfDataSource } from '@/features/dataSources/dataSourceHealth';

import { describeBoundFieldsOfInstance, type SlicesForBoundFields } from './boundFieldsOfInstance';

/** The state the row's source chip shows; undefined for "all sources well". */
export type SourceStateOfInstance = 'deleted' | 'failing' | 'late' | undefined;

/** What the row shows about its sources. */
export type SourcesOfInstanceSummary = {
  sourceState: SourceStateOfInstance;
  isAnyBoundValueCorrected: boolean;
};

/**
 * Sums up the sources of the instance's live bindings at `nowMs`, a moment on the
 * server's clock (the health rule counts the minute of failing on it). A source turned
 * off is not "late": it is off, and the row says nothing about it, as the health rule does.
 */
export function summarizeSourcesOfInstance(
  instanceId: string,
  graphic: Graphic | undefined,
  slices: SlicesForBoundFields,
  nowMs: number,
): SourcesOfInstanceSummary {
  const liveBoundFields = describeBoundFieldsOfInstance(instanceId, graphic, slices).filter(
    (boundField) => boundField.binding.isLive,
  );
  const sourceIds = new Set(liveBoundFields.map((boundField) => boundField.binding.sourceId));
  let isAnySourceDeleted = false;
  let isAnySourceFailing = false;
  let isAnySourceLate = false;
  for (const sourceId of sourceIds) {
    const dataSource = slices.dataSources.find((candidate) => candidate.id === sourceId);
    if (dataSource === undefined) {
      isAnySourceDeleted = true;
      continue;
    }
    const health = findHealthOfDataSource(dataSource, nowMs);
    isAnySourceFailing ||= health === 'error';
    isAnySourceLate ||= health === 'stale';
  }
  return {
    sourceState: isAnySourceDeleted
      ? 'deleted'
      : isAnySourceFailing
        ? 'failing'
        : isAnySourceLate
          ? 'late'
          : undefined,
    isAnyBoundValueCorrected: liveBoundFields.some((boundField) => boundField.isOverridden),
  };
}
