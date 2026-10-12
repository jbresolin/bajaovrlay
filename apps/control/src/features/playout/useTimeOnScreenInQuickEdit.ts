import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { useEffect, useState } from 'react';

import type { SchemaFormDirtyFields, TextShownInUntouchedField } from '@/features/schemaForm';

import {
  type ClockFieldKeysOfGraphic,
  hasOperatorChangedTheClockReading,
} from './clockFieldsOfGraphic';
import { readClockReadingOnAir, writeTimeOnScreenOfClock } from './timeOnScreenOfClockOnAir';

// The screen shows whole seconds, so drawing again once a second is enough.
const millisecondsBetweenDraws = 1000;

/** What the hook needs to know on every draw of the form. */
export type TimeOnScreenInQuickEditOptions = {
  /** The clock's fields in the graphic of the form; undefined when it is not a clock. */
  clockFieldKeys: ClockFieldKeysOfGraphic | undefined;
  /** The data of the instance the form follows; undefined while the graphic is off air. */
  dataOnAir: Record<string, unknown> | undefined;
  /** react-hook-form's `formState.dirtyFields` of the form. */
  fieldsTheOperatorChanged: SchemaFormDirtyFields;
  /**
   * Where "now" comes from, in milliseconds since 1970; the one place this feature reads
   * a clock. Must be the same function on every draw. Default: the shared server-aligned
   * "now" (packages/shared/src/clock/serverAlignedTime.ts), because the reading on air
   * carries a moment of the server's clock.
   * What could go wrong: until the page's connection has recorded a sample of the
   * server's clock (state/serverConnection.ts does, from every hello and slice message)
   * that "now" is this machine's own clock, and the text is off by whatever the two
   * machines' clocks disagree.
   */
  readNowMs?: () => number;
};

/**
 * Gives "Edição rápida" the text for the time field of a clock on air: the time the
 * screen shows right now, kept up to date once a second while the clock runs. The answer
 * goes straight to SchemaFormFields (`textShownInUntouchedField`), which shows it in
 * place of the reference time the form holds without changing what the form holds.
 *
 * Undefined, so the field shows what the form holds, when the graphic is not a clock
 * the page can follow, when it is off air, when the data on air cannot be read as a
 * clock, and when the operator changed the reading (the time, or the moment it belongs
 * to): from then on the two fields show the pair the operator is editing.
 *
 * The time is worked out afresh on every draw, from the clock read at that draw. The
 * timer only makes React draw again; it runs while the text can change and somebody can
 * see it change: the clock runs, and the cursor is not in the time field (there the row
 * holds the text still anyway, so the operator never types into a moving text).
 * What could go wrong: draws are a second apart and not in step with the graphic's
 * frames, so the text can trail the screen by up to a second.
 */
export function useTimeOnScreenInQuickEdit(
  options: TimeOnScreenInQuickEditOptions,
): TextShownInUntouchedField | undefined {
  const { clockFieldKeys, dataOnAir, fieldsTheOperatorChanged } = options;
  const readNowMs = options.readNowMs ?? readServerAlignedTimeMs;
  const [isCursorInTheTimeField, setIsCursorInTheTimeField] = useState(false);
  // Its value is never read: setting it to a new moment is what makes React draw again.
  const [, setMomentOfTheLastDrawAskedFor] = useState(0);

  const clockReadingOnAir =
    clockFieldKeys === undefined || dataOnAir === undefined
      ? undefined
      : readClockReadingOnAir(clockFieldKeys, dataOnAir);
  const hasOperatorChangedTheReading =
    clockFieldKeys !== undefined &&
    hasOperatorChangedTheClockReading(clockFieldKeys, fieldsTheOperatorChanged);
  const isTimeOnScreenShown = clockReadingOnAir !== undefined && !hasOperatorChangedTheReading;
  // The row tells this hook that the cursor left only through the answer handed back
  // below, and no answer is handed back while there is no text to show. So a cursor that
  // leaves the field after the operator typed (or after the clock left the air) is never
  // reported, and the text, once it is shown again, would stand still for good. With no
  // text to show the cursor is therefore counted as out. React allows a component to
  // correct its own state while it draws, and draws again at once with the new value.
  if (!isTimeOnScreenShown && isCursorInTheTimeField) {
    setIsCursorInTheTimeField(false);
  }
  const isClockRunning = clockReadingOnAir?.running === true;
  const mustTheTextBeKeptUpToDate =
    isTimeOnScreenShown && isClockRunning && !isCursorInTheTimeField;

  useEffect(() => {
    if (!mustTheTextBeKeptUpToDate) {
      return;
    }
    const drawAgainTimer = setInterval(() => {
      setMomentOfTheLastDrawAskedFor(readNowMs());
    }, millisecondsBetweenDraws);
    return () => {
      clearInterval(drawAgainTimer);
    };
  }, [mustTheTextBeKeptUpToDate, readNowMs]);

  if (clockFieldKeys === undefined || clockReadingOnAir === undefined || !isTimeOnScreenShown) {
    return undefined;
  }
  return {
    fieldKey: clockFieldKeys.timeFieldKey,
    text: writeTimeOnScreenOfClock(clockReadingOnAir, readNowMs()),
    onCursorEnteredOrLeftTheField: setIsCursorInTheTimeField,
  };
}
