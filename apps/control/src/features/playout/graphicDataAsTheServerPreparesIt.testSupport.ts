// Test support: what the real server does to the data of a take or an update before it
// answers, so the fake server of the panel tests answers as the real one would. The
// steps and their order are the server's (apps/server/src/core/store/reducers/
// takeGraphic.ts and updateInstanceData.ts): refuse a field that may not be stamped, take
// out the fields sent as null, stamp, and for an update run the update rule the graphic's
// manifest names. The control page may not import server code, so the steps are written
// again here; the clock's sum and rounding are the one copy in packages/shared. Left out
// on purpose: the check of the result against the graphic's schema. Nothing keeps state.
import {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  countWholeSecondsClockShows,
  type Graphic,
} from '@bajaovrlay/shared';
import { z } from 'zod';

/** What the fake server does with a command: the data it leaves on air, or its refusal. */
export type GraphicDataOutcomeOnFakeServer =
  | { wasAccepted: true; dataLeftOnAir: Record<string, unknown> }
  | { wasAccepted: false; refusal: { code: 'INVALID_GRAPHIC_DATA'; message: string } };

/** The parts of a take or an update the server prepares data from. */
export type CommandDataSentToFakeServer = {
  data: Record<string, unknown>;
  takeTimeFieldKeys: string[];
  /** The moment the server received the command, as an ISO text. */
  momentOfTheCommand: string;
};

// The one update rule the server has, by the name a manifest gives it, and the four data
// fields it reads and writes (apps/server/src/core/store/updateRules/carryClockForward.ts).
const nameOfTheCarryClockForwardRule = 'carryClockForward';
const referenceTimeKey = 'referenceTimeMs';
const referenceMomentKey = 'referenceWallClockMs';
const runningKey = 'running';
const clockModeKey = 'clockMode';
const clockFieldKeys = [referenceTimeKey, referenceMomentKey, runningKey, clockModeKey];

// A schema property the server may stamp: a whole number marked as a wall-clock moment.
const WallClockMomentPropertySchema = z.looseObject({
  type: z.literal('integer'),
  v_baja: z.looseObject({ role: z.literal('wallClock') }),
});

// The properties of a graphic's data schema, each still unread.
const SchemaPropertiesSchema = z.record(z.string(), z.unknown());

// The data on air read as one reading of a clock.
const ClockReadingOnAirSchema = z.object({
  clockMode: z.enum(['elapsed', 'remaining']),
  referenceTimeMs: z.number(),
  referenceWallClockMs: z.number(),
  running: z.boolean(),
});

/**
 * Says whether the server may write the moment of a command into this field: the
 * graphic's schema must declare it as an integer with `v_baja.role: "wallClock"`. A
 * graphic without a schema has no such field.
 */
function isFieldAWallClockMomentOfGraphic(graphic: Graphic, fieldKey: string): boolean {
  const schemaProperties = SchemaPropertiesSchema.safeParse(graphic.manifest.schema?.properties);
  if (!schemaProperties.success) {
    return false;
  }
  if (!Object.hasOwn(schemaProperties.data, fieldKey)) {
    return false;
  }
  return WallClockMomentPropertySchema.safeParse(schemaProperties.data[fieldKey]).success;
}

/** The refusal for a field the graphic's schema does not mark as a moment, in the server's words. */
function refuseFieldGraphicCannotStamp(
  graphic: Graphic,
  fieldKey: string,
): GraphicDataOutcomeOnFakeServer {
  return {
    wasAccepted: false,
    refusal: {
      code: 'INVALID_GRAPHIC_DATA',
      message: `O gráfico "${graphic.id}" não aceita que o servidor preencha o campo "${fieldKey}" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").`,
    },
  };
}

/** The fields of a command that hold a value, and the keys of those sent as null. */
function separateClearedFieldsFromData(dataOfTheCommand: Record<string, unknown>) {
  const fieldsSent = Object.entries(dataOfTheCommand);
  const keysOfClearedFields = fieldsSent.filter(([, value]) => value === null).map(([key]) => key);
  const fieldsWithAValue = Object.fromEntries(fieldsSent.filter(([, value]) => value !== null));
  return { keysOfClearedFields, fieldsWithAValue };
}

/** Writes the moment of the command, in milliseconds, into every field named for stamping. */
function stampFieldsWithMomentOfTheCommand(
  fieldsWithAValue: Record<string, unknown>,
  commandSent: CommandDataSentToFakeServer,
): Record<string, unknown> {
  const momentInMilliseconds = Date.parse(commandSent.momentOfTheCommand);
  const stampedFields = commandSent.takeTimeFieldKeys.map((key) => [key, momentInMilliseconds]);
  return { ...fieldsWithAValue, ...Object.fromEntries(stampedFields) };
}

/**
 * The server's carryClockForward rule, step for step: when an update stops, starts,
 * turns or corrects a clock without saying which moment the time belongs to, it also
 * writes the time the screen shows at this moment (or the typed time) and this moment as
 * the reference, so the clock does not jump. Every other update goes through as it came.
 */
