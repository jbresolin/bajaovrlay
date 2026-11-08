import { findClockFieldKeysByRole, type Graphic, type Instance } from '@bajaovrlay/shared';

/** What is read here: the graphics, and the instances on program and preview. */
type GraphicsAndInstances = { graphics: readonly Graphic[]; instances: readonly Instance[] };

/**
 * Answers whether anything on an output (program or preview) counts time, so a step of
 * the server clock would make it jump on screen:
 * - a running clock: a graphic that marks the four clock roles, its clockRunning true;
 * - a count to a moment still ahead: a field of the graphic marked with the unit epochMs
 *   (the countdown's start, the intermission board's next session) whose moment is after
 *   `nowMs`. Past it, the count shows 0:00 and stops, and a step moves nothing on it.
 * Found by what the manifest marks, never by a graphic's name, so a new graphic of either
 * kind counts with no change here. Preview counts too: the operator watches its monitor.
 */
export function isAnythingCountingTimeOnAnOutput(
  slices: GraphicsAndInstances,
  nowMs: number,
): boolean {
  return slices.instances.some((instance) => {
    const graphic = slices.graphics.find((candidate) => candidate.id === instance.graphicId);
    if (graphic === undefined) {
      return false;
    }
    return isAClockRunning(graphic, instance) || isCountingToAMomentAhead(graphic, instance, nowMs);
  });
}

/** Whether the instance is a clock (by the four roles) whose clockRunning field is true. */
function isAClockRunning(graphic: Graphic, instance: Instance): boolean {
  const clockFieldKeys = findClockFieldKeysByRole(graphic);
  if (clockFieldKeys === undefined) {
    return false;
  }
  return instance.resolvedData[clockFieldKeys.clockRunning] === true;
}

/** Whether a field marked with the unit epochMs holds a moment after `nowMs`. */
function isCountingToAMomentAhead(graphic: Graphic, instance: Instance, nowMs: number): boolean {
  const momentFieldKeys = listFieldKeysMarkedAsMoments(graphic);
  return momentFieldKeys.some((fieldKey) => {
    const moment = instance.resolvedData[fieldKey];
    return typeof moment === 'number' && moment > nowMs;
  });
}

/** The top-level fields of the graphic's data schema whose `v_baja.unit` is epochMs. */
function listFieldKeysMarkedAsMoments(graphic: Graphic): string[] {
  const dataSchema: unknown = graphic.manifest.schema;
  const schemaProperties = isPlainObject(dataSchema) ? dataSchema.properties : undefined;
  if (!isPlainObject(schemaProperties)) {
    return [];
  }
  return Object.keys(schemaProperties).filter((fieldKey) => {
    const schemaProperty = schemaProperties[fieldKey];
    const vendorHints = isPlainObject(schemaProperty) ? schemaProperty.v_baja : undefined;
    return isPlainObject(vendorHints) && vendorHints.unit === 'epochMs';
  });
}

/** Whether a value is an object of keys, not an array or null. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
