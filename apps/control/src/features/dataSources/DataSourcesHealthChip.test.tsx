/**
 * The data sources chip in the header (apps/control)
 *
 * What this module is for:
 *   On the console, the operator must notice a late feed without opening the "Fontes"
 *   page. The header carries a small chip, "Fontes: 2 ok · 1 atrasada · 1 com erro",
 *   that opens that page in a new tab, so the console stays where it is (João's ruling 2
 *   at gate 2 of PR #16). It counts only the sources that are on, by the same rule as each
 *   row's chip (a source failing for a minute is "com erro"), and is not there at all
 *   when none is on (the seeded simulator is off until someone turns it on).
 *
 * What these tests prove:
 *   - The chip counts ok, late and failing sources that are on, leaving out counts of 0,
 *     and a screen reader hears the counts in its name, not only "Saúde das fontes".
 *   - It opens the "Fontes" page in a new tab.
 *   - A late source moves from "atrasada" to "com erro" once it has failed for a minute,
 *     as time passes, with nothing new from the server; a source whose data stood still
 *     for ten minutes counts as "atrasada" at its first failure, not "com erro".
 *   - It is hidden when no source is on, and appears when one is turned on.
 *
 * What these tests deliberately do not cover:
 *   - Which status counts as what: dataSourceHealth.test.ts.
 *   - Its place in the header, and the console staying put: src/AppPages.test.tsx.
 *   - The chip's colour, a badge variant: jsdom draws nothing.
 */
import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildRehearsalReplayThatIsOk,
  buildSeededSimulatorThatIsOff,
  buildSimulatorFailingAfterItsDataStoodStillForTenMinutes,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsStale,
  buildSimulatorThatNeverHadData,
  buildSlicesWithDataSources,
  momentTheSimulatorStartedFailingMs,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesHealthChip } from './DataSourcesHealthChip';

/**
 * Makes time stand still this long after the failing simulators' first failed poll, so
 * "late" and "in error" do not depend on the day the tests run.
 */
function holdThePageClockAfterTheFailingStarted(millisecondsAfter: number): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(momentTheSimulatorStartedFailingMs + millisecondsAfter));
}

describe('the data sources chip', () => {
  it('counts the sources that are on by health, in its text and in its accessible name', () => {
    // Arrange: 40 s after the failing started, two healthy sources, one late, one that
    // never had data and one off.
    holdThePageClockAfterTheFailingStarted(40_000);
    const slices = buildSlicesWithDataSources({
      dataSources: [
        buildSimulatorThatIsOk(),
        buildRehearsalReplayThatIsOk(),
        { ...buildSimulatorThatIsStale(), id: 'simulador-falhando', label: 'Simulador falhando' },
        { ...buildSimulatorThatNeverHadData(), id: 'simulador-sem-dados', label: 'Sem dados' },
        { ...buildSeededSimulatorThatIsOff(), id: 'simulador-desligado', label: 'Desligado' },
      ],
    });

    // Act: draw the chip.
    renderOnControlPageConnectedToFakeServer(<DataSourcesHealthChip />, slices);

    // Assert: "2 ok · 1 atrasada · 1 com erro", read aloud with the counts too.
    expect(
      screen.getByRole('status', {
        name: 'Saúde das fontes de dados: 2 ok · 1 atrasada · 1 com erro',
      }),
      'a screen reader must hear the counts, not only what the chip is about',
    ).toHaveTextContent('Fontes: 2 ok · 1 atrasada · 1 com erro');
  });

  it('opens the "Fontes" page in a new tab, so the console stays where it is', () => {
    // Arrange: the simulator on and healthy.
    const slices = buildSlicesWithDataSources({ dataSources: [buildSimulatorThatIsOk()] });

    // Act: draw the chip.
    renderOnControlPageConnectedToFakeServer(<DataSourcesHealthChip />, slices);

    // Assert: a link to "#/fontes", opened in a new tab without access back to this one.
    const chipLink = screen.getByRole('link', { name: 'Fontes: 1 ok' });
    expect(chipLink, 'the chip must lead to the "Fontes" page').toHaveAttribute('href', '#/fontes');
    expect(chipLink, 'the "Fontes" page must open in a new tab').toHaveAttribute(
      'target',
      '_blank',
    );
    expect(chipLink, 'the new tab must not reach back into the console').toHaveAttribute(
      'rel',
      'noopener',
    );
  });

  it('names failing sources and leaves out the counts of zero', () => {
    // Arrange: one source that never had data, nothing else on.
    const slices = buildSlicesWithDataSources({ dataSources: [buildSimulatorThatNeverHadData()] });

    // Act: draw the chip.
    renderOnControlPageConnectedToFakeServer(<DataSourcesHealthChip />, slices);

    // Assert: only the failing count.
    expect(
      screen.getByRole('status', { name: 'Saúde das fontes de dados: 1 com erro' }),
      'a count of zero says nothing and is left out',
    ).toHaveTextContent(/^Fontes: 1 com erro$/);
  });

  it('moves a late source to "com erro" once it has failed for a minute', () => {
    // Arrange: the failing simulator, 59 s after its first failed poll: late.
    holdThePageClockAfterTheFailingStarted(59_000);
    renderOnControlPageConnectedToFakeServer(
      <DataSourcesHealthChip />,
      buildSlicesWithDataSources({ dataSources: [buildSimulatorThatIsStale()] }),
    );
    const textAt59Seconds = screen.getByRole('status').textContent;

    // Act: one more second passes, with nothing new from the server.
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    // Assert: "1 atrasada" before, "1 com erro" now.
    expect(textAt59Seconds, 'under a minute the source counts as late').toBe('Fontes: 1 atrasada');
    expect(
      screen.getByRole('status', { name: 'Saúde das fontes de dados: 1 com erro' }),
      'after a minute the header must count it as in error, as its row chip reads',
    ).toHaveTextContent(/^Fontes: 1 com erro$/);
  });

  it('counts a source whose data stood still for 10 min as late at its first failure', () => {
    // Arrange: a second after the first failed poll of a simulator whose data had stood
    // still for ten minutes.
    holdThePageClockAfterTheFailingStarted(1_000);
    const slices = buildSlicesWithDataSources({
      dataSources: [buildSimulatorFailingAfterItsDataStoodStillForTenMinutes()],
    });

    // Act: draw the chip.
    renderOnControlPageConnectedToFakeServer(<DataSourcesHealthChip />, slices);

    // Assert: "1 atrasada": it has failed for a second, not for ten minutes.
    expect(
      screen.getByRole('status', { name: 'Saúde das fontes de dados: 1 atrasada' }),
      'the header must count the minute from the first failure, as the row chip does',
    ).toHaveTextContent(/^Fontes: 1 atrasada$/);
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
      screen.getByRole('status', { name: 'Saúde das fontes de dados: 1 ok' }),
      'once a source is on, the chip reports it',
    ).toHaveTextContent('Fontes: 1 ok');
  });
});