function carryClockForwardAsTheServerDoes(
  dataOnAir: Record<string, unknown>,
  fieldsSentAndStamped: Record<string, unknown>,
  keysStamped: string[],
  keysCleared: string[],
  nowMs: number,
): Record<string, unknown> {
  // Only a clock field whose value differs from the air counts as sent. The four hold a
  // number, a yes/no or a word, so a plain comparison says whether they differ.
  const keysOfClockFieldsThatDifferFromAir = clockFieldKeys.filter(
    (clockFieldKey) =>
      Object.hasOwn(fieldsSentAndStamped, clockFieldKey) &&
      fieldsSentAndStamped[clockFieldKey] !== dataOnAir[clockFieldKey],
  );

  // A reference moment that was stamped or sent is the sender's own answer.
  const wasReferenceMomentStamped = keysStamped.includes(referenceMomentKey);
  const wasReferenceMomentSent = keysOfClockFieldsThatDifferFromAir.includes(referenceMomentKey);
  if (wasReferenceMomentStamped || wasReferenceMomentSent) {
    return fieldsSentAndStamped;
  }
  // A cleared clock field is a mistake for the schema to refuse, not for the rule to hide.
  const wasAClockFieldCleared = clockFieldKeys.some((key) => keysCleared.includes(key));
  if (wasAClockFieldCleared) {
    return fieldsSentAndStamped;
  }
  // The reference moment is out of the question by now, so any clock field left is the
  // time, the switch or the mode.
  const wasTheClockItselfChanged = keysOfClockFieldsThatDifferFromAir.length > 0;
  if (!wasTheClockItselfChanged) {
    return fieldsSentAndStamped;
  }
  // Data on air that cannot be read as a clock gives no time to carry.
  const readingOnAir = ClockReadingOnAirSchema.safeParse(dataOnAir);
  if (!readingOnAir.success) {
    return fieldsSentAndStamped;
  }

  const clockReadingOnAir: ClockReading = readingOnAir.data;
  const timeOnScreenNowMs = Math.max(0, computeClockTimeMsAtWallClock(clockReadingOnAir, nowMs));
  // A turned clock gets the whole second its old direction was showing, because the two
  // directions round differently and the number on screen must not move at the press.
  const wasClockModeChanged = keysOfClockFieldsThatDifferFromAir.includes(clockModeKey);
  const wholeSecondsOnScreenNow = countWholeSecondsClockShows(
    timeOnScreenNowMs,
    clockReadingOnAir.clockMode,
  );
  const timeToCarryForwardMs = wasClockModeChanged
    ? wholeSecondsOnScreenNow * 1000
    : timeOnScreenNowMs;
  const wasTheTimeTyped = keysOfClockFieldsThatDifferFromAir.includes(referenceTimeKey);
  const referenceTimeToWrite = wasTheTimeTyped
    ? fieldsSentAndStamped[referenceTimeKey]
    : timeToCarryForwardMs;
  return {
    ...fieldsSentAndStamped,
    [referenceTimeKey]: referenceTimeToWrite,
    [referenceMomentKey]: nowMs,
  };
}

/**
 * What the real server leaves on air for a take of this graphic: the data sent, without
 * the fields sent as null, with the moment of the take in every field named for
 * stamping. Refused, as by the real server, when a field named for stamping is not a
 * wall-clock moment in the graphic's schema. A take runs no update rule.
 */
export function prepareDataOfTakeAsTheServerDoes(
  graphic: Graphic,
  takeSent: CommandDataSentToFakeServer,
): GraphicDataOutcomeOnFakeServer {
  const keyThatCannotBeStamped = takeSent.takeTimeFieldKeys.find(
    (fieldKey) => !isFieldAWallClockMomentOfGraphic(graphic, fieldKey),
  );
  if (keyThatCannotBeStamped !== undefined) {
    return refuseFieldGraphicCannotStamp(graphic, keyThatCannotBeStamped);
  }

  const { fieldsWithAValue } = separateClearedFieldsFromData(takeSent.data);
  return {
    wasAccepted: true,
    dataLeftOnAir: stampFieldsWithMomentOfTheCommand(fieldsWithAValue, takeSent),
  };
}

/**
 * What the real server leaves on air for an update of an instance of this graphic: the
 * data on air with the cleared fields taken out and the sent, stamped and rule-written
 * fields laid over it. Refused, as by the real server, when a field named for stamping
 * is not a wall-clock moment in the graphic's schema.
 */
export function prepareDataOfUpdateAsTheServerDoes(
  graphic: Graphic,
  dataOnAir: Record<string, unknown>,
  updateSent: CommandDataSentToFakeServer,
): GraphicDataOutcomeOnFakeServer {
  const keyThatCannotBeStamped = updateSent.takeTimeFieldKeys.find(
    (fieldKey) => !isFieldAWallClockMomentOfGraphic(graphic, fieldKey),
  );
  if (keyThatCannotBeStamped !== undefined) {
    return refuseFieldGraphicCannotStamp(graphic, keyThatCannotBeStamped);
  }

  const { keysOfClearedFields, fieldsWithAValue } = separateClearedFieldsFromData(updateSent.data);
  const fieldsSentAndStamped = stampFieldsWithMomentOfTheCommand(fieldsWithAValue, updateSent);

  // The real server refuses every update of a graphic naming a rule it does not know. No
  // fixture here names one, so the fake stops the test instead of copying that refusal.
  const nameOfTheUpdateRule = graphic.manifest.v_baja?.updateRule;
  const hasAnUpdateRule = nameOfTheUpdateRule !== undefined;
  if (hasAnUpdateRule && nameOfTheUpdateRule !== nameOfTheCarryClockForwardRule) {
    throw new Error(`the fake server does not know the update rule "${nameOfTheUpdateRule}"`);
  }
  const fieldsToWrite = hasAnUpdateRule
    ? carryClockForwardAsTheServerDoes(
        dataOnAir,
        fieldsSentAndStamped,
        updateSent.takeTimeFieldKeys,
        keysOfClearedFields,
        Date.parse(updateSent.momentOfTheCommand),
      )
    : fieldsSentAndStamped;

  const fieldsKeptFromAir = Object.entries(dataOnAir).filter(
    ([fieldKey]) => !keysOfClearedFields.includes(fieldKey),
  );
  return {
    wasAccepted: true,
    dataLeftOnAir: { ...Object.fromEntries(fieldsKeptFromAir), ...fieldsToWrite },
  };
}
