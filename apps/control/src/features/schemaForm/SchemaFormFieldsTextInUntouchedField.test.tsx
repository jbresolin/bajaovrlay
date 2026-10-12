/**
 * A generated form showing a panel's text in an untouched field (apps/control)
 *
 * What this module is for:
 *   A panel may hand SchemaFormFields a text for one field to show while the operator
 *   has not touched it. "Edição rápida" hands over the time a clock on air shows right
 *   now, so the operator sees the time they are about to correct instead of the time the
 *   clock was started from. The form's own value must stay what it was filled with:
 *   that is what keeps the field "untouched", and so out of the next "Atualizar".
 *
 * What these tests prove:
 *   - The field shows the panel's text, while the form still holds the value it was
 *     filled with and counts the field as unchanged.
 *   - Typing replaces the text with what was typed, and the field counts as changed.
 *   - Typing exactly the text that was showing counts as a change too: the form now
 *     holds that time, where before it held the older one.
 *   - With the cursor in the field, typing the value the form was filled with shows what
 *     was typed (nothing jumps under the cursor); when the cursor leaves, the field is
 *     unchanged for the form and shows the panel's text again.
 *   - The panel is told when the cursor enters the field and when it leaves.
 *   - A text handed over for a switch is ignored: a switch has no text to show.
 *
 * What these tests deliberately do not cover:
 *   - The rule that chooses the text, moment by moment: textShownInUntouchedField.test.ts.
 *   - A text that changes while the page is open, and the cursor standing in a field
 *     whose text would have moved on: "Edição rápida" has those tests, with a clock
 *     (features/playout/QuickEditPanelTimeOnScreen.test.tsx).
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildSchemaFormValuesFromDataOnAir } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { renderSchemaFormOnTestPage, typeIntoField } from './schemaFormOnTestPage.testSupport';

// The title the race clock's manifest gives its time field, read from the manifest so
// the tests follow it if the wording changes.
const referenceTimeLabel = raceClockManifest.schema.properties.referenceTimeMs.title;

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race.
const quarterToTen = '2026-10-10T12:45:00.000Z';

/**
 * Draws the race clock's form filled from the first heat on air (running from 12:34
 * since 9:45), with the panel handing over "27:34" for the field with this key: the
 * time on screen fifteen minutes later. The test gets the form and the function the
 * panel would be told about the cursor through.
 */
function renderFirstHeatFormShowingTheTimeOnScreenInField(fieldKey: string) {
  const description = describeSchemaFormFromDataSchema(raceClockManifest.schema);
  const formValuesOnAir = buildSchemaFormValuesFromDataOnAir(description, {
    sessionName: 'Enduro de Resistência — Bateria 1',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 754_000,
    referenceWallClockMs: Date.parse(quarterToTen),
    running: true,
  }).formValues;
  const onCursorEnteredOrLeftTheField = vi.fn();
  const formOnPage = renderSchemaFormOnTestPage({
    description,
    formValues: formValuesOnAir,
    textShownInUntouchedField: { fieldKey, text: '27:34', onCursorEnteredOrLeftTheField },
  });
  return { formOnPage, onCursorEnteredOrLeftTheField };
}

