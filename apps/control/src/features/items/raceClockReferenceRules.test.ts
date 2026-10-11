/**
 * Race clock reference rules: which differing clock fields an update really sends (apps/control)
 *
 * What this module is for:
 *   "Salvar item" on a stored item sends only what changed. For most fields "changed"
 *   simply means "differs from the stored value". The race clock has two fields where
 *   that is not enough: its time (the form works in whole seconds) and its reference
 *   moment (the form always builds "the moment of the take"). applyRaceClockReferenceRules
 *   is given the fields that differ and takes out the ones the operator did not touch.
 *
 * What these tests prove:
 *   - A time that differs only by a part of a second the form cannot show is taken out.
 *   - A stored number as the reference moment stays when neither the time nor "running"
 *     changed, and is replaced by "the moment of the take" when one of them did.
 *   - A missing reference moment is always sent.
 *   - Fields the rules are not about (the flag) pass through untouched.
 *
 * What these tests deliberately do not cover:
 *   - Finding which fields differ, and the whole command built around the result
 *     (itemCommandsFromForm.test.ts and its two sibling files).
 *   - An item that already stores "the moment of the take": that field then never
 *     differs, so it never reaches these rules (itemCommandsFromForm.test.ts).
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildEnduranceStartClockItemSavedWithTheMomentOfTheSave } from './itemsLikeTheEditorSaves.testSupport';
import { applyRaceClockReferenceRules } from './raceClockReferenceRules';

/** One row of the table below: the fields that differ, and the ones that must be sent. */
type ScenarioOfDifferingClockFields = {
  name: string;
  fieldsThatDiffer: ItemFields;
  expectedFieldsToSend: ItemFields;
};

describe('applyRaceClockReferenceRules', () => {
  const scenariosOfDifferingClockFields: ScenarioOfDifferingClockFields[] = [
    // Nothing about the clock was touched; only the form's take-time differs from the
    // stored number. Sending it would move a running clock for a label-only edit.
    {
      name: 'takes the reference moment out when only it differs',
      fieldsThatDiffer: { referenceWallClockMs: { kind: 'takeTime' } },
      expectedFieldsToSend: {},
    },
    // The flag is not part of the clock's reference: it goes, the reference stays put.
    {
      name: 'lets a new flag through and still takes the reference moment out',
      fieldsThatDiffer: {
        state: { kind: 'literal', value: 'green' },
        referenceWallClockMs: { kind: 'takeTime' },
      },
      expectedFieldsToSend: { state: { kind: 'literal', value: 'green' } },
    },
    // A new time (90:00) is a new reference, so the clock counts from the take from now on.
    {
      name: 'keeps the reference moment when the time changed',
      fieldsThatDiffer: {
        referenceTimeMs: { kind: 'literal', value: 5_400_000 },
        referenceWallClockMs: { kind: 'takeTime' },
      },
      expectedFieldsToSend: {
        referenceTimeMs: { kind: 'literal', value: 5_400_000 },
        referenceWallClockMs: { kind: 'takeTime' },
      },
    },
    // Starting the clock is a new reference as well.
    {
      name: 'keeps the reference moment when "running" changed',
      fieldsThatDiffer: {
        running: { kind: 'literal', value: true },
        referenceWallClockMs: { kind: 'takeTime' },
      },
      expectedFieldsToSend: {
        running: { kind: 'literal', value: true },
        referenceWallClockMs: { kind: 'takeTime' },
      },
    },
  ];

  it.each(scenariosOfDifferingClockFields)(
    '$name',
    ({ fieldsThatDiffer, expectedFieldsToSend }) => {
      // Arrange: the endurance start item as an earlier editor saved it: stopped at
      // 240:00, with the Friday evening of the save as a number in its reference moment.
      const fieldsOnTheItem = buildEnduranceStartClockItemSavedWithTheMomentOfTheSave().fields;

      // Act: apply the race clock's rules to the fields that differ.
      const fieldsToSend = applyRaceClockReferenceRules(fieldsThatDiffer, fieldsOnTheItem);

      // Assert: only what the operator really changed is left.
      expect(
        fieldsToSend,
        'a stored number must be replaced only together with a new time or a new "running"',
      ).toEqual(expectedFieldsToSend);
    },
  );

  it('takes out a time that differs only by a part of a second the form cannot show', () => {
    // Arrange: the same item with 1 min 30.5 s stored by a script (90 500 ms). The form
    // shows "1:30" and hands back 90 000 ms, so the time and the reference both "differ".
    const fieldsOnTheItem: ItemFields = {
      ...buildEnduranceStartClockItemSavedWithTheMomentOfTheSave().fields,
      referenceTimeMs: { kind: 'literal', value: 90_500 },
    };
    const fieldsThatDiffer: ItemFields = {
      referenceTimeMs: { kind: 'literal', value: 90_000 },
      referenceWallClockMs: { kind: 'takeTime' },
    };

    // Act: apply the race clock's rules.
    const fieldsToSend = applyRaceClockReferenceRules(fieldsThatDiffer, fieldsOnTheItem);

    // Assert: nothing is sent; the half second is the form's rounding, not an edit.
    expect(
      fieldsToSend,
      'a time the operator did not touch must not be sent, nor drag the reference along',
    ).toEqual({});
  });

  it('always sends the reference moment of an item that has none', () => {
    // Arrange: the same item with its reference moment lost (a hand-made API call).
    const fieldsOnTheItem: ItemFields = {
      ...buildEnduranceStartClockItemSavedWithTheMomentOfTheSave().fields,
    };
    delete fieldsOnTheItem.referenceWallClockMs;
    const fieldsThatDiffer: ItemFields = { referenceWallClockMs: { kind: 'takeTime' } };

    // Act: apply the race clock's rules, with nothing else changed.
    const fieldsToSend = applyRaceClockReferenceRules(fieldsThatDiffer, fieldsOnTheItem);

    // Assert: the reference is sent, because the graphic refuses a clock without one.
    expect(fieldsToSend, 'a missing reference moment must be repaired by any save').toEqual({
      referenceWallClockMs: { kind: 'takeTime' },
    });
  });
});
