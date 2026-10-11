/**
 * Editing a generated form: typing, clearing and error messages (apps/control)
 *
 * What this module is for:
 *   SchemaFormFields is what the operator's hands touch: typing in a field, picking an
 *   option, flipping a switch, pressing "limpar" on an optional field. What the form
 *   holds afterwards, and which fields count as changed, decide what a command sends.
 *
 * What these tests prove:
 *   - Typing, choosing and switching put the new value in the form and mark the field
 *     as changed; a field put back to what it was is no longer changed.
 *   - "limpar" on an optional field makes its value null, shows "Sem valor" and turns
 *     the button off; typing, choosing or switching again is the way back.
 *   - An optional typed field that is emptied by hand is cleared (null) as well, while
 *     a required one keeps its empty text.
 *   - When the form is checked, a wrong field shows its pt-BR message, is marked
 *     invalid and has the message tied to it for screen readers; a correct form shows none.
 *   - A key such as "piloto.nome" does not break the form around it.
 *
 * What these tests deliberately do not cover:
 *   - Every rule and message: checkSchemaFormValues.test.ts and
 *     zodSchemaFromDataSchema.test.ts.
 *   - The commands built from the form: takeAndUpdateFromSchemaForm.test.ts and
 *     itemFieldsFromSchemaForm.test.ts.
 *   - A real browser's number input, which hands over an empty text while the typing is
 *     not a number; that limit is written next to the control's code.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  buildLowerThirdFormValuesForCar42,
  describeLowerThirdFixtureForm,
} from './lowerThirdFixtureSchema.testSupport';
import {
  chooseOptionInDropdown,
  flipSwitch,
  pressButton,
  renderSchemaFormOnTestPage,
  typeIntoField,
} from './schemaFormOnTestPage.testSupport';

/** Draws the lower third's form filled from car 42's data on air. */
function renderLowerThirdFormForCar42() {
  return renderSchemaFormOnTestPage({
    description: describeLowerThirdFixtureForm(),
    formValues: buildLowerThirdFormValuesForCar42(),
  });
}

describe('editing the fields of a generated form', () => {
  it('holds what was typed, chosen and switched, and marks those fields as changed', () => {
    // Arrange: the lower third of car 42, as filled from what is on air.
    const formOnPage = renderLowerThirdFormForCar42();

    // Act: retype the name, pick another team, change the time and turn the highlight off.
    typeIntoField('Nome', 'Bruno Lima');
    chooseOptionInDropdown('Equipe', 'Poli USP');
    typeIntoField('Tempo no ar', '0:15');
    flipSwitch('Destaque');

    // Assert: the form holds the new values and knows which fields were touched.
    expect(formOnPage.readFormValues().values, 'the form must hold the edits').toMatchObject({
      nome: 'Bruno Lima',
      equipe: 'poli-usp',
      duracaoMs: '0:15',
      destaque: false,
      // Untouched.
      numeroDoCarro: '42',
    });
    expect(formOnPage.readDirtyFields().values, 'only the edited fields are changed').toEqual({
      nome: true,
      equipe: true,
      duracaoMs: true,
      destaque: true,
    });
  });

  it('no longer counts a field as changed once it is put back to what it was', () => {
    // Arrange: the name retyped on car 42's form.
    const formOnPage = renderLowerThirdFormForCar42();
    typeIntoField('Nome', 'Bruno Lima');

    // Act: type the original name again.
    typeIntoField('Nome', 'Ana Souza');

    // Assert: nothing counts as changed, so an update would send nothing.
    expect(
      formOnPage.readDirtyFields().values?.nome ?? false,
      'a field that reads as it did when the form was filled is not changed',
    ).toBe(false);
  });
});

