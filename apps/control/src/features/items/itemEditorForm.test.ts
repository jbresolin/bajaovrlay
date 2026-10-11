/**
 * Item editor form: values and rules (apps/control)
 *
 * What this module is for:
 *   An item is a prepared use of a graphic. The part of the item editor that is the same
 *   for every graphic asks for the graphic, the layer, a label, a colour, notes and an
 *   optional auto-out delay typed in seconds. itemEditorForm holds everything about that
 *   part that is not drawing: its starting values, the rule for each field with its
 *   pt-BR message, the values an existing item fills it with, and the auto-out delay in
 *   the milliseconds the server stores.
 *
 * What these tests prove:
 *   - The starting values: nothing chosen, nothing typed, the neutral colour, no auto-out.
 *   - A correctly filled form has no messages; a missing graphic, layer or label and a
 *     badly typed auto-out each get their own pt-BR message, all at once.
 *   - Auto-out typed in whole seconds becomes milliseconds, and blank means "none".
 *   - An existing item fills the form with what it holds, its delay shown in seconds.
 *
 * What these tests deliberately do not cover:
 *   - The race clock's own fields, which keep the rules of the take panel
 *     (features/playout/raceClockTakeForm.test.ts).
 *   - The commands built from the form (itemCommandsFromForm.test.ts) and drawing the
 *     form (ItemEditorPanel.test.tsx).
 */
import { describe, expect, it } from 'vitest';

import {
  buildItemEditorFormValuesFromItem,
  convertAutoOutSecondsTextToMilliseconds,
  defaultItemEditorFormValues,
  findItemEditorFormErrors,
  type ItemEditorFormValues,
} from './itemEditorForm';
import {
  buildDriverLowerThirdItem,
  buildEnduranceStartClockItem,
} from './itemsLikeTheEditorSaves.testSupport';

/** The form as an operator fills it for the podium clock, off air by itself after 30 s. */
function buildFormFilledForThePodiumClock(): ItemEditorFormValues {
  return {
    graphicId: 'race-clock',
    layerId: 'clock',
    label: 'Relógio do pódio',
    color: 'highlight',
    notes: 'Só depois da bandeira quadriculada.',
    autoOutAfterSeconds: '30',
  };
}

describe('defaultItemEditorFormValues', () => {
  it('opens with nothing chosen or typed, the neutral colour and no auto-out', () => {
    // Arrange: nothing to prepare; the starting values are a constant.

    // Act: read them.
    const startingValues = defaultItemEditorFormValues;

    // Assert: every field is empty except the colour, which starts neutral.
    expect(startingValues, 'a new item must start empty and neutral').toEqual({
      graphicId: '',
      layerId: '',
      label: '',
      color: 'neutral',
      notes: '',
      autoOutAfterSeconds: '',
    });
  });
});

