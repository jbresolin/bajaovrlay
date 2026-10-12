/**
 * The fields of a generated form, drawn (apps/control)
 *
 * What this module is for:
 *   SchemaFormFields draws one control per property of a graphic's data schema, so the
 *   operator can fill any graphic without the control page knowing it. The labels, help
 *   texts and dropdown options are the manifest's own words.
 *
 * What these tests prove:
 *   - Every shape of the lower third fixture is drawn with the right kind of control,
 *     under the manifest's title, holding the value the form was filled with.
 *   - A number input carries the manifest's minimum, maximum and step, and a text input
 *     its maximum length.
 *   - A required field carries a visible mark and is announced as required; an optional
 *     one has a "limpar" button instead.
 *   - The manifest's description is tied to the control as its help text.
 *   - A property the form cannot edit is a read-only JSON box with a pt-BR note, and
 *     says so differently when it has no value.
 *   - A schema that is unsupported as a whole draws one read-only box with all the
 *     data; a graphic without a schema draws nothing.
 *   - The disabled flag turns every control off.
 *
 * What these tests deliberately do not cover:
 *   - Typing, clearing, the kind selector and error messages:
 *     SchemaFormFieldsEditing.test.tsx.
 *   - The real race clock manifest: SchemaFormFieldsRaceClock.test.tsx.
 *   - Element ids and what a label points at: SchemaFormFieldsIdsAndLabels.test.tsx.
 *   - How the page looks (widths, colours); nothing is laid out in these tests.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromDataOnAir,
} from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  buildLowerThirdFormValuesForCar42,
  describeLowerThirdFixtureForm,
} from './lowerThirdFixtureSchema.testSupport';
import { renderSchemaFormOnTestPage } from './schemaFormOnTestPage.testSupport';

/**
 * Names the kind of control an element is, in the words of the form's descriptions, by
 * looking at what the browser was given: its tag, its role and its input type.
 */
function nameControlDrawn(element: HTMLElement): string {
  if (element.tagName === 'TEXTAREA') {
    return element.hasAttribute('readonly') ? 'unsupported' : 'an editable textarea';
  }
  const role = element.getAttribute('role');
  if (role === 'combobox') {
    return 'select';
  }
  if (role === 'switch') {
    return 'switch';
  }
  const inputType = element.getAttribute('type') ?? 'text';
  if (inputType === 'datetime-local') {
    return 'dateTime';
  }
  if (inputType === 'number') {
    return 'number';
  }
  return element.getAttribute('placeholder') === 'mm:ss' ? 'duration' : 'text';
}

/** Draws the lower third's form filled from car 42's data on air. */
function renderLowerThirdFormForCar42(options?: { isDisabled: boolean }) {
  return renderSchemaFormOnTestPage({
    description: describeLowerThirdFixtureForm(),
    formValues: buildLowerThirdFormValuesForCar42(),
    isDisabled: options?.isDisabled,
  });
}