describe('a generated form with a panel’s text for one untouched field', () => {
  it('shows the text while the form keeps the value it was filled with and counts the field as unchanged', () => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the first heat's form with "27:34" for the time field.
    const { formOnPage } = renderFirstHeatFormShowingTheTimeOnScreenInField('referenceTimeMs');

    // Assert: the operator reads 27:34, the form still holds 12:34, nothing is changed.
    expect(
      screen.getByLabelText(referenceTimeLabel),
      'the field must show the text the panel handed over',
    ).toHaveValue('27:34');
    expect(
      formOnPage.readFormValues().values.referenceTimeMs,
      'the form must still hold the 12:34 it was filled with',
    ).toBe('12:34');
    expect(
      formOnPage.readDirtyFields().values?.referenceTimeMs,
      'a text shown by the panel must not make the field count as changed',
    ).toBeUndefined();
  });

  it('shows what the operator typed, and counts the field as changed', () => {
    // Arrange: the first heat's form showing 27:34 in the time field.
    const { formOnPage } = renderFirstHeatFormShowingTheTimeOnScreenInField('referenceTimeMs');

    // Act: the operator types 20:00.
    typeIntoField(referenceTimeLabel, '20:00');

    // Assert: the typed time is shown and held, and the field is changed.
    expect(
      screen.getByLabelText(referenceTimeLabel),
      'a typed time must replace the panel’s text',
    ).toHaveValue('20:00');
    expect(
      formOnPage.readFormValues().values.referenceTimeMs,
      'the form must hold the typed time',
    ).toBe('20:00');
    expect(
      formOnPage.readDirtyFields().values?.referenceTimeMs,
      'a typed time must make the field count as changed',
    ).toBe(true);
  });

  it('counts typing the very text that was showing as a change', () => {
    // Arrange: the first heat's form showing 27:34 in the time field.
    const { formOnPage } = renderFirstHeatFormShowingTheTimeOnScreenInField('referenceTimeMs');
    const timeField = screen.getByLabelText(referenceTimeLabel);

    // Act: the operator clicks into the field, deletes the last digit and types it again.
    fireEvent.focus(timeField);
    fireEvent.change(timeField, { target: { value: '27:3' } });
    fireEvent.change(timeField, { target: { value: '27:34' } });

    // Assert: the form holds 27:34 where it held 12:34, so the field is changed. This is
    // how an operator says "the clock must read 27:34 now" although 27:34 was showing.
    expect(timeField, 'the field must show the retyped time').toHaveValue('27:34');
    expect(
      formOnPage.readFormValues().values.referenceTimeMs,
      'the form must hold the retyped time, not the one it was filled with',
    ).toBe('27:34');
    expect(
      formOnPage.readDirtyFields().values?.referenceTimeMs,
      'typing the time that was showing must count as a change',
    ).toBe(true);
  });

  it('shows the typed 12:34 while the cursor is in the field, and the panel’s text again once it leaves', () => {
    // Arrange: the first heat's form showing 27:34 in the time field; the form was
    // filled with 12:34.
    const { formOnPage } = renderFirstHeatFormShowingTheTimeOnScreenInField('referenceTimeMs');
    const timeField = screen.getByLabelText(referenceTimeLabel);

    // Act: the operator clicks into the field and types 12:34, the value the form was
    // filled with; the text is read; then the cursor leaves the field.
    fireEvent.focus(timeField);
    fireEvent.change(timeField, { target: { value: '12:3' } });
    fireEvent.change(timeField, { target: { value: '12:34' } });
    const textWhileTheCursorIsInTheField =
      screen.getByLabelText<HTMLInputElement>(referenceTimeLabel).value;
    fireEvent.blur(timeField);

    // Assert: nothing jumped under the cursor. For the form the field is unchanged
    // (12:34 is what it was filled with), so with the cursor gone it follows the panel.
    expect(
      textWhileTheCursorIsInTheField,
      'what was typed must stay in the field while the cursor is in it',
    ).toBe('12:34');
    expect(
      formOnPage.readDirtyFields().values?.referenceTimeMs,
      'a field typed back to the value it was filled with is not changed',
    ).toBeUndefined();
    expect(
      timeField,
      'an unchanged field must show the panel’s text again once the cursor left',
    ).toHaveValue('27:34');
  });

  it('tells the panel when the cursor enters the field and when it leaves', () => {
    // Arrange: the first heat's form showing 27:34 in the time field.
    const { onCursorEnteredOrLeftTheField } =
      renderFirstHeatFormShowingTheTimeOnScreenInField('referenceTimeMs');
    const timeField = screen.getByLabelText(referenceTimeLabel);

    // Act: the operator clicks into the field and then somewhere else.
    fireEvent.focus(timeField);
    fireEvent.blur(timeField);

    // Assert: one "entered" and one "left", in that order.
    expect(
      onCursorEnteredOrLeftTheField.mock.calls,
      'the panel must hear true when the cursor enters and false when it leaves',
    ).toEqual([[true], [false]]);
  });

  it('ignores a text handed over for a switch', () => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the first heat's form with "27:34" handed over for "Relógio correndo".
    renderFirstHeatFormShowingTheTimeOnScreenInField('running');

    // Assert: the switch shows what the form holds (the clock is running), and the time
    // field shows its own value.
    expect(
      screen.getByRole('switch', { name: 'Relógio correndo' }),
      'a switch must keep showing the value the form holds',
    ).toBeChecked();
    expect(
      screen.getByLabelText(referenceTimeLabel),
      'the time field was given no text, so it must show the form’s 12:34',
    ).toHaveValue('12:34');
  });
});
