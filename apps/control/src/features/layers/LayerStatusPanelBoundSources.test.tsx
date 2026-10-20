/**
 * Camadas rows of graphics that read a source (apps/control)
 *
 * What this module is for:
 *   The state of every layer is visible at all times (concept §7 rule 4), the state of
 *   its source included. A row whose instance has live bindings on a source that is late
 *   or failing carries a chip, by the "Fontes" page's health rule (PR #16): "fonte
 *   atrasada" (amber) under a minute of failing, "fonte com erro" (red) after; "fonte
 *   excluída" once the source was deleted, its last data still on air; "fonte desligada"
 *   once it was switched off, its last data still on air (gate 2 of PR #18). A row whose
 *   bound value a correction changed carries "valor corrigido", and one whose last
 *   refresh the graphic refused in part or in whole carries "atualização recusada", the
 *   refused fields in its tooltip (gate 2 of PR #18). Nothing on air ever blanks.
 *
 * What these tests prove:
 *   - Each chip appears for its case, row by row, and a healthy source with no
 *     correction shows none of them.
 *   - The refused chip names the refused fields by their titles.
 *
 * What these tests deliberately do not cover:
 *   - The health rule itself, minute by minute; dataSourceHealth.test.ts.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildSessionNameCorrection,
  buildSlicesWithTheBoundRaceClockOnAir,
} from '@/state/boundInstancesLikeTheServerSends.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSeededSimulatorThatIsOff,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsStale,
  momentTheSimulatorStartedFailingMs,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

/** The bound clock on air whose last refresh had its title refused by the graphic. */
function buildSlicesWithTheTitleRefused() {
  const slices = buildSlicesWithTheBoundRaceClockOnAir({});
  return {
    ...slices,
    instanceBindings: slices.instanceBindings.map((entry) => ({
      ...entry,
      refusedFieldKeys: ['sessionName'],
    })),
  };
}

const allChipTexts = [
  'fonte atrasada',
  'fonte com erro',
  'fonte excluída',
  'fonte desligada',
  'valor corrigido',
  'atualização recusada',
];

const chipScenarios = [
  // 40 s of failing: keep an eye on it.
  {
    name: 'shows "fonte atrasada" while the source has failed for under a minute',
    millisecondsAfterTheFailingStarted: 40_000,
    slices: buildSlicesWithTheBoundRaceClockOnAir({ dataSources: [buildSimulatorThatIsStale()] }),
    expectedChips: ['fonte atrasada'],
  },
  // 90 s of failing: the operator must act.
  {
    name: 'shows "fonte com erro" once the source has failed for a minute',
    millisecondsAfterTheFailingStarted: 90_000,
    slices: buildSlicesWithTheBoundRaceClockOnAir({ dataSources: [buildSimulatorThatIsStale()] }),
    expectedChips: ['fonte com erro'],
  },
  // Deleted while the clock was on air: its refreshes stopped, its data stays.
  {
    name: 'shows "fonte excluída" when the source was deleted',
    millisecondsAfterTheFailingStarted: 0,
    slices: buildSlicesWithTheBoundRaceClockOnAir({ dataSources: [] }),
    expectedChips: ['fonte excluída'],
  },
  // Switched off on "Fontes": nothing refreshes the clock any more, its data stays.
  {
    name: 'shows "fonte desligada" when the source was switched off',
    millisecondsAfterTheFailingStarted: 0,
    slices: buildSlicesWithTheBoundRaceClockOnAir({
      dataSources: [buildSeededSimulatorThatIsOff()],
    }),
    expectedChips: ['fonte desligada'],
  },
  // The graphic refused the title the source sent; the flag and clock went on.
  {
    name: 'shows "atualização recusada" when the last refresh was refused in part',
    millisecondsAfterTheFailingStarted: 0,
    slices: buildSlicesWithTheTitleRefused(),
    expectedChips: ['atualização recusada'],
  },
  // The session name on air is the operator's correction.
  {
    name: 'shows "valor corrigido" when a correction changed a bound value',
    millisecondsAfterTheFailingStarted: 0,
    slices: buildSlicesWithTheBoundRaceClockOnAir({ overrides: [buildSessionNameCorrection()] }),
    expectedChips: ['valor corrigido'],
  },
  // All is well: no chip about the source.
  {
    name: 'shows none of them for a healthy source with no correction',
    millisecondsAfterTheFailingStarted: 0,
    slices: buildSlicesWithTheBoundRaceClockOnAir({ dataSources: [buildSimulatorThatIsOk()] }),
    expectedChips: [],
  },
];

describe('the Camadas row of a bound instance', () => {
  it.each(chipScenarios)(
    '$name',
    ({ millisecondsAfterTheFailingStarted, slices, expectedChips }) => {
      // Arrange: the page clock that many seconds after the simulator started failing.
      vi.useFakeTimers();
      vi.setSystemTime(
        new Date(momentTheSimulatorStartedFailingMs + millisecondsAfterTheFailingStarted),
      );

      // Act: draw the layers.
      renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

      // Assert: exactly the chips of this row on the clock's row.
      const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
      const chipsAboutTheSource = allChipTexts.filter(
        (chipText) => clockRow.queryByText(chipText) !== null,
      );
      expect(chipsAboutTheSource, 'the row must carry exactly these chips').toEqual(expectedChips);
    },
  );
});

describe('the "atualização recusada" chip', () => {
  it('names the refused fields by their titles in its tooltip', () => {
    // Arrange and act: the clock whose title was refused, drawn in Camadas.
    renderOnControlPageConnectedToFakeServer(
      <LayerStatusPanel />,
      buildSlicesWithTheTitleRefused(),
    );

    // Assert: the tooltip says which field kept its old value.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('atualização recusada'),
      'the operator must see which field the graphic refused',
    ).toHaveAttribute('title', 'O gráfico recusou o valor da fonte para: Título');
  });
});
