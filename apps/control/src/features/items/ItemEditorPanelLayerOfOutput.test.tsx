/**
 * The item editor's "Camada" with more than one output (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-49 a layer belongs to an output, and two outputs may both have a
 *   layer called "Legenda". The editor's "Camada" groups the layers by output, program
 *   first, so the operator knows which OBS source an item goes to. A graphic whose
 *   default layer was deleted on "Saídas e camadas" brings no layer with it: "Camada"
 *   stays empty and must be chosen.
 *
 * What these tests prove:
 *   - With program and PiP, "Camada" lists two groups, "Saída Programa" then "Saída PiP",
 *     each with its layers bottom to top, and a PiP layer can be chosen.
 *   - Choosing a graphic whose default layer no longer exists leaves "Camada" empty and
 *     says "Escolha a camada.".
 *   - With program alone, "Camada" lists the layers with no group, as it always did.
 *
 * What these tests deliberately do not cover:
 *   - Saving the layer; ItemEditorPanelLayerChange.test.tsx.
 *   - The macro step's layer picker, which draws the same options; MacroEditorPanel tests.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildSlicesWithThePipOutput } from '@/state/outputsLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  chooseGraphicInTheEditor,
  raceClockGraphicName,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';

/** Opens the editor's "Camada" dropdown. */
function openTheLayerDropdown(): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Camada' }), { key: 'Enter' });
}

/** The option names of one group of the open dropdown. */
function readOptionNamesOfGroup(groupName: string): string[] {
  const group = screen.getByRole('group', { name: groupName });
  return within(group)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

describe('"Camada" with program and PiP', () => {
  it('groups the layers by output, program first, and offers the PiP layers', () => {
    // Arrange: a new item, program and PiP.
    renderItemEditorPanelOnFakeServerWithSlices(null, buildSlicesWithThePipOutput());
    chooseGraphicInTheEditor(raceClockGraphicName);

    // Act: open "Camada" and choose the PiP's caption.
    openTheLayerDropdown();
    const groupNames = screen.getAllByRole('group').map((group) => group.textContent ?? '');
    const programOptions = readOptionNamesOfGroup('Saída Programa');
    const pipOptions = readOptionNamesOfGroup('Saída PiP');
    fireEvent.click(screen.getByRole('option', { name: 'Legenda' }));

    // Assert: two groups in order, their layers, and the caption chosen.
    expect(groupNames.length, 'one group per output').toBe(2);
    expect(programOptions, "program's layers, bottom to top").toEqual([
      'Logo',
      'Letreiro',
      'Relógio',
      'Torre',
      'Tarja',
      'Tela cheia',
    ]);
    expect(pipOptions, "the PiP's layers, bottom to top").toEqual(['Moldura', 'Legenda']);
    expect(
      screen.getByRole('combobox', { name: 'Camada' }),
      'the caption is the chosen layer',
    ).toHaveTextContent('Legenda');
  });
});

describe('a graphic whose default layer was deleted', () => {
  it('leaves "Camada" empty and asks for it', async () => {
    // Arrange: program without its clock layer, so the race clock's default is gone.
    const slices = buildSlicesWithThePipOutput();
    slices.layers = slices.layers.filter((layer) => layer.id !== 'clock');
    renderItemEditorPanelOnFakeServerWithSlices(null, slices);

    // Act: choose the race clock.
    chooseGraphicInTheEditor(raceClockGraphicName);

    // Assert: no layer chosen, and the editor says one must be.
    expect(
      screen.getByRole('combobox', { name: 'Camada' }),
      'no layer is chosen for the operator',
    ).not.toHaveTextContent('Relógio');
    expect(
      await screen.findByText('Escolha a camada.'),
      'the editor asks for a layer',
    ).toBeInTheDocument();
  });
});

describe('"Camada" with program alone', () => {
  it('lists the layers with no group', () => {
    // Arrange: a new item, program alone.
    renderItemEditorPanelOnFakeServerWithSlices(null, buildSlicesWithNothingOnAir());
    chooseGraphicInTheEditor(raceClockGraphicName);

    // Act: open "Camada".
    openTheLayerDropdown();

    // Assert: the six layers, and no group.
    expect(screen.queryAllByRole('group'), 'no group with one output').toEqual([]);
    expect(screen.getAllByRole('option'), 'the six layers').toHaveLength(6);
  });
});
