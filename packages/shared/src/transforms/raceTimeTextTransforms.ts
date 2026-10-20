import { z } from 'zod';

import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  type BindingTransform,
  giveTransformedValue,
  refuseTransformValue,
  type TransformResult,
} from './transform.js';

const millisecondsPerTenthOfASecond = 100;
const tenthsPerSecond = 10;
const secondsPerMinute = 60;
const minutesPerHour = 60;

/**
 * Writes whole ms as seconds to the tenth with a decimal comma, cutting the rest: 12 399
 * ms reads "12,3", never "12,4". Baja's timing records line passes with limited accuracy,
 * so the ms are false precision, and timing screens cut rather than round (the gap rule
 * of PR #17, the same as the Fontes page's). Whole-number steps instead of toFixed or
 * toLocaleString, whose rounding would turn 12 399 into "12,4".
 */
function writeSecondsToTheTenthCut(durationMs: number): { wholeSeconds: number; tenth: number } {
  const wholeTenths = Math.floor(durationMs / millisecondsPerTenthOfASecond);
  return {
    wholeSeconds: Math.floor(wholeTenths / tenthsPerSecond),
    tenth: wholeTenths % tenthsPerSecond,
  };
}

/** Whether a value is a whole number from 0 up, as every duration of the shapes is. */
function isWholeNumberFromZero(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Writes a lap time in ms as the timing screen does: minutes, seconds and the tenth,
 * cut ("4:38,2" for 278 299 ms), with the hour in front past an hour ("1:02:03,4"). A lap
 * under a minute keeps its 0 minutes ("0:59,9"), so the text never reads as hours.
 */
function writeLapTimeAsText(value: unknown): TransformResult {
  if (!isWholeNumberFromZero(value)) {
    return refuseTransformValue(
      ptBRTransforms.reasons.notADurationInMs(quoteValueForReason(value)),
    );
  }
  const { wholeSeconds, tenth } = writeSecondsToTheTenthCut(value);
  const seconds = wholeSeconds % secondsPerMinute;
  const totalMinutes = Math.floor(wholeSeconds / secondsPerMinute);
  const minutes = totalMinutes % minutesPerHour;
  const hours = Math.floor(totalMinutes / minutesPerHour);
  const twoDigitSeconds = String(seconds).padStart(2, '0');
  if (hours === 0) {
    return giveTransformedValue(`${minutes}:${twoDigitSeconds},${tenth}`);
  }
  const twoDigitMinutes = String(minutes).padStart(2, '0');
  return giveTransformedValue(`${hours}:${twoDigitMinutes}:${twoDigitSeconds},${tenth}`);
}

/**
 * The parameters of formatGapAsText: whether the number it reads is ms (gapToLeaderMs,
 * intervalMs) or laps (gapToLeaderLaps). The binding's path already says which, but a
 * path is not a transform's input, so the operator states it once, beside the path.
 */
export const GapUnitParametersSchema = z.object(
  {
    unit: z.enum(['ms', 'laps'], { error: ptBRTransforms.parameterReasons.gapUnitUnknown }),
  },
  { error: ptBRTransforms.parameterReasons.gapUnitUnknown },
);

/**
 * Writes a gap to the leader as the timing screen does: "+12,3 s" in seconds to the tenth,
 * cut, past a minute too ("+75,3 s"), or "+1 volta" / "+2 voltas" in laps.
 */
function writeGapAsText(value: unknown, parameters: unknown): TransformResult {
  if (!isWholeNumberFromZero(value)) {
    return refuseTransformValue(
      ptBRTransforms.reasons.notAWholeNumberFromZero(quoteValueForReason(value)),
    );
  }
  // The item save already checked the unit; this is the last guard, apply never throws.
  const parsedParameters = GapUnitParametersSchema.safeParse(parameters);
  if (!parsedParameters.success) {
    return refuseTransformValue(ptBRTransforms.parameterReasons.gapUnitUnknown);
  }
  const onAirTexts = ptBRTransforms.onAirTexts;
  if (parsedParameters.data.unit === 'laps') {
    return giveTransformedValue(onAirTexts.gapInLaps(value));
  }
  const { wholeSeconds, tenth } = writeSecondsToTheTenthCut(value);
  return giveTransformedValue(onAirTexts.gapInSeconds(`${wholeSeconds},${tenth}`));
}

/** 278 299 ms becomes "4:38,2". */
export const formatLapTimeAsTextTransform: BindingTransform = {
  id: 'formatLapTimeAsText',
  family: 'binding',
  label: ptBRTransforms.transforms.formatLapTimeAsText.label,
  description: ptBRTransforms.transforms.formatLapTimeAsText.description,
  valueTypesRead: ['integer'],
  valueTypeGiven: 'text',
  apply: (value) => writeLapTimeAsText(value),
};

/** 12 399 ms becomes "+12,3 s"; 2 laps becomes "+2 voltas". */
export const formatGapAsTextTransform: BindingTransform = {
  id: 'formatGapAsText',
  family: 'binding',
  label: ptBRTransforms.transforms.formatGapAsText.label,
  description: ptBRTransforms.transforms.formatGapAsText.description,
  parametersSchema: GapUnitParametersSchema,
  valueTypesRead: ['integer'],
  valueTypeGiven: 'text',
  apply: (value, parameters) => writeGapAsText(value, parameters),
};
