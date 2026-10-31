import { lapTimeTextToMsTransform, secondsToMsTransform } from './durationTransforms.js';
import { mapValuesTransform } from './mapValuesTransform.js';
import { isoDateTextToMsTransform, unixSecondsToMsTransform } from './momentTransforms.js';
import {
  numberToTextTransform,
  textToIntegerTransform,
  textToNumberTransform,
} from './numberTransforms.js';
import {
  formatGapAsTextTransform,
  formatLapTimeAsTextTransform,
} from './raceTimeTextTransforms.js';
import { shortenSchoolNameTransform } from './schoolNameTransforms.js';
import { trimTextTransform } from './textTransforms.js';
import { topNTransform } from './topNTransform.js';
import type { Transform, TransformFamily } from './transform.js';
import { withTeamLogosTransform } from './withTeamLogosTransform.js';

/**
 * Every transform there is, in the order the control page's dropdowns show them. What a
 * mapping or a binding can do to a value is exactly this list (architecture rule 5), so a
 * reviewer reads every possible behaviour here. The first nine are mapping transforms
 * (outside data into the canonical shapes), the last five binding transforms (canonical
 * data shaped for a graphic, BAJAOVRLAY-20, and withTeamLogos, BAJAOVRLAY-47); each form
 * offers its own family only.
 */
export const transformRegistry: readonly Transform[] = [
  textToNumberTransform,
  textToIntegerTransform,
  numberToTextTransform,
  secondsToMsTransform,
  lapTimeTextToMsTransform,
  isoDateTextToMsTransform,
  unixSecondsToMsTransform,
  trimTextTransform,
  mapValuesTransform,
  topNTransform,
  formatLapTimeAsTextTransform,
  formatGapAsTextTransform,
  shortenSchoolNameTransform,
  withTeamLogosTransform,
];

/** The transforms of one family, in registry order: what one form's dropdown offers. */
export function listTransformsOfFamily(family: TransformFamily): Transform[] {
  return transformRegistry.filter((transform) => transform.family === family);
}

/** Finds the transform with this id, or undefined when the registry has none. */
export function findTransform(transformId: string): Transform | undefined {
  return transformRegistry.find((transform) => transform.id === transformId);
}
