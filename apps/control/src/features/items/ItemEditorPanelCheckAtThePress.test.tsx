/**
 * Item editor panel: what the check at "Salvar item" leaves behind (apps/control)
 *
 * What this module is for:
 *   A press of "Salvar item" checks two forms one after the other: the fields every item
 *   has, and the fields generated for the chosen graphic (here the race clock's).
 *   Besides showing the messages, that check does two quieter things an operator relies
 *   on: it puts the typing cursor on the first wrong field, and from then on a message
 *   goes away as soon as its field is corrected.
 *
 * What these tests prove:
 *   - Before the first press nothing is checked while typing: an emptied label shows no
 *     message.
 *   - After a press that found a problem, correcting the field takes its message away
 *     at once, without another press; this holds for the item's fields and for the
 *     graphic's fields.
 *   - With problems in both parts, the focus goes to the first wrong field of the item
 *     part (the label), not to the graphic's.
 *   - With a problem only in the graphic's part, the focus goes to that field.
 *
 * What these tests deliberately do not cover:
 *   - Which messages appear at the press and that nothing is sent:
 *     ItemEditorPanelProblems.test.tsx.
 *   - Every rule: itemEditorForm.test.ts and
 *     features/schemaForm/checkSchemaFormValues.test.ts.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import { renderItemEditorPanelOnFakeServer } from './itemEditorOnFakeServer.testSupport';
import { raceClockReferenceTimeLabel } from './itemsLikeTheEditorSaves.testSupport';

const messageOfTheMissingLabel = 'Informe o rótulo do item.';
const messageOfTheBadlyTypedTime = `Use minutos e segundos no formato mm:ss em "${raceClockReferenceTimeLabel}", por exemplo 12:30.`;

describe('the item editor panel before the first press of "Salvar item"', () => {
  it('shows no message while the operator is still typing', () => {
    // Arrange: the editor for a new item.
    renderItemEditorPanelOnFakeServer(null);

    // Act: type a label and erase it again, without pressing "Salvar item".
    typeIntoField('Rótulo', 'Largada do Enduro');
    typeIntoField('Rótulo', '');

    // Assert: no message yet; the form is only checked when the operator asks to save.
    expect(
      screen.queryByText(messageOfTheMissingLabel),
      'a field must not be reported as wrong before "Salvar item" was ever pressed',
    ).toBeNull();
  });
});

describe('the item editor panel after a press of "Salvar item" that found problems', () => {
  it('takes the message of the label away as soon as a label is typed', async () => {
    // Arrange: a new item saved with no label, so the label's message is on screen.
    renderItemEditorPanelOnFakeServer(null);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    await screen.findByText(messageOfTheMissingLabel);

    // Act: type the label, without pressing "Salvar item" again.
    typeIntoField('Rótulo', 'Largada do Enduro');

    // Assert: the message is gone, so the operator sees the field is fine now.
    await waitFor(() => {
      expect(
        screen.queryByText(messageOfTheMissingLabel),
        'the message must go away once the label is typed, without another press',
      ).toBeNull();
    });
  });

  it('takes the message of the race clock time away as soon as the time is corrected', async () => {
    // Arrange: a new item with a label, saved with one hour typed as h:mm:ss.
    renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Largada do Enduro');
    typeIntoField(raceClockReferenceTimeLabel, '1:00:00');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    await screen.findByText(messageOfTheBadlyTypedTime);

    // Act: type the hour as 60:00, without pressing "Salvar item" again.
    typeIntoField(raceClockReferenceTimeLabel, '60:00');

    // Assert: the message is gone.
    await waitFor(() => {
      expect(
        screen.queryByText(messageOfTheBadlyTypedTime),
        'the message must go away once the time is corrected, without another press',
      ).toBeNull();
    });
  });

  it('puts the focus on the label when both the label and the race clock time are wrong', async () => {
    // Arrange: a new item with no label and one hour typed as h:mm:ss.
    renderItemEditorPanelOnFakeServer(null);
    typeIntoField(raceClockReferenceTimeLabel, '1:00:00');

    // Act: press "Salvar item" and wait until both messages are on screen.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    await screen.findByText(messageOfTheMissingLabel);
    await screen.findByText(messageOfTheBadlyTypedTime);

    // Assert: the typing cursor is on the first wrong field from the top, the label.
    await waitFor(() => {
      expect(
        screen.getByLabelText('Rótulo'),
        'the focus must go to the first wrong field of the item part, not to the race clock',
      ).toHaveFocus();
    });
  });

  it('puts the focus on the race clock time when only that field is wrong', async () => {
    // Arrange: a new item with a label and one hour typed as h:mm:ss.
    renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Largada do Enduro');
    typeIntoField(raceClockReferenceTimeLabel, '1:00:00');

    // Act: press "Salvar item" and wait until the message is on screen.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    await screen.findByText(messageOfTheBadlyTypedTime);

    // Assert: the typing cursor is on the time field, the only one to correct.
    await waitFor(() => {
      expect(
        screen.getByLabelText(raceClockReferenceTimeLabel),
        'the focus must go to the one wrong field',
      ).toHaveFocus();
    });
  });
});
