/**
 * The "Fontes de dados" page: the list of sources (apps/control)
 *
 * What this module is for:
 *   The page where the operator sees every data source the server polls (the race
 *   simulator, replays of recorded feeds) and how each is doing. Each row shows the
 *   source's label and kind, a status chip, when its last good data came and how often
 *   it is read, and its buttons.
 *
 * What these tests prove:
 *   - A row for every source, named by its label, with its kind.
 *   - The chip reads "Ok" for a healthy source; "Atrasada (há 40 s)" for a source that
 *     keeps old data while it fails, with the reason on hover or focus; "Erro" with the
 *     reason for a source that failed before it ever had data; "Desligada" for a source
 *     that is off.
 *   - The chip of a failing source turns red "Erro" by itself once a minute has passed
 *     since its last good data (João's ruling 4 at gate 2 of PR #16), its reason still in
 *     the tooltip and its last data still on screen.
 *   - "há 40 s" counts on the server's clock, so a tablet whose clock is off by half a
 *     minute still shows the true lateness.
 *   - The row says when the last good data came and how often the source is read, or
 *     that it has no data yet.
 *   - A page with no source says how to make one.
 *   - The page's tables sit in a region that scrolls sideways, so a tablet never has to
 *     scroll the whole page.
 *
 * What these tests deliberately do not cover:
 *   - The row's buttons and what they send: DataSourcesPageActions.test.tsx.
 *   - "+ Fonte" and "Editar": DataSourcesPageForms.test.tsx.
 *   - The selected source's data: DataSourcesPageDetail.test.tsx.
 *   - Colours and the tablet layout itself, checked by eye: the chip's colour is a badge
 *     variant, and jsdom draws nothing.
 *   - The hour in "Último dado": it is the operator's local time, so only the minutes and
 *     seconds are checked.
 */
import { recordServerClockSample } from '@bajaovrlay/shared/clock';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildRehearsalReplayThatIsOk,
  buildSeededSimulatorThatIsOff,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsStale,
  buildSimulatorThatNeverHadData,
  buildSlicesWithDataSources,
  momentOfTheSamplesMs,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesPage } from './DataSourcesPage';

/** Finds the row of one source in the list, by its label. */
function findRowOfSource(sourceLabel: string) {
  const sourceList = screen.getByRole('list', { name: 'Fontes de dados' });
  return within(within(sourceList).getByRole('listitem', { name: sourceLabel }));
}

/** Makes time stand still 40 seconds after the samples' last good poll. */
function holdThePageClockFortySecondsAfterTheLastGoodPoll(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(momentOfTheSamplesMs + 40_000));
}

describe('the list of sources', () => {
  it('shows a row per source with its label and kind', () => {
    // Arrange: the seeded simulator and Friday's rehearsal replay.
    const slices = buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsOk(), buildRehearsalReplayThatIsOk()],
    });

    // Act: draw the page.
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);

    // Assert: two rows, each with its kind written out.
    expect(
      screen.getByRole('heading', { name: 'Fontes de dados' }),
      'the page must be titled "Fontes de dados"',
    ).toBeInTheDocument();
    expect(
      findRowOfSource('Simulador — Enduro').getByText('Simulador'),
      'the simulator row must say its kind',
    ).toBeInTheDocument();
    expect(
      findRowOfSource('Ensaio de sexta').getByText('Reprodução'),
      'the replay row must say its kind',
    ).toBeInTheDocument();
  });

  it('says how to make a source when there is none', () => {
    // Arrange: a server with every source deleted.
    const slices = buildSlicesWithDataSources({ dataSources: [] });

    // Act: draw the page.
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);

    // Assert: the hint, and "+ Fonte".
    expect(
      screen.getByText('Nenhuma fonte. Use "+ Fonte" para criar a primeira.'),
      'an empty list must say how to make the first source',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ Fonte' }),
      'the page must offer "+ Fonte"',
    ).toBeInTheDocument();
  });
});

