import { lapTimeTextToMsTransform, secondsToMsTransform } from './durationTransforms.js';
import { mapValuesTransform } from './mapValuesTransform.js';
import { isoDateTextToMsTransform, unixSecondsToMsTransform } from './momentTransforms.js';
import { textToIntegerTransform, textToNumberTransform } from './numberTransforms.js';
import { trimTextTransform } from './textTransforms.js';
import type { Transform } from './transform.js';

/**
 * Every transform there is, in the order the control page's dropdown shows them. What a
 * mapping can do to a value is exactly this list (architecture rule 5), so a reviewer
 * reads every possible behaviour here. These all bring outside data into the canonical
 * shapes; the presentation ones (topN, formatLapTime…) join this list with BAJAOVRLAY-20.
 */
export const transformRegistry: readonly Transform[] = [
  textToNumberTransform,
  textToIntegerTransform,
  secondsToMsTransform,
  lapTimeTextToMsTransform,
  isoDateTextToMsTransform,
  unixSecondsToMsTransform,
  trimTextTransform,
  mapValuesTransform,
];

/** Finds the transform with this id, or undefined when the registry has none. */
export function findTransform(transformId: string): Transform | undefined {
  return transformRegistry.find((transform) => transform.id === transformId);
}
