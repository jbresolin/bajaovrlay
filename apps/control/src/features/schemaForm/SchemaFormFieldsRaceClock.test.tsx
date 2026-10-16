/**
 * The race clock's form, generated from its real manifest (apps/control)
 *
 * What this module is for:
 *   The race clock used to have a form written by hand, field by field. That form is
 *   deleted: SchemaFormFields now draws the race clock from
 *   packages/graphics/race-clock/race-clock.ograf.json like any other graphic.
 *
 * What these tests prove:
 *   - The generated form has the same six operator fields the hand-written one had
 *     (session name, flag, clock mode, reference time as mm:ss, running, laps), opening
 *     with the same defaults.
 *   - It also shows the wall-clock reference with its kind selector, set to "filled by
 *     the server" with a note in place of a control.
 *   - Choosing "Valor digitado" in the kind selector brings a number input, and the
 *     change counts as a changed field.
 *   - The flag and clock mode dropdowns offer the manifest's pt-BR labels.
 *
 * What these tests deliberately do not cover:
 *   - The commands built from this form: takeAndUpdateFromSchemaForm.test.ts and
 *     itemFieldsFromSchemaForm.test.ts.
 *   - The panels that put the form on the page ("Edição rápida", the item editor).
 *   - The wording of the manifest's titles: the labels of the three number fields are
 *     read from the manifest itself, so a reworded title does not break these tests.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  chooseOptionInDropdown,
  renderSchemaFormOnTestPage,
} from './schemaFormOnTestPage.testSupport';

// The titles the manifest gives its three number fields, read from the manifest so the
// tests follow it if the wording changes.
const referenceTimeLabel = raceClockManifest.schema.properties.referenceTimeMs.title;
const referenceMomentLabel = raceClockManifest.schema.properties.referenceWallClockMs.title;
const lapsLabel = raceClockManifest.schema.properties.lapsCompletedByLeader.title;

/** Draws the race clock's generated form as it opens for a new item or an empty stage. */
function renderEmptyRaceClockForm() {
  const description = describeSchemaFormFromDataSchema(raceClockManifest.schema);
  return renderSchemaFormOnTestPage({
    description,
    formValues: buildEmptySchemaFormValues(description),
  });
}

describe('the race clock form generated from its manifest', () => {
  it('opens with the six operator fields at the manifest defaults', () => {
    // Arrange: nothing beyond the manifest itself.

    // Act: draw the form.
    renderEmptyRaceClockForm();

    // Assert: the six fields of the deleted hand-written form, with the same defaults.
    expect(
      screen.getByLabelText('Título'),
      'the session name must start as the manifest default',
    ).toHaveValue('Enduro de Resistência');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the flag must start as "Pré-largada"',
    ).toHaveTextContent('Pré-largada');
    expect(
      screen.getByRole('combobox', { name: 'Modo do relógio' }),
      'the clock mode must start as "Tempo decorrido"',
    ).toHaveTextContent('Tempo decorrido');
    expect(
      screen.getByLabelText(referenceTimeLabel),
      'the reference time must be typed as mm:ss and start at zero',
    ).toHaveValue('0:00');
    expect(
      screen.getByLabelText(referenceTimeLabel),
      'the reference time field must hint at its format',
    ).toHaveAttribute('placeholder', 'mm:ss');
    expect(
      screen.getByRole('switch', { name: 'Relógio correndo' }),
      'the clock must start stopped',
    ).not.toBeChecked();
    expect(screen.getByLabelText(lapsLabel), 'the laps must start blank').toHaveValue(null);
    expect(
      screen.getByRole('button', { name: `Limpar ${lapsLabel}` }),
      'the laps are the one optional field, so they alone can be cleared',
    ).toBeInTheDocument();
  });

  it('shows the wall-clock reference as "filled by the server", with a note and no input', () => {
    // Arrange: nothing beyond the manifest itself.

    // Act: draw the form.
    renderEmptyRaceClockForm();

    // Assert: a kind selector on that field only, the pt-BR note, and nothing to type.
    expect(
      screen.getByRole('combobox', { name: `Como preencher ${referenceMomentLabel}` }),
      'the kind selector must say the server fills the field',
    ).toHaveTextContent('Momento da entrada no ar');
    expect(
      screen.getByText('Preenchido pelo servidor no momento em que entra no ar.'),
      'the note must stand where the control would be',
    ).toBeInTheDocument();
    expect(
      screen.queryAllByRole('spinbutton'),
      'only the laps have a number input while the server fills the reference',
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('combobox'),
      'there are three dropdowns: flag, clock mode and the one kind selector',
    ).toHaveLength(3);
  });

  it('brings a number input when the kind is changed to "Valor digitado"', () => {
    // Arrange: the form as it opens.
    const formOnPage = renderEmptyRaceClockForm();

    // Act: choose "Valor digitado" for the wall-clock reference.
    chooseOptionInDropdown(`Como preencher ${referenceMomentLabel}`, 'Valor digitado');

    // Assert: the note gives way to a number input, and the field counts as changed.
    expect(
      screen.queryByText('Preenchido pelo servidor no momento em que entra no ar.'),
      'the note must go once the operator types the value',
    ).toBeNull();
    expect(
      screen.getByLabelText(referenceMomentLabel),
      'the reference must now be a number input holding the manifest default',
    ).toHaveValue(0);
    expect(
      formOnPage.readFormValues().kinds.referenceWallClockMs,
      'the form must hold the chosen kind',
    ).toBe('literal');
    expect(
      formOnPage.readDirtyFields().kinds?.referenceWallClockMs,
      'changing a field’s kind must make that field dirty',
    ).toBe(true);
  });

  it('offers the six flags and two clock modes under the manifest’s labels', () => {
    // Arrange: the form as it opens.
    renderEmptyRaceClockForm();

    // Act: open the flag dropdown and read its options, then the same for the clock mode.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Bandeira' }), { key: 'Enter' });
    const flagOptions = screen.getAllByRole('option').map((option) => option.textContent);
    fireEvent.click(screen.getByRole('option', { name: 'Verde' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Modo do relógio' }), { key: 'Enter' });
    const clockModeOptions = screen.getAllByRole('option').map((option) => option.textContent);

    // Assert: the labels are the manifest's pt-BR ones, in its order.
    expect(flagOptions, 'the flags must be offered by name').toEqual([
      'Pré-largada',
      'Verde',
      'Amarela',
      'Vermelha',
      'Quadriculada',
      'Encerrada',
    ]);
    expect(clockModeOptions, 'the clock modes must be offered by name').toEqual([
      'Tempo decorrido',
      'Tempo restante',
    ]);
  });
});
