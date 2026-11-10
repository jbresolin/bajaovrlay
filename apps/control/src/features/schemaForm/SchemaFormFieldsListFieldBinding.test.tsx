/**
 * The generated form of a graphic with a list field, a dropdown and switches (apps/control)
 *
 * What this module is for:
 *   The positions tower (BAJAOVRLAY-21) is the first graphic whose data is a whole list
 *   read from a source: its cars are an array, its layout an enum and its columns
 *   booleans. The brief's check (section D) is that the control page needs no code for
 *   it: SchemaFormFields draws the list with "Fonte", the dropdown with the manifest's
 *   labels and the switches with their titles, from the manifest alone.
 *
 * What these tests prove:
 *   - The list of cars gets a kind selector offering "Valor como está" and "Fonte".
 *   - Once "Fonte" is chosen, the paths offered hold the whole positions list
 *     ("Posições › Lista completa") and none of the single-car values, and with the
 *     simulator chosen the line under the binding counts the cars it would get now.
 *   - With the first N cars chosen as the transform, a second transform is offered
 *     ("Com logos das equipes"), and with n = 3 the line counts the podium's three cars.
 *   - Changing the first transform clears the second, so none is left hidden and saved.
 *   - The layout dropdown opens on "Compacta" and offers "Compacta" and "Detalhada".
 *   - Each column switch is drawn under its title, on or off as the manifest's default.
 *
 * What these tests deliberately do not cover:
 *   - Which paths fit which field, row by row: bindingChoices.test.ts.
 *   - The item editor around the form, and the pre-filled "Fonte" from the manifest's
 *     suggestion: ItemEditorPanelSuggestedBinding.test.tsx.
 *   - The real tower's manifest: the schema here is a fixture written like it.
 */
import { resolveBindingAgainstSources } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { describePositionsTowerFixtureForm } from './positionsTowerFixtureSchema.testSupport';
import {
  chooseOptionInDropdown,
  renderSchemaFormOnTestPage,
} from './schemaFormOnTestPage.testSupport';

/** Draws the tower's empty form on a page that knows the simulator and its lap-34 data. */
function renderEmptyTowerFormWithTheSimulator() {
  const description = describePositionsTowerFixtureForm();
  const simulator = buildSimulatorThatIsOk();
  return renderSchemaFormOnTestPage({
    description,
    formValues: buildEmptySchemaFormValues(description),
    bindingOptions: {
      dataSources: [{ id: simulator.id, label: simulator.label }],
      readValueNow: (binding) =>
        resolveBindingAgainstSources(
          binding,
          {
            dataSources: [simulator],
            dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
            overrides: [],
            bracketMatchFocuses: [],
          },
          { teams: [] },
        ),
      // The data of this page never changes, so there is nothing to be told of.
      subscribeToValuesNow: () => () => undefined,
    },
  });
}

/** The options a dropdown offers, by its accessible name, as the operator reads them. */
function readOptionsOfDropdown(dropdownName: string): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  const optionNames = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getAllByRole('option')[0] ?? document.body, { key: 'Escape' });
  return optionNames;
}

describe('the list of cars of the tower form', () => {
  it('offers "Valor como está" and "Fonte" in its kind selector', () => {
    // Arrange: the tower's empty form.
    renderEmptyTowerFormWithTheSimulator();

    // Act: read the kinds offered for the cars.
    const kindsOfTheCars = readOptionsOfDropdown('Como preencher Carros');

    // Assert: the list can stay as it is or read a source.
    expect(kindsOfTheCars, 'a list field is kept as it is or read from a source').toEqual([
      'Valor como está',
      'Fonte',
    ]);
  });

  it('offers the whole positions list as a path once "Fonte" is chosen, and no single car value', () => {
    // Arrange: the cars set to read a source.
    renderEmptyTowerFormWithTheSimulator();
    chooseOptionInDropdown('Como preencher Carros', 'Fonte');

    // Act: read the paths offered.
    const pathsOffered = readOptionsOfDropdown('O que Carros lê da fonte');

    // Assert: the whole list fits a list field; one car's team name does not.
    expect(pathsOffered, 'the whole positions list fits the cars').toContain(
      'Posições › Lista completa',
    );
    expect(pathsOffered, 'a single value does not fit a list').not.toContain(
      'Posições › 1º colocado › Equipe',
    );
  });

  it('counts the cars it would get now once the simulator and the whole list are chosen', () => {
    // Arrange: the cars set to read a source.
    renderEmptyTowerFormWithTheSimulator();
    chooseOptionInDropdown('Como preencher Carros', 'Fonte');

    // Act: choose the simulator and its whole positions list.
    chooseOptionInDropdown('Fonte de Carros', 'Simulador — Enduro');
    chooseOptionInDropdown('O que Carros lê da fonte', 'Posições › Lista completa');

    // Assert: the line under the binding counts the 60 cars of the lap-34 sample.
    expect(
      screen.getByText('Valor agora: lista com 60 entradas'),
      'the value of now must count the cars of the simulator',
    ).toBeVisible();
  });
});

