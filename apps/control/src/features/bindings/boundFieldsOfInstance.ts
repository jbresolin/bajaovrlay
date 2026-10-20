/**
 * What the page says about the bound fields of one instance on air or in preview: where
 * each reads ("Vinculado: Simulador — Enduro › Sessão › Bandeira (ao vivo)"), which
 * graphic fields it fills (four for the whole clock), whether a correction changed its
 * value now, and which correction it can take. Read from the instance's entry of
 * `instanceBindings`, never from its item, as the server's refreshes are.
 */
import {
  type BindingFieldValue,
  type DataSnapshot,
  type DataSource,
  findBindablePath,
  findClockFieldKeysByRole,
  findOverrideKeyOfBinding,
  type Graphic,
  type InstanceBindings,
  type Override,
  type OverrideKey,
  resolveBindingAgainstSources,
  wholeClockBindingPath,
} from '@bajaovrlay/shared';

import { findOverrideInForce } from '@/features/overrides/overrideInForce';
import { ptBR } from '@/i18n/ptBR';

/** One bound field of an instance, described for the page. */
export type BoundFieldOfInstance = {
  /** The graphic fields it fills: one, or the four clock fields for the whole clock. */
  fieldKeys: string[];
  binding: BindingFieldValue;
  /** The source's name, or undefined when the source was deleted. */
  sourceLabel: string | undefined;
  /** "Vinculado: Simulador — Enduro › Sessão › Bandeira (ao vivo)". */
  whereItReadsText: string;
  /** Whether a correction changed the value it reads now. */
  isOverridden: boolean;
  /** The correction it can take ("Corrigir valor da fonte…"), or undefined. */
  overrideKey: OverrideKey | undefined;
  /** The correction in force for that key, if any. */
  overrideInForce: Override | undefined;
};

/** The slices the descriptions read. */
export type SlicesForBoundFields = {
  instanceBindings: InstanceBindings;
  dataSources: DataSource[];
  dataSnapshots: DataSnapshot[];
  overrides: Override[];
};

const texts = ptBR.bindings.onAir;

/** Describes every bound field of the instance, in the order its entry lists them. */
export function describeBoundFieldsOfInstance(
  instanceId: string,
  graphic: Graphic | undefined,
  slices: SlicesForBoundFields,
): BoundFieldOfInstance[] {
  const entry = slices.instanceBindings.find((candidate) => candidate.instanceId === instanceId);
  if (entry === undefined) {
    return [];
  }
  const clockFieldKeys = graphic === undefined ? undefined : findClockFieldKeysByRole(graphic);
  return entry.boundFields.map(({ fieldKey, binding }) => {
    const isWholeClock = binding.path === wholeClockBindingPath && clockFieldKeys !== undefined;
    const fieldKeys = isWholeClock
      ? [
          clockFieldKeys.clockTime,
          clockFieldKeys.wallClock,
          clockFieldKeys.clockRunning,
          clockFieldKeys.clockMode,
        ]
      : [fieldKey];
    const sourceLabel = slices.dataSources.find((source) => source.id === binding.sourceId)?.label;
    const snapshot = slices.dataSnapshots.find(
      (candidate) => candidate.sourceId === binding.sourceId,
    );
    const resolution = resolveBindingAgainstSources(binding, slices);
    const overrideKey = findOverrideKeyOfBinding(binding, snapshot?.shapes);
    const overrideInForce =
      overrideKey === undefined ? undefined : findOverrideInForce(slices.overrides, overrideKey);
    return {
      fieldKeys,
      binding,
      sourceLabel,
      whereItReadsText: describeWhereABindingReads(binding, sourceLabel),
      isOverridden: resolution.status === 'resolved' && resolution.isOverridden,
      overrideKey,
      overrideInForce,
    };
  });
}

/**
 * "Vinculado: Simulador — Enduro › Sessão › Bandeira (ao vivo)": the source (or "fonte
 * excluída"), the path's label (with the car, for a car chosen by number) and live or
 * frozen.
 */
export function describeWhereABindingReads(
  binding: BindingFieldValue,
  sourceLabel: string | undefined,
): string {
  const pathLabel = findBindablePath(binding.shapeKey, binding.path)?.label ?? binding.path;
  const pathLabelWithCar =
    binding.carNumber === undefined ? pathLabel : texts.pathOfCar(pathLabel, binding.carNumber);
  return texts.whereItReads(
    sourceLabel ?? texts.deletedSourceName,
    pathLabelWithCar,
    binding.isLive,
  );
}
