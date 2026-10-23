import { z } from 'zod';

import {
  writeLapTimeAsText as writeLapTimeMsAsText,
  writeSecondsToTheTenthCutAsText,
} from '../raceTimeText/index.js';
import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  type BindingTransform,
  giveTransformedValue,
  refuseTransformValue,
  type TransformResult,
} from './transform.js';

/** Whether a value is a whole number from 0 up, as every duration of the shapes is. */
function isWholeNumberFromZero(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Writes a lap time in ms as the timing screen does ("4:38,2" for 278 299 ms; see
 * raceTimeText/raceTimeText.ts for the cut rule), refusing anything but whole ms from 0 up.
 */
function writeLapTimeAsText(value: unknown): TransformResult {
  if (!isWholeNumberFromZero(value)) {
    return refuseTransformValue(
      ptBRTransforms.reasons.notADurationInMs(quoteValueForReason(value)),
    );
  }
  return giveTransformedValue(writeLapTimeMsAsText(value));
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
  return giveTransformedValue(onAirTexts.gapInSeconds(writeSecondsToTheTenthCutAsText(value)));
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