describe('clearing an optional field', () => {
  it('makes a text field null with "limpar", and typing brings it back', () => {
    // Arrange: car 42's form, where "Cargo" reads "Capitã".
    const formOnPage = renderLowerThirdFormForCar42();

    // Act: press "limpar" on the optional "Cargo".
    pressButton('Limpar Cargo');

    // Assert: the value is null, the input is empty, and the page says so.
    expect(formOnPage.readFormValues().values.cargo, 'a cleared field holds null').toBeNull();
    expect(screen.getByLabelText('Cargo'), 'the input must be empty').toHaveValue('');
    expect(screen.getByText('Sem valor'), 'the cleared state must be visible').toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Limpar Cargo' }),
      'there is nothing left to clear',
    ).toBeDisabled();
    expect(formOnPage.readDirtyFields().values?.cargo, 'clearing is a change').toBe(true);

    // Act: type a new value.
    typeIntoField('Cargo', 'Piloto');

    // Assert: the field has a value again and the note is gone.
    expect(formOnPage.readFormValues().values.cargo, 'typing is the way back').toBe('Piloto');
    expect(screen.queryByText('Sem valor'), 'the note must go with the value').toBeNull();
  });

  it('makes an optional number null when it is emptied by hand', () => {
    // Arrange: car 42's form, where the weight reads 182.5.
    const formOnPage = renderLowerThirdFormForCar42();

    // Act: erase the weight.
    typeIntoField('Peso do carro (kg)', '');

    // Assert: for an optional typed field, blank and cleared are one state.
    expect(
      formOnPage.readFormValues().values.pesoDoCarroKg,
      'an emptied optional field holds null',
    ).toBeNull();
    expect(screen.getByText('Sem valor'), 'the cleared state must be visible').toBeInTheDocument();
  });

  it('keeps the empty text of a required field, which cannot be cleared', () => {
    // Arrange: car 42's form.
    const formOnPage = renderLowerThirdFormForCar42();

    // Act: erase the required name.
    typeIntoField('Nome', '');

    // Assert: it is an empty text for the check to refuse, not a cleared field.
    expect(formOnPage.readFormValues().values.nome, 'a required field is never null').toBe('');
    expect(screen.queryByText('Sem valor'), 'a required field has no cleared state').toBeNull();
  });

  it('clears an optional dropdown and switch only with "limpar", and choosing brings them back', () => {
    // Arrange: a bib colour (dropdown) and a "reserve driver" switch, both optional and
    // both with a value.
    const description = describeSchemaFormFromDataSchema({
      type: 'object',
      properties: {
        corDoColete: {
          type: 'string',
          title: 'Cor do colete',
          enum: ['amarelo', 'laranja'],
          gddOptions: { labels: { amarelo: 'Amarelo', laranja: 'Laranja' } },
          default: 'amarelo',
        },
        pilotoReserva: { type: 'boolean', title: 'Piloto reserva', default: true },
      },
    });
    const formOnPage = renderSchemaFormOnTestPage({
      description,
      formValues: buildEmptySchemaFormValues(description),
    });

    // Act: clear both.
    pressButton('Limpar Cor do colete');
    pressButton('Limpar Piloto reserva');

    // Assert: both hold null; the dropdown shows its placeholder and the switch is off.
    expect(formOnPage.readFormValues().values, 'both fields must be cleared').toEqual({
      corDoColete: null,
      pilotoReserva: null,
    });
    expect(
      screen.getByRole('combobox', { name: 'Cor do colete' }),
      'a cleared dropdown shows its placeholder',
    ).toHaveTextContent('Escolha…');
    expect(screen.getAllByText('Sem valor'), 'both cleared states must be visible').toHaveLength(2);

    // Act: choose a colour and flip the switch.
    chooseOptionInDropdown('Cor do colete', 'Laranja');
    flipSwitch('Piloto reserva');

    // Assert: both have values again.
    expect(formOnPage.readFormValues().values, 'choosing and switching are the way back').toEqual({
      corDoColete: 'laranja',
      pilotoReserva: true,
    });
  });
});

describe('error messages of a generated form', () => {
  it('shows the message under the wrong field and ties it to the control', async () => {
    // Arrange: car 42's form with the required name erased and the time mistyped.
    const formOnPage = renderLowerThirdFormForCar42();
    typeIntoField('Nome', '');
    typeIntoField('Tempo no ar', '0:8');

    // Act: check the form, as a press on "Colocar no ar" does.
    const isValid = await formOnPage.checkTheForm();

    // Assert: both fields are marked and each message is read out with its control.
    expect(isValid, 'the form must be refused').toBe(false);
    expect(screen.getByLabelText('Nome'), 'the name field must be marked invalid').toBeInvalid();
    expect(
      screen.getByLabelText('Nome'),
      'the help and the message must both be read with the name field',
    ).toHaveAccessibleDescription('Nome de quem aparece na tela. O campo "Nome" é obrigatório.');
    expect(
      screen.getByLabelText('Tempo no ar'),
      'the mm:ss message must be read with the time field',
    ).toHaveAccessibleDescription(
      'Quanto tempo a tarja fica na tela. Use minutos e segundos no formato mm:ss em "Tempo no ar", por exemplo 12:30.',
    );
    expect(
      screen.getByLabelText('Número do carro'),
      'a correct field must not be marked',
    ).toBeValid();
  });

  it('shows no message for a correct form', async () => {
    // Arrange: car 42's form, untouched.
    const formOnPage = renderLowerThirdFormForCar42();

    // Act: check the form.
    const isValid = await formOnPage.checkTheForm();

    // Assert: valid, and no field is marked.
    expect(isValid, 'what is on air must pass the form’s rules').toBe(true);
    expect(screen.getByLabelText('Nome'), 'no field is marked invalid').toBeValid();
  });
});

describe('a property key that react-hook-form would misread', () => {
  it('draws "piloto.nome" read-only and leaves the field next to it working', () => {
    // Arrange: a schema with a dotted key next to an ordinary one; react-hook-form
    // would read the dot as "nome inside piloto".
    const description = describeSchemaFormFromDataSchema({
      type: 'object',
      properties: {
        'piloto.nome': { type: 'string', title: 'Nome do piloto' },
        piloto: { type: 'string', title: 'Piloto' },
      },
    });
    const formOnPage = renderSchemaFormOnTestPage({
      description,
      formValues: buildEmptySchemaFormValues(description),
    });

    // Act: type in the ordinary field.
    typeIntoField('Piloto', 'Ana Souza');

    // Assert: the ordinary field holds a text (not an object with a "nome" inside), and
    // the dotted property is only named, with a note.
    expect(formOnPage.readFormValues().values, 'the dotted key must not reach the form').toEqual({
      piloto: 'Ana Souza',
    });
    expect(screen.getByText('Nome do piloto'), 'the dotted property is still named').toBeVisible();
    expect(
      screen.getByText('O formulário ainda não sabe editar este campo, e ele está sem valor.'),
      'and explained as not editable',
    ).toBeInTheDocument();
  });
});
