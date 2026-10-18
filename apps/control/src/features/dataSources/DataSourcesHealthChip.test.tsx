/**
 * The data sources chip in the header (apps/control)
 *
 * What this module is for:
 *   On the console, the operator must notice a late feed without opening the "Fontes"
 *   page. The header carries a small chip, "Fontes: 2 ok · 1 atrasada", that links to
 *   that page. It counts only the sources that are on, and is not there at all when
 *   none is on (the seeded simulator is off until someone turns it on).
 *
 * What these tests prove:
 *   - The chip counts ok, late and failing sources that are on, leaving out counts of 0.
 *   - It links to the "Fontes" page.
 *   - It is hidden when no source is on, and appears when one is turned on.
 *
 * What these tests deliberately do not cover:
 *   - Which status counts as what: dataSourceHealth.test.ts.
 *   - Its place in the header and the navigation: src/AppPages.test.tsx.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildRehearsalReplayThatIsOk,
  buildSeededSimulatorThatIsOff,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsStale,
  buildSimulatorThatNeverHadData,
  buildSlicesWithDataSources,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesHealthChip } from './DataSourcesHealthChip';

describe('the data sources chip', () => {
  it('counts the sources that are on by health and links to the "Fontes" page', () => {
    // Arrange: two healthy sources, one late and one off.
    const slices = buildSlicesWithDataSources({
      dataSources: [
        buildSimulatorThatIsOk(),
        buildRehearsalReplayThatIsOk(),
        { ...buildSimulatorThatIsStale(), id: 'simulador-falhando', label: 'Simulador falhando' },
        { ...buildSeededSimulatorThatIsOff(), id: 'simulador-desligado', label: 'Desligado' },
      ],
    });

    // Act: draw the chip.
    renderOnControlPageConnectedToFakeServer(<DataSourcesHealthChip />, slices);

    // Assert: "2 ok · 1 atrasada"; the source that is off is in no count.
    expect(
      screen.getByRole('status', { name: 'Saúde das fontes de dados' }),
      'the chip must count the sources that are on',
    ).toHaveTextContent('Fontes: 2 ok · 1 atrasada');
    expect(
      screen.getByRole('link', { name: 'Fontes: 2 ok · 1 atrasada' }),
      'the chip must take the operator to the "Fontes" page',
    ).toHaveAttribute('href', '#/fontes');
  });

  it('names failing sources and leaves out the counts of zero', () => {
    // Arrange: one source that never had data, nothing else on.
    const slices = buildSlicesWithDataSources({ dataSources: [buildSimulatorThatNeverHadData()] });

    // Act: draw the chip.
    renderOnControlPageConnectedToFakeServer(<DataSourcesHealthChip />, slices);

    // Assert: only the failing count.
    expect(
      screen.getByRole('status', { name: 'Saúde das fontes de dados' }),
      'a count of zero says nothing and is left out',
    ).toHaveTextContent(/^Fontes: 1 com erro$/);
  });

  it('is hidden while no source is on, and appears when one is turned on', () => {
    // Arrange: the seeded simulator, off.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <DataSourcesHealthChip />,
      buildSlicesWithDataSources({ dataSources: [buildSeededSimulatorThatIsOff()] }),
    );
    const isShownWhileEverythingIsOff = screen.queryByRole('status') !== null;

    // Act: another operator turns the simulator on and its first poll is good.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'dataSources',
      slice: [buildSimulatorThatIsOk()],
    });

    // Assert: hidden before, "1 ok" after.
    expect(isShownWhileEverythingIsOff, 'with every source off there is nothing to report').toBe(
      false,
    );
    expect(
      screen.getByRole('status', { name: 'Saúde das fontes de dados' }),
      'once a source is on, the chip reports it',
    ).toHaveTextContent('Fontes: 1 ok');
  });
});