describe('the second transform of the list of cars (BAJAOVRLAY-47)', () => {
  it('offers withTeamLogos once topN is chosen, and nothing before', () => {
    // Arrange: the cars reading the simulator's whole positions list.
    renderEmptyTowerFormWithTheSimulator();
    chooseOptionInDropdown('Como preencher Carros', 'Fonte');
    chooseOptionInDropdown('Fonte de Carros', 'Simulador — Enduro');
    chooseOptionInDropdown('O que Carros lê da fonte', 'Posições › Lista completa');
    const isOfferedBeforeAFirst =
      screen.queryByRole('combobox', { name: 'Segunda transformação de Carros' }) !== null;

    // Act: choose the first N cars as the first transform.
    chooseOptionInDropdown('Transformação de Carros', 'Primeiras N entradas');
    const secondTransformsOffered = readOptionsOfDropdown('Segunda transformação de Carros');

    // Assert: no second transform before a first; then "Nenhuma" or the logos.
    expect(isOfferedBeforeAFirst, 'a second transform needs a first').toBe(false);
    expect(secondTransformsOffered, 'the logos may follow the first N cars').toEqual([
      'Nenhuma',
      'Com logos das equipes',
    ]);
  });

  it('counts the three cars it would get now with topN 3 then the logos', () => {
    // Arrange: the cars reading the whole positions list through the first N cars.
    renderEmptyTowerFormWithTheSimulator();
    chooseOptionInDropdown('Como preencher Carros', 'Fonte');
    chooseOptionInDropdown('Fonte de Carros', 'Simulador — Enduro');
    chooseOptionInDropdown('O que Carros lê da fonte', 'Posições › Lista completa');
    chooseOptionInDropdown('Transformação de Carros', 'Primeiras N entradas');

    // Act: type 3 and choose the logos as the second transform.
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Parâmetro da transformação de Carros' }),
      {
        target: { value: '3' },
      },
    );
    chooseOptionInDropdown('Segunda transformação de Carros', 'Com logos das equipes');

    // Assert: the line under the binding reads the podium's three cars.
    expect(
      screen.getByText('Valor agora: lista com 3 entradas'),
      'both transforms must run for the value of now',
    ).toBeVisible();
  });
});

describe('changing the first transform of the list of cars', () => {
  it('clears the second transform, so none is left hidden and saved', () => {
    // Arrange: the cars through the first N cars, then the logos.
    renderEmptyTowerFormWithTheSimulator();
    chooseOptionInDropdown('Como preencher Carros', 'Fonte');
    chooseOptionInDropdown('Fonte de Carros', 'Simulador — Enduro');
    chooseOptionInDropdown('O que Carros lê da fonte', 'Posições › Lista completa');
    chooseOptionInDropdown('Transformação de Carros', 'Primeiras N entradas');
    chooseOptionInDropdown('Segunda transformação de Carros', 'Com logos das equipes');

    // Act: change the first transform to the logos.
    chooseOptionInDropdown('Transformação de Carros', 'Com logos das equipes');

    // Assert: the second transform is back to "Nenhuma" (gate 2 of PR #27), and the line
    // under the binding reads the whole list, the logos alone.
    expect(
      screen.getByRole('combobox', { name: 'Segunda transformação de Carros' }),
      'a changed first transform must clear the second',
    ).toHaveTextContent('Nenhuma');
    expect(
      screen.getByText('Valor agora: lista com 60 entradas'),
      'the logos alone keep every car',
    ).toBeVisible();
  });
});

describe('the layout and the column switches of the tower form', () => {
  it('opens the layout on "Compacta" and offers the two layouts under the manifest labels', () => {
    // Arrange: the tower's empty form.
    renderEmptyTowerFormWithTheSimulator();

    // Act: read what the layout shows and offers.
    const layoutShown = screen.getByRole('combobox', { name: 'Leiaute' }).textContent;
    const layoutsOffered = readOptionsOfDropdown('Leiaute');

    // Assert: the manifest's default, and its pt-BR labels in its order.
    expect(layoutShown, 'the layout must start at the manifest default').toBe('Compacta');
    expect(layoutsOffered, 'the layouts must be offered by their labels').toEqual([
      'Compacta',
      'Detalhada',
    ]);
  });

  const columnSwitches = [
    // A column the design shows by default.
    { title: 'Mostrar diferença para o líder', isOnByDefault: true },
    // Another column on by default, to show every switch follows its own default.
    { title: 'Mostrar intervalo', isOnByDefault: true },
    // The pit stops column, titled with the design's word.
    { title: 'Paradas', isOnByDefault: true },
    // The one column the design hides by default.
    { title: 'Abastecimentos', isOnByDefault: false },
  ];

  it.each(columnSwitches)(
    'draws the switch "$title" at its default',
    ({ title, isOnByDefault }) => {
      // Arrange: the tower's empty form.
      renderEmptyTowerFormWithTheSimulator();

      // Act: find the switch by its title.
      const columnSwitch = screen.getByRole('switch', { name: title });

      // Assert: it is on or off as the manifest's default says.
      if (isOnByDefault) {
        expect(columnSwitch, `"${title}" must start on, as its default says`).toBeChecked();
      } else {
        expect(columnSwitch, `"${title}" must start off, as its default says`).not.toBeChecked();
      }
    },
  );
});
