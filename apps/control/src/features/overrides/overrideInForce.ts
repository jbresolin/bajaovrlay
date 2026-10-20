import type { Override, OverrideKey } from '@bajaovrlay/shared';

/** The correction in force for this key (same source, scope, field and car), if any. */
export function findOverrideInForce(
  overrides: Override[],
  overrideKey: OverrideKey,
): Override | undefined {
  return overrides.find(
    (override) =>
      override.sourceId === overrideKey.sourceId &&
      override.scope === overrideKey.scope &&
      override.field === overrideKey.field &&
      (override.scope === 'session' || override.carNumber === overrideKey.carNumber),
  );
}