describe('the status chip of a source', () => {
  it('reads "Ok" for a healthy source, with its last good data and its interval', () => {
    // Arrange: the simulator on, its last poll good.
    const slices = buildSlicesWithDataSources({ dataSources: [buildSimulatorThatIsOk()] });

    // Act: draw the page.
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);

    // Assert: "Ok", the time of the last good data and "every 2 s".
    const simulatorRow = findRowOfSource('Simulador — Enduro');
    expect(simulatorRow.getByText('Ok'), 'a healthy source must read "Ok"').toBeInTheDocument();
    expect(
      simulatorRow.getByText(/^Último dado: \d{2}:44:00$/),
      'the row must say when the last good data came, in the local time of day',
    ).toBeInTheDocument();
    expect(
      simulatorRow.getByText('Leitura a cada 2 s'),
      'the row must say how often the source is read',
    ).toBeInTheDocument();
  });

  it('reads "Atrasada" with the time since the last good data for a failing source, the reason on hover', () => {
    // Arrange: 40 s after its last good poll, the simulator with "Falha simulada" on.
    holdThePageClockFortySecondsAfterTheLastGoodPoll();
    const slices = buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsStale()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    });

    // Act: draw the page.
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);

    // Assert: late for 40 s, and the server's reason ready in a tooltip.
    const simulatorRow = findRowOfSource('Simulador — Enduro');
    expect(
      simulatorRow.getByText('Atrasada (há 40 s)'),
      'a failing source that keeps its data must read "Atrasada" with how long ago the data came',
    ).toBeInTheDocument();
    expect(
      simulatorRow.getByRole('tooltip'),
      'the reason of the failure must be in the tooltip, in the server words',
    ).toHaveTextContent('Falha simulada.');
  });

  it('turns red "Erro" once the source has failed for a minute, keeping its reason and its data', () => {
    // Arrange: 59 s after its last good poll, the simulator with "Falha simulada" on.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(momentOfTheSamplesMs + 59_000));
    const slices = buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsStale()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    });
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);
    const simulatorRow = findRowOfSource('Simulador — Enduro');
    const isAmberAt59Seconds = simulatorRow.queryByText('Atrasada (há 59 s)') !== null;

    // Act: one more second passes, with nothing new from the server.
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    // Assert: amber before, red "Erro" now, the reason still in the tooltip, and the last
    // data still on screen under its banner (rule 4).
    expect(isAmberAt59Seconds, 'under a minute the source must still read "Atrasada"').toBe(true);
    expect(
      simulatorRow.getByText('Erro'),
      'after failing for a minute the chip must turn red "Erro" without a word from the server',
    ).toBeInTheDocument();
    expect(
      simulatorRow.getByRole('tooltip'),
      'the reason of the failure must stay in the tooltip',
    ).toHaveTextContent('Falha simulada.');
    expect(
      screen.getByText(/^Dados de \d{2}:44:00 — fonte atrasada$/),
      'the last data must stay on screen, marked as old',
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Posições' })).getAllByRole('row'),
      'the positions must stay on screen in full',
    ).toHaveLength(61);
  });

  it("counts the time since the last good data on the server's clock, not the tablet's", () => {
    // Arrange: the tablet's clock 30 s ahead of the server's: 40 s after the last good
    // poll on the tablet, only 10 s on the server.
    holdThePageClockFortySecondsAfterTheLastGoodPoll();
    recordServerClockSample(momentOfTheSamplesMs + 10_000, momentOfTheSamplesMs + 40_000);
    const slices = buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsStale()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    });

    // Act: draw the page.
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);

    // Assert: 10 s late, as the server counts it.
    expect(
      findRowOfSource('Simulador — Enduro').getByText('Atrasada (há 10 s)'),
      'the lateness must be counted on the server clock, which stamped the last good data',
    ).toBeInTheDocument();
  });

  it('reads "Erro" with the reason for a source that failed before it ever had data', () => {
    // Arrange: the simulator timing out since it was turned on.
    const slices = buildSlicesWithDataSources({ dataSources: [buildSimulatorThatNeverHadData()] });

    // Act: draw the page.
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);

    // Assert: "Erro", the reason in the tooltip, and no data yet.
    const simulatorRow = findRowOfSource('Simulador — Enduro');
    expect(
      simulatorRow.getByText('Erro'),
      'a source with no data that fails must read "Erro"',
    ).toBeInTheDocument();
    expect(
      simulatorRow.getByRole('tooltip'),
      'the reason must be in the tooltip',
    ).toHaveTextContent('Tempo esgotado: a fonte não respondeu em 2 s.');
    expect(
      simulatorRow.getByText('Ainda sem dados'),
      'the row must say the source never had good data',
    ).toBeInTheDocument();
  });

  it('reads "Desligada" for a source that is off', () => {
    // Arrange: the seeded simulator, never turned on.
    const slices = buildSlicesWithDataSources({ dataSources: [buildSeededSimulatorThatIsOff()] });

    // Act: draw the page.
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);

    // Assert: "Desligada" and no tooltip at all.
    const simulatorRow = findRowOfSource('Simulador — Enduro');
    expect(
      simulatorRow.getByText('Desligada'),
      'a source that is off must read "Desligada"',
    ).toBeInTheDocument();
    expect(
      simulatorRow.queryByRole('tooltip'),
      'a source that is off has no failure to explain',
    ).not.toBeInTheDocument();
  });
});

describe('the layout of the page on a narrow screen', () => {
  it('puts every table in a region that scrolls sideways', () => {
    // Arrange: the simulator with the enduro at lap 34.
    const slices = buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    });

    // Act: draw the page.
    renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, slices);

    // Assert: both tables sit directly in a box that scrolls sideways on its own.
    const tables = screen.getAllByRole('table');
    expect(tables, 'the positions and standings tables must be drawn').toHaveLength(2);
    for (const table of tables) {
      expect(
        table.parentElement,
        'on a tablet a wide table must scroll inside its own box, not stretch the page',
      ).toHaveClass('overflow-x-auto');
    }
  });
});
