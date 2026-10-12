/**
 * A text a panel has one field of a generated form show in place of the value the form
 * holds, for as long as the operator has not touched that field. The form's value is not
 * changed by it: the field still counts as untouched, and a command built from the form
 * carries the value the form holds, never this text.
 *
 * The one rule here answers what the field's control shows. It is written so the text
 * never changes under the operator's cursor.
 */

/** The text a panel hands SchemaFormFields for one field. */
export type TextShownInUntouchedField = {
  /** The key of the field that shows the text. Only a text or mm:ss field can show one. */
  fieldKey: string;
  /** The text to show now. The panel may hand over a new one on every draw. */
  text: string;
  /**
   * Called with true when the cursor enters the field's control and with false when it
   * leaves, so the panel can stop working out new texts nobody will be shown.
   */
  onCursorEnteredOrLeftTheField: (isCursorInTheField: boolean) => void;
};

/** What a row remembers from the moment the cursor entered its control until it leaves. */
export type CursorVisitToField = {
  /** The text the control was showing in place of its value at that moment, if any. */
  textShownWhenTheCursorEntered: string | undefined;
  /** Whether the operator has typed in the control since. */
  hasOperatorTyped: boolean;
};

/** What a row knows when it chooses what its control shows. */
export type FieldStateForTextShown = {
  /** The panel's text of this draw; undefined when the panel has none for this field. */
  textFromThePanel: string | undefined;
  /** react-hook-form's "dirty": the value differs from the one the form was filled with. */
  hasOperatorChangedTheValue: boolean;
  /** Undefined while the cursor is somewhere else. */
  cursorVisit: CursorVisitToField | undefined;
};

/**
 * Answers the text a control shows in place of the value the form holds, or undefined
 * for "show the form's value".
 * - A value the operator changed is always shown as the form holds it.
 * - While the cursor is in the control the text stands still: the text of the moment the
 *   cursor entered, until the first keystroke; from then on what the form holds.
 * - Otherwise the panel's text of this draw.
 * What could go wrong: after the operator types exactly the value the form was filled
 * with and leaves the field, the field counts as untouched again and goes back to the
 * panel's text. That is honest (nothing would be sent), but it can surprise.
 */
export function chooseTextShownInPlaceOfFieldValue(
  fieldState: FieldStateForTextShown,
): string | undefined {
  if (fieldState.hasOperatorChangedTheValue) {
    return undefined;
  }
  const cursorVisit = fieldState.cursorVisit;
  if (cursorVisit !== undefined) {
    return cursorVisit.hasOperatorTyped ? undefined : cursorVisit.textShownWhenTheCursorEntered;
  }
  return fieldState.textFromThePanel;
}
