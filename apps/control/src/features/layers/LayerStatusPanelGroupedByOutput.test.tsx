/**
 * Camadas grouped by output (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-49 a show may have more than one output: program (OBS's main source)
 *   and, for instance, a PiP output for the scene with the camera box. Camadas then
 *   groups its rows by output: "Programa" first and always open, each other output in a
 *   group the operator can fold away. With program alone it looks as it always did.
 *
 * What these tests prove:
 *   - With program and PiP, the rows come in two groups, program's first, each bottom to
 *     top, and a clock on air on the PiP's caption shows on the caption's row.
 *   - The PiP's group starts open and folds away with a click on its name.
 *   - With program alone there is no group heading at all.
 *
 * What these tests deliberately do not cover:
 *   - Each row's buttons, which are the same on every output; the other
 *     LayerStatusPanel*.test.tsx files.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithThePipOutput } from '@/state/outputsLikeTheServerSends.testSupport';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

/** The row names of one output's group, top of the panel first. */
function readRowNamesOfGroup(outputName: string): (string | null)[] {
  const group = screen.getByRole('group', { name: `Saída ${outputName}` });
  return within(group)
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('aria-label'));
}

describe('Camadas with a PiP output', () => {
  it("groups the rows by output, program's first, and shows what is on the PiP", () => {
    // Arrange: program and PiP, with the race clock on air on the PiP's caption.
    const slices = buildSlicesWithThePipOutput();
    slices.instances = [
      {
        ...buildRaceClockInstanceOnTheClockLayer('2026-10-25T14:00:00.000Z'),
        layerId: 'legenda-pip',
      },
    ];

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: two groups in order, each bottom to top, and the caption's row shows the clock.
    expect(
      screen.getAllByRole('group').map((group) => group.getAttribute('aria-label')),
      'program first, then PiP',
    ).toEqual(['Saída Programa', 'Saída PiP']);
    expect(readRowNamesOfGroup('Programa'), "program's rows").toEqual([
      'Logo',
      'Letreiro',
      'Relógio',
      'Torre',
      'Tarja',
      'Tela cheia',
    ]);
    expect(readRowNamesOfGroup('PiP'), "the PiP's rows").toEqual(['Moldura', 'Legenda']);
    const captionRow = within(screen.getByRole('listitem', { name: 'Legenda' }));
    expect(
      captionRow.getByText('Relógio de prova'),
      "the caption's row names the graphic on it",
    ).toBeInTheDocument();
  });

  it("starts with the PiP's group open, and folds it away with a click on its name", () => {
    // Arrange: program and PiP.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, buildSlicesWithThePipOutput());
    const pipGroup = screen.getByRole('group', { name: 'Saída PiP' });
    const isOpenAtFirst = pipGroup.hasAttribute('open');

    // Act: click the group's name.
    fireEvent.click(within(pipGroup).getByText('PiP'));

    // Assert: open at first, folded after the click.
    expect(isOpenAtFirst, 'the operator must see every output at first').toBe(true);
    expect(pipGroup.hasAttribute('open'), 'the click folds the group away').toBe(false);
  });
});

describe('Camadas with program alone', () => {
  it('shows no group heading', () => {
    // Arrange and act: the panel with the program output only.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, buildSlicesWithNothingOnAir());

    // Assert: no group; the rows are as they always were.
    expect(screen.queryAllByRole('group'), 'no group with one output').toEqual([]);
    expect(screen.getAllByRole('listitem'), 'the six rows').toHaveLength(6);
  });
});
