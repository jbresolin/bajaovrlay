/**
 * The "Fontes de dados" page: the selected source's data (apps/control)
 *
 * What this module is for:
 *   Beside the list, the page shows the latest data of the selected source (the first
 *   one until the operator picks another), readably: a positions table, a standings
 *   table, the session card, a banner when the data is late, and the raw JSON behind a
 *   toggle. This is how the operator checks a feed before any graphic uses it.
 *
 * What these tests prove:
 *   - The positions table has a row per car (60), each with its place, car, team,
 *     school, laps, last and best lap, gap and status; a lapped car's gap reads in laps
 *     and the retired car says so.
 *   - The standings table lists the teams by rank with their points.
 *   - A late source shows "Dados de hh:mm:ss — fonte atrasada" above its data, which is
 *     still shown in full; a healthy one shows no banner.
 *   - A source turned off shows "Dados de hh:mm:ss — fonte desligada" above the data it
 *     kept, and its session clock is held instead of counting as if live.
 *   - "Exibir JSON" shows the raw data, and "Ocultar JSON" hides it again.
 *
 * What these tests deliberately do not cover:
 *   - The session card and its live clock: SessionCard.test.tsx.
 *   - Lap time and gap text in every case: timingScreenText.test.ts.
 *   - The hour in the banner, which is the operator's local time.
 *   - Picking another source (a click on its card, or "Ver"):
 *     DataSourcesPageSourcePicking.test.tsx.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsStale,
  buildSlicesWithDataSources,
  momentOfTheSamplesMs,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesPage } from './DataSourcesPage';

/** Draws the page with the simulator (built by `buildSimulator`) and its data at lap 34. */
function renderPageWithTheSimulatorAtLap34(buildSimulator: typeof buildSimulatorThatIsOk) {
  return renderOnControlPageConnectedToFakeServer(
    <DataSourcesPage />,
    buildSlicesWithDataSources({
      dataSources: [buildSimulator()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    }),
  );
}

/** The simulator turned off after its last good poll: the server keeps its data. */
function buildSimulatorTurnedOffWithItsData() {
  return { ...buildSimulatorThatIsOk(), isEnabled: false };
}

/** Reads the text of each cell of one table row, in order. */
function readCellTexts(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

describe('the positions table', () => {
  it('lists every car with its place, laps, times, gap and status', () => {
    // Arrange: nothing beyond the simulator with the enduro at lap 34.

    // Act: draw the page.
    renderPageWithTheSimulatorAtLap34(buildSimulatorThatIsOk);

    // Assert: a header row and 60 cars; the leader, a lapped car and the retired car read
    // like a timing screen.
    const positionsTable = within(screen.getByRole('table', { name: 'Posições' }));
    const rows = positionsTable.getAllByRole('row');
    expect(rows, 'a header row and one row per car (60)').toHaveLength(61);
    expect(
      positionsTable.getAllByRole('columnheader').map((header) => header.textContent),
      'the columns must be the ones of a timing screen',
    ).toEqual([
      'Pos.',
      'Carro',
      'Equipe',
      'Escola',
      'Voltas',
      'Última',
      'Melhor',
      'Diferença',
      'Status',
    ]);
    expect(readCellTexts(rows[1] as HTMLElement), 'the leader has no gap').toEqual([
      '1',
      '31',
      'Acauã Baja',
      'Mauá',
      '34',
      '4:38.293',
      '4:38.291',
      '',
      'Na pista',
    ]);
    expect(
      readCellTexts(rows[2] as HTMLElement)[7],
      'second place, on the leader lap, reads its gap in seconds',
    ).toBe('+19,0 s');
    expect(
      readCellTexts(rows[3] as HTMLElement)[7],
      'third place, a lap down, reads its gap in laps',
    ).toBe('+1 volta');
    expect(readCellTexts(rows[60] as HTMLElement), 'car 96 retired 22 laps down').toEqual([
      '60',
      '96',
      'Guará Baja',
      'UFS',
      '12',
      '6:38.438',
      '6:32.881',
      '+22 voltas',
      'Abandonou',
    ]);
  });
});

describe('the standings table', () => {
  it('lists the teams by rank with their points', () => {
    // Arrange: nothing beyond the simulator with the enduro at lap 34.

    // Act: draw the page.
    renderPageWithTheSimulatorAtLap34(buildSimulatorThatIsOk);

    // Assert: a header row and 60 teams; the first reads like the overall standings.
    const standingsTable = within(screen.getByRole('table', { name: 'Classificação' }));
    const rows = standingsTable.getAllByRole('row');
    expect(rows, 'a header row and one row per team (60)').toHaveLength(61);
    expect(readCellTexts(rows[1] as HTMLElement), 'the leader of the standings').toEqual([
      '1',
      '45',
      'Jandaia Racing',
      'UFC',
      '646,9',
    ]);
  });
});

describe('the stale banner', () => {
  it('says how old the data is above a late source, which still shows its data', () => {
    // Arrange: nothing beyond the simulator failing, its data from 15:44:00 kept.

    // Act: draw the page.
    renderPageWithTheSimulatorAtLap34(buildSimulatorThatIsStale);

    // Assert: the banner, and the table still full.
    expect(
      screen.getByText(/^Dados de \d{2}:44:00 — fonte atrasada$/),
      'a late source must say from when its data is',
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Posições' })).getAllByRole('row'),
      'late data is still shown in full, never blanked',
    ).toHaveLength(61);
  });

  it('is not shown for a healthy source', () => {
    // Arrange: nothing beyond the healthy simulator.

    // Act: draw the page.
    renderPageWithTheSimulatorAtLap34(buildSimulatorThatIsOk);

    // Assert: no banner.
    expect(
      screen.queryByText(/fonte atrasada$/),
      'fresh data needs no warning',
    ).not.toBeInTheDocument();
  });
});

describe('a source turned off', () => {
  it('says its data is from a source that is off, and holds its session clock', () => {
    // Arrange: the moment of the samples, the simulator off with its data at lap 34.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(momentOfTheSamplesMs));
    renderPageWithTheSimulatorAtLap34(buildSimulatorTurnedOffWithItsData);

    // Act: three seconds pass.
    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    // Assert: the banner, the data still shown, and the clock where the reading left it.
    expect(
      screen.getByText(/^Dados de \d{2}:44:00 — fonte desligada$/),
      'data kept from a source that is off must say so, and from when it is',
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Posições' })).getAllByRole('row'),
      'the data a source kept when it was turned off is still shown in full',
    ).toHaveLength(61);
    expect(
      screen.getByRole('timer'),
      'nothing runs the race of a source that is off, so its clock must not count',
    ).toHaveTextContent('1:16:00');
  });
});

describe('"Exibir JSON"', () => {
  it('shows the raw data on "Exibir JSON"', () => {
    // Arrange: the simulator with its data.
    renderPageWithTheSimulatorAtLap34(buildSimulatorThatIsOk);

    // Act: press "Exibir JSON".
    fireEvent.click(screen.getByRole('button', { name: 'Exibir JSON' }));

    // Assert: the raw data, written as JSON.
    expect(
      screen.getByText(/"eventName": "Baja SAE Brasil 2027 — Etapa Nacional"/),
      'the raw data must be shown as JSON',
    ).toBeInTheDocument();
  });

  it('hides the raw data again on "Ocultar JSON"', () => {
    // Arrange: the simulator with its data, the raw JSON shown.
    renderPageWithTheSimulatorAtLap34(buildSimulatorThatIsOk);
    fireEvent.click(screen.getByRole('button', { name: 'Exibir JSON' }));

    // Act: press "Ocultar JSON".
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar JSON' }));

    // Assert: no raw data left on the page.
    expect(
      screen.queryByText(/"eventName"/),
      'the raw data must hide again',
    ).not.toBeInTheDocument();
  });
});