describe('SchemaFormFields, on the lower third fixture', () => {
  const fieldsAndTheirControls = [
    // Plain text: a one-line input holding the name.
    { name: 'draws "Nome" as a text input', label: 'Nome', control: 'text', isRequired: true },
    // The same control for an optional text.
    { name: 'draws "Cargo" as a text input', label: 'Cargo', control: 'text', isRequired: false },
    // An enum is a dropdown.
    { name: 'draws "Equipe" as a dropdown', label: 'Equipe', control: 'select', isRequired: true },
    // A date-time is the browser's own date and time input.
    {
      name: 'draws "Horário da entrevista" as a date and time input',
      label: 'Horário da entrevista',
      control: 'dateTime',
      isRequired: false,
    },
    // Milliseconds with `v_baja.unit: ms` are typed as mm:ss.
    {
      name: 'draws "Tempo no ar" as an mm:ss field',
      label: 'Tempo no ar',
      control: 'duration',
      isRequired: true,
    },
    // A boolean is a switch.
    {
      name: 'draws "Destaque" as a switch',
      label: 'Destaque',
      control: 'switch',
      isRequired: true,
    },
    // An integer is a number input.
    {
      name: 'draws "Número do carro" as a number input',
      label: 'Número do carro',
      control: 'number',
      isRequired: true,
    },
    // So is a decimal number.
    {
      name: 'draws "Peso do carro (kg)" as a number input',
      label: 'Peso do carro (kg)',
      control: 'number',
      isRequired: false,
    },
    // A list is shown read-only.
    {
      name: 'draws "Patrocinadores" as a read-only box',
      label: 'Patrocinadores',
      control: 'unsupported',
      isRequired: false,
    },
    // A nested object is shown read-only.
    {
      name: 'draws "Redes sociais" as a read-only box',
      label: 'Redes sociais',
      control: 'unsupported',
      isRequired: false,
    },
  ];

  it.each(fieldsAndTheirControls)('$name', ({ label, control, isRequired }) => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the lower third's form, filled from car 42's data.
    renderLowerThirdFormForCar42();

    // Assert: the manifest's title labels a control of the right kind.
    const controlUnderTheLabel = screen.getByLabelText(label);
    expect(nameControlDrawn(controlUnderTheLabel), `"${label}" must be a ${control} control`).toBe(
      control,
    );
    if (control !== 'unsupported') {
      expect(
        controlUnderTheLabel.getAttribute('aria-required'),
        `"${label}" must be announced as required exactly when the manifest requires it`,
      ).toBe(String(isRequired));
    }
  });

  it('shows the values the form was filled with', () => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the form filled from car 42's data on air.
    renderLowerThirdFormForCar42();

    // Assert: each control shows the on-air value in the operator's terms.
    expect(screen.getByLabelText('Nome'), 'the name must be shown').toHaveValue('Ana Souza');
    expect(
      screen.getByRole('combobox', { name: 'Equipe' }),
      'the team must be shown by its label, not its value',
    ).toHaveTextContent('Baja UFPR');
    expect(screen.getByLabelText('Tempo no ar'), '8 000 ms must read 0:08').toHaveValue('0:08');
    expect(
      screen.getByRole('switch', { name: 'Destaque' }),
      'the highlight is on for car 42',
    ).toBeChecked();
    expect(screen.getByLabelText('Número do carro'), 'the car number must be shown').toHaveValue(
      42,
    );
    expect(screen.getByLabelText('Peso do carro (kg)'), 'the weight must be shown').toHaveValue(
      182.5,
    );
  });

  const fieldsAndTheLimitsTheBrowserIsTold = [
    // An integer with both limits: the browser's arrows stay inside 1–999, in whole steps.
    {
      name: 'tells the browser "Número do carro" goes from 1 to 999 in whole steps',
      label: 'Número do carro',
      min: '1',
      max: '999',
      step: '1',
      maxLength: null,
    },
    // A decimal number: step "any" is what lets the browser accept 182.5.
    {
      name: 'tells the browser "Peso do carro (kg)" goes from 100 to 300 with any decimals',
      label: 'Peso do carro (kg)',
      min: '100',
      max: '300',
      step: 'any',
      maxLength: null,
    },
    // A text with maxLength: the browser stops the typing at 40 characters.
    {
      name: 'tells the browser "Nome" holds at most 40 characters',
      label: 'Nome',
      min: null,
      max: null,
      step: null,
      maxLength: '40',
    },
    // A text without limits in the manifest must not be given one by the form.
    {
      name: 'gives "Cargo" no limit the manifest does not have',
      label: 'Cargo',
      min: null,
      max: null,
      step: null,
      maxLength: null,
    },
  ];

  it.each(fieldsAndTheLimitsTheBrowserIsTold)('$name', ({ label, min, max, step, maxLength }) => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the lower third's form, filled from car 42's data.
    renderLowerThirdFormForCar42();

    // Assert: the input carries the manifest's limits, so the browser helps before the
    // form's own check has to refuse anything.
    const limitsOnTheInput = {
      min: screen.getByLabelText(label).getAttribute('min'),
      max: screen.getByLabelText(label).getAttribute('max'),
      step: screen.getByLabelText(label).getAttribute('step'),
      maxLength: screen.getByLabelText(label).getAttribute('maxlength'),
    };
    expect(limitsOnTheInput, `"${label}" must carry exactly the manifest's limits`).toEqual({
      min,
      max,
      step,
      maxLength,
    });
  });

  it('marks required fields and gives optional ones a "limpar" button', () => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the form.
    renderLowerThirdFormForCar42();

    // Assert: the required name has the mark next to its label and no clear button; the
    // optional "cargo" has the button and no mark.
    const rowOfTheNameLabel = screen.getByText('Nome').parentElement;
    const rowOfTheCargoLabel = screen.getByText('Cargo').parentElement;
    expect(rowOfTheNameLabel, 'a required field must show the mark').toHaveTextContent('Nome*');
    expect(rowOfTheCargoLabel, 'an optional field must not show the mark').toHaveTextContent(
      /^Cargo$/,
    );
    expect(
      screen.queryByRole('button', { name: 'Limpar Nome' }),
      'a required field cannot be cleared',
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Limpar Cargo' }),
      'an optional field must offer "limpar"',
    ).toHaveTextContent('limpar');
  });

  it('ties the manifest’s description to the control as help', () => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the form.
    renderLowerThirdFormForCar42();

    // Assert: the help is on the page and a screen reader reads it with the control.
    expect(
      screen.getByLabelText('Nome'),
      'the description must be read out with the name field',
    ).toHaveAccessibleDescription('Nome de quem aparece na tela.');
    expect(
      screen.getByRole('switch', { name: 'Destaque' }),
      'the description must be read out with the switch',
    ).toHaveAccessibleDescription('Liga a moldura de destaque.');
  });

  it('shows what it cannot edit as read-only JSON with a note', () => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the form filled from car 42's data, which has sponsors.
    renderLowerThirdFormForCar42();

    // Assert: the list is there to read, cannot be typed in, and the note says why.
    const sponsorsBox = screen.getByLabelText('Patrocinadores');
    expect(sponsorsBox, 'the box must not accept typing').toHaveAttribute('readonly');
    expect(sponsorsBox, 'the list must be shown as JSON').toHaveValue(
      '[\n  "Oficina do Zé",\n  "Autopeças Curitiba"\n]',
    );
    expect(sponsorsBox, 'the note must explain the box').toHaveAccessibleDescription(
      'O formulário ainda não sabe editar este campo. O valor abaixo é só para leitura e segue como está.',
    );
  });

  it('says that an uneditable property has no value instead of inventing one', () => {
    // Arrange: a new lower third: nobody has given it sponsors.
    const description = describeLowerThirdFixtureForm();

    // Act: draw the empty form.
    renderSchemaFormOnTestPage({
      description,
      formValues: buildEmptySchemaFormValues(description),
    });

    // Assert: the label and a note are there, and no box with made-up content.
    expect(screen.getByText('Patrocinadores'), 'the property is still named').toBeInTheDocument();
    expect(
      screen.getAllByText('O formulário ainda não sabe editar este campo, e ele está sem valor.'),
      'both uneditable properties say they have no value',
    ).toHaveLength(2);
    expect(screen.queryByRole('textbox', { name: 'Patrocinadores' }), 'no box is drawn').toBeNull();
  });

  it('turns every control off when the form is disabled', () => {
    // Arrange: nothing beyond the form itself.

    // Act: draw the form disabled, as a panel does while there is no connection.
    renderLowerThirdFormForCar42({ isDisabled: true });

    // Assert: one control of each kind is off, and so is "limpar".
    expect(screen.getByLabelText('Nome'), 'the text input must be off').toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Equipe' }),
      'the dropdown must be off',
    ).toBeDisabled();
    expect(
      screen.getByRole('switch', { name: 'Destaque' }),
      'the switch must be off',
    ).toBeDisabled();
    expect(screen.getByLabelText('Número do carro'), 'the number input must be off').toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Limpar Cargo' }),
      'the clear button must be off',
    ).toBeDisabled();
  });
});

