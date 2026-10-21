/**
 * What a Camadas row says about the sources of its instance's live bindings: the worst
 * state among them ("fonte excluída", then "fonte com erro", then "fonte atrasada", by the
 * "Fontes" page's health rule, then "fonte desligada"), whether a correction changed a
 * bound value now, and which fields the server's last refresh could not put on air.
 */
import type { Graphic } from '@bajaovrlay/shared';

import { findHealthOfDataSource } from '@/features/dataSources/dataSourceHealth';

import { describeBoundFieldsOfInstance, type SlicesForBoundFields } from './boundFieldsOfInstance';

/** The state the row's source chip shows; undefined for "all sources well". */
export type SourceStateOfInstance = 'deleted' | 'failing' | 'late' | 'off' | undefined;

/** What the row shows about its sources. */
export type SourcesOfInstanceSummary = {
  sourceState: SourceStateOfInstance;
  isAnyBoundValueCorrected: boolean;
  /** The keys whose last refresh the graphic refused (the entry's refusedFieldKeys). */
  refusedFieldKeys: string[];
};

/**
 * Sums up the sources of the instance's live bindings at `nowMs`, a moment on the
 * server's clock (the health rule counts the minute of failing on it). A source turned
 * off is not "late": it is off, and the row says "fonte desligada" (gate 2 of PR #18):
 * nothing refreshes the instance any more, though its last data stays on air.
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
  let isAnySourceOff = false;
  for (const sourceId of sourceIds) {
    const dataSource = slices.dataSources.find((candidate) => candidate.id === sourceId);
    if (dataSource === undefined) {
      isAnySourceDeleted = true;
      continue;
    }
    const health = findHealthOfDataSource(dataSource, nowMs);
    isAnySourceFailing ||= health === 'error';
    isAnySourceLate ||= health === 'stale';
    isAnySourceOff ||= health === 'off';
  }
  const entry = slices.instanceBindings.find((candidate) => candidate.instanceId === instanceId);
  return {
    sourceState: isAnySourceDeleted
      ? 'deleted'
      : isAnySourceFailing
        ? 'failing'
        : isAnySourceLate
          ? 'late'
          : isAnySourceOff
            ? 'off'
            : undefined,
    isAnyBoundValueCorrected: liveBoundFields.some((boundField) => boundField.isOverridden),
    refusedFieldKeys: entry?.refusedFieldKeys ?? [],
  };
}