describe('findItemEditorFormErrors', () => {
  it('finds nothing wrong with a correctly filled form', () => {
    // Arrange: the form filled for the podium clock.
    const formValues = buildFormFilledForThePodiumClock();

    // Act: check it.
    const fieldErrors = findItemEditorFormErrors(formValues);

    // Assert: no field has a message.
    expect(fieldErrors, 'a correct form must have no errors').toEqual({});
  });

  it('accepts empty notes and a blank auto-out, because both are optional', () => {
    // Arrange: the same form with no notes and no auto-out.
    const formValues = {
      ...buildFormFilledForThePodiumClock(),
      notes: '',
      autoOutAfterSeconds: '',
    };

    // Act: check it.
    const fieldErrors = findItemEditorFormErrors(formValues);

    // Assert: no field has a message.
    expect(fieldErrors, 'notes and auto-out may be left blank').toEqual({});
  });

  const scenariosWithOneFieldWrong = [
    // Without a graphic there is nothing to put on air.
    {
      name: 'asks for the graphic when none is chosen',
      fieldName: 'graphicId',
      fieldValue: '',
      message: 'Escolha o gráfico.',
    },
    // Without a layer the server would not know where the graphic goes.
    {
      name: 'asks for the layer when none is chosen',
      fieldName: 'layerId',
      fieldValue: '',
      message: 'Escolha a camada.',
    },
    // The label is what the operator reads in the rundown; the server refuses an empty one.
    {
      name: 'asks for the label when it is empty',
      fieldName: 'label',
      fieldValue: '',
      message: 'Informe o rótulo do item.',
    },
    // Only spaces is the same as empty once it is in the rundown.
    {
      name: 'asks for the label when it is only spaces',
      fieldName: 'label',
      fieldValue: '   ',
      message: 'Informe o rótulo do item.',
    },
    // A colour that is not one of the six fixed names (a hand-made form value).
    {
      name: 'asks for the colour when the value is not one of the six',
      fieldName: 'color',
      fieldValue: 'roxo',
      message: 'Escolha a cor.',
    },
    // Zero would clear the layer the instant the item is taken; "none" is said by blank.
    {
      name: 'refuses an auto-out of zero seconds',
      fieldName: 'autoOutAfterSeconds',
      fieldValue: '0',
      message: 'Informe os segundos como um número inteiro maior que zero ou deixe em branco.',
    },
    // The field takes whole seconds; half a second is not offered in this task.
    {
      name: 'refuses an auto-out with a decimal part',
      fieldName: 'autoOutAfterSeconds',
      fieldValue: '7,5',
      message: 'Informe os segundos como um número inteiro maior que zero ou deixe em branco.',
    },
    // A word instead of a number.
    {
      name: 'refuses an auto-out typed as a word',
      fieldName: 'autoOutAfterSeconds',
      fieldValue: 'oito',
      message: 'Informe os segundos como um número inteiro maior que zero ou deixe em branco.',
    },
  ];

  it.each(scenariosWithOneFieldWrong)('$name', ({ fieldName, fieldValue, message }) => {
    // Arrange: a correct form with one field replaced by the scenario's value.
    const formValues = { ...buildFormFilledForThePodiumClock(), [fieldName]: fieldValue };

    // Act: check it.
    const fieldErrors = findItemEditorFormErrors(formValues);

    // Assert: only that field has a message, and it is the pt-BR one for that field.
    expect(fieldErrors, `only "${fieldName}" must be reported, with its own message`).toEqual({
      [fieldName]: message,
    });
  });

  it('reports every wrong field at once, so the operator fixes them in one pass', () => {
    // Arrange: a form with no label and an auto-out of zero.
    const formValues = {
      ...buildFormFilledForThePodiumClock(),
      label: '',
      autoOutAfterSeconds: '0',
    };

    // Act: check it.
    const fieldErrors = findItemEditorFormErrors(formValues);

    // Assert: both fields carry their message.
    expect(fieldErrors, 'both wrong fields must be reported together').toEqual({
      label: 'Informe o rótulo do item.',
      autoOutAfterSeconds:
        'Informe os segundos como um número inteiro maior que zero ou deixe em branco.',
    });
  });
});

describe('convertAutoOutSecondsTextToMilliseconds', () => {
  const autoOutScenarios = [
    // The common case: a lower third that leaves after eight seconds.
    { name: 'turns 8 seconds into 8 000 ms', text: '8', expectedMilliseconds: 8_000 },
    // Stray spaces around the number must not matter.
    { name: 'ignores spaces around the number', text: ' 30 ', expectedMilliseconds: 30_000 },
    // Blank is how the operator says "stay on air until I clear it".
    { name: 'answers "no auto-out" for a blank field', text: '', expectedMilliseconds: undefined },
  ];

  it.each(autoOutScenarios)('$name', ({ text, expectedMilliseconds }) => {
    // Arrange: the text of the scenario, as typed in the auto-out field.

    // Act: convert it.
    const milliseconds = convertAutoOutSecondsTextToMilliseconds(text);

    // Assert: the server's unit is milliseconds, and "none" is undefined.
    expect(milliseconds, 'seconds typed must become the milliseconds the server stores').toBe(
      expectedMilliseconds,
    );
  });
});

describe('buildItemEditorFormValuesFromItem', () => {
  it('fills the form with what an item without auto-out holds', () => {
    // Arrange: the clock item prepared for the start of the endurance race.
    const item = buildEnduranceStartClockItem();

    // Act: build the form values from it.
    const formValues = buildItemEditorFormValuesFromItem(item);

    // Assert: every field repeats the item, and the auto-out field is blank.
    expect(formValues, 'the form must show the item as it is stored').toEqual({
      graphicId: 'race-clock',
      layerId: 'clock',
      label: 'Largada do Enduro',
      color: 'success',
      notes: 'Entrar quando os carros alinharem.',
      autoOutAfterSeconds: '',
    });
  });

  it('shows an auto-out of 8 000 ms as 8 seconds', () => {
    // Arrange: the lower third of team 42, which leaves by itself after 8 000 ms.
    const item = buildDriverLowerThirdItem();

    // Act: build the form values from it.
    const formValues = buildItemEditorFormValuesFromItem(item);

    // Assert: the operator reads seconds, never milliseconds.
    expect(formValues.autoOutAfterSeconds, 'the delay must be shown in seconds').toBe('8');
  });
});
