/**
 * A text shown in an untouched field in place of its value (apps/control)
 *
 * What this module is for:
 *   A panel may have one field of a generated form show a text of the panel's own while
 *   the operator has not touched that field. "Edição rápida" uses it to show the time a
 *   clock on air shows right now where the form holds the time the clock was started
 *   from. chooseTextShownInPlaceOfFieldValue is the rule the field's row follows: given
 *   what the row knows, it answers the text to show, or "show the value the form holds".
 *   The rule exists for one promise: the text never changes under the operator's cursor.
 *
 * What these tests prove:
 *   - An untouched field the cursor is not in shows the panel's text, whatever it is now.
 *   - A field the operator changed shows what the form holds, cursor or no cursor.
 *   - While the cursor is in the field and nothing was typed, the field keeps the text it
 *     showed when the cursor entered, although the panel's text has moved on or is gone.
 *   - Once the operator typed, the field shows what the form holds until the cursor
 *     leaves, even if what was typed is the very value the form was filled with.
 *   - Without a text from the panel the field shows what the form holds.
 *
 * What these tests deliberately do not cover:
 *   - The row that keeps track of the cursor and of typing, and the control that shows
 *     the text: SchemaFormFieldsTextInUntouchedField.test.tsx.
 *   - Where the panel's text comes from: features/playout has its own tests.
 */
import { describe, expect, it } from 'vitest';

import { chooseTextShownInPlaceOfFieldValue } from './textShownInUntouchedField';

describe('chooseTextShownInPlaceOfFieldValue', () => {
  const momentsOfAFieldThatShowsTheTimeOnScreen = [
    // The everyday case: nobody touched the field, so it follows the panel's text.
    {
      name: 'shows the panel’s text in an untouched field the cursor is not in',
      whatTheRowKnows: {
        textFromThePanel: '27:34',
        hasOperatorChangedTheValue: false,
        cursorVisit: undefined,
      },
      expectedText: '27:34',
    },
    // A typed correction is what the operator must see and what "Atualizar" sends.
    {
      name: 'shows what the form holds once the operator changed the value',
      whatTheRowKnows: {
        textFromThePanel: '27:34',
        hasOperatorChangedTheValue: true,
        cursorVisit: undefined,
      },
      expectedText: undefined,
    },
    // The promise: the operator clicked into 27:34, and a second later it is still 27:34.
    {
      name: 'keeps the text of the moment the cursor entered while nothing was typed',
      whatTheRowKnows: {
        textFromThePanel: '27:35',
        hasOperatorChangedTheValue: false,
        cursorVisit: { textShownWhenTheCursorEntered: '27:34', hasOperatorTyped: false },
      },
      expectedText: '27:34',
    },
    // The graphic left the air while the cursor was in the field: still nothing moves.
    {
      name: 'keeps that text even when the panel has no text any more',
      whatTheRowKnows: {
        textFromThePanel: undefined,
        hasOperatorChangedTheValue: false,
        cursorVisit: { textShownWhenTheCursorEntered: '27:34', hasOperatorTyped: false },
      },
      expectedText: '27:34',
    },
    // Typing 12:34 over a field filled with 12:34 leaves it "unchanged" for the form.
    // Without this row the text would jump to 27:35 at the last keystroke.
    {
      name: 'shows what the form holds after typing, even when the typed value is the one the form was filled with',
      whatTheRowKnows: {
        textFromThePanel: '27:35',
        hasOperatorChangedTheValue: false,
        cursorVisit: { textShownWhenTheCursorEntered: '27:34', hasOperatorTyped: true },
      },
      expectedText: undefined,
    },
    // The cursor entered a field that was showing its own value: a text that turns up
    // later must wait until the cursor has left.
    {
      name: 'does not bring in a text that appeared after the cursor entered',
      whatTheRowKnows: {
        textFromThePanel: '27:35',
        hasOperatorChangedTheValue: false,
        cursorVisit: { textShownWhenTheCursorEntered: undefined, hasOperatorTyped: false },
      },
      expectedText: undefined,
    },
    // Every field of every other form: no panel text, so the form's value is shown.
    {
      name: 'shows what the form holds when the panel gave no text',
      whatTheRowKnows: {
        textFromThePanel: undefined,
        hasOperatorChangedTheValue: false,
        cursorVisit: undefined,
      },
      expectedText: undefined,
    },
  ];

  it.each(momentsOfAFieldThatShowsTheTimeOnScreen)('$name', ({ whatTheRowKnows, expectedText }) => {
    // Arrange: what the row knows at that moment is the row of the table.

    // Act: ask which text the control must show.
    const textToShow = chooseTextShownInPlaceOfFieldValue(whatTheRowKnows);

    // Assert: the text of the table; undefined stands for "the value the form holds".
    expect(
      textToShow,
      'the control must show this text, or the form’s own value when undefined',
    ).toBe(expectedText);
  });
});