describe('SchemaFormFields, on schemas that are not a list of properties', () => {
  it('draws one read-only box with all the data when the whole schema is unsupported', () => {
    // Arrange: a ticker described by a oneOf, on air with a text and a speed.
    const description = describeSchemaFormFromDataSchema({ oneOf: [{ type: 'object' }] });
    const formValues = buildSchemaFormValuesFromDataOnAir(description, {
      texto: 'Largada às 10h',
      velocidade: 2,
    }).formValues;

    // Act: draw the form.
    renderSchemaFormOnTestPage({ description, formValues });

    // Assert: the fallback shows everything, read-only, under a pt-BR label and note.
    const wholeDataBox = screen.getByLabelText('Dados do gráfico');
    expect(wholeDataBox, 'the box must not accept typing').toHaveAttribute('readonly');
    expect(wholeDataBox, 'all the data must be shown as JSON').toHaveValue(
      '{\n  "texto": "Largada às 10h",\n  "velocidade": 2\n}',
    );
    expect(
      screen.getByText(
        'O formulário ainda não sabe editar os dados deste gráfico. O que aparece abaixo é só para leitura e segue como está.',
      ),
      'the note must explain the fallback',
    ).toBeInTheDocument();
  });

  it('draws nothing for a graphic that has no data schema', () => {
    // Arrange: a graphic whose manifest has no `schema` (a logo, say).
    const description = describeSchemaFormFromDataSchema(undefined);

    // Act: draw the form.
    renderSchemaFormOnTestPage({
      description,
      formValues: buildEmptySchemaFormValues(description),
    });

    // Assert: no control and no note; the panel's own buttons are all there is.
    expect(screen.queryAllByRole('textbox'), 'there is nothing to fill').toHaveLength(0);
    expect(screen.queryByText('Dados do gráfico'), 'and nothing unsupported to explain').toBeNull();
  });
});
