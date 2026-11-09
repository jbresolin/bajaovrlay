/**
 * The "Fontes de dados" page: a YouTube live chat source (apps/control)
 *
 * What this module is for:
 *   A YouTube source (BAJAOVRLAY-35) reads a live's chat for its Super Chats. "+ Fonte"
 *   offers it beside the other kinds; its form asks for the live's address only, since the
 *   API key stays on the server. Its card shows how much of the key's daily quota is spent.
 *
 * What these tests prove:
 *   - "+ Fonte" → "Chat do YouTube (Super Chats)" opens a form at 30 s, and a pasted
 *     address is sent as createDataSource with the address alone.
 *   - A channel page instead of a live gets its message under the address, nothing sent.
 *   - The card of a YouTube source shows its quota, "1.235 de 9.000 unidades hoje", and a
 *     simulator's card shows none.
 *   - A YouTube source stale for its quota shows the server's reason, as any other source.
 *
 * What these tests deliberately do not cover:
 *   - Every address form and interval: youtubeLiveChatSourceForm.test.ts.
 *   - What the server does with the source: the server's adapter tests.
 */
import type { YouTubeLiveChatDataSource } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { pressButton, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSimulatorThatIsOk,
  buildSlicesWithDataSources,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesPage } from './DataSourcesPage';

/** The chat of Saturday's enduro live, on, 1 235 units spent of the 9 000 budget. */
function buildEnduroLiveChatSourceThatIsOk(): YouTubeLiveChatDataSource {
  return {
    id: 'youtube-enduro-sabado',
    kind: 'youtubeLiveChat',
    label: 'Chat do enduro',
    pollIntervalMs: 30_000,
    isEnabled: true,
    isRecording: false,
    config: { liveAddress: 'https://www.youtube.com/watch?v=BajaLive024' },
    status: {
      lastAttemptAtMs: Date.parse('2026-10-10T15:04:00.000Z'),
      lastOkAtMs: Date.parse('2026-10-10T15:04:00.000Z'),
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 90_000,
      recordingError: null,
      youTubeQuota: { unitsSpentToday: 1_235, dailyUnitsBudget: 9_000 },
    },
  };
}

/** Draws the page with the simulator and, when given, a YouTube source. */
function renderPageWithSources(youTubeSource?: YouTubeLiveChatDataSource) {
  const dataSources =
    youTubeSource === undefined
      ? [buildSimulatorThatIsOk()]
      : [buildSimulatorThatIsOk(), youTubeSource];
  return renderOnControlPageConnectedToFakeServer(
    <DataSourcesPage />,
    buildSlicesWithDataSources({ dataSources }),
  );
}

/** Presses "+ Fonte" and picks the YouTube kind, which opens its form. */
function openTheNewYouTubeSourceForm() {
  pressButton('+ Fonte');
  const kindChoice = within(screen.getByRole('group', { name: 'Que tipo de fonte?' }));
  fireEvent.click(kindChoice.getByRole('button', { name: 'Chat do YouTube (Super Chats)' }));
  return within(screen.getByRole('region', { name: 'Nova fonte: Chat do YouTube (Super Chats)' }));
}

describe('a new YouTube source', () => {
  it('opens at 30 s and is sent with the pasted address alone', async () => {
    // Arrange: the new YouTube form, named, the "Compartilhar" link pasted.
    const { fakeServer } = renderPageWithSources();
    const form = openTheNewYouTubeSourceForm();
    typeIntoField('Nome da fonte', 'Chat do enduro');
    typeIntoField('Endereço da transmissão no YouTube', 'https://youtu.be/BajaLive024');

    // Act: press "Salvar fonte".
    pressButton('Salvar fonte');

    // Assert: the interval started at 30 s, and the source is sent with the address only.
    expect(
      form.getByLabelText('Intervalo de leitura (segundos)'),
      'a YouTube source must start at 30 s',
    ).toHaveValue('30');
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the new source must be sent whole').toEqual([
        {
          type: 'createDataSource',
          label: 'Chat do enduro',
          kind: 'youtubeLiveChat',
          config: { liveAddress: 'https://youtu.be/BajaLive024' },
          pollIntervalMs: 30_000,
        },
      ]);
    });
  });

  it('is not sent with a channel page, and the address says why', async () => {
    // Arrange: the new YouTube form with the channel's page pasted.
    const { fakeServer } = renderPageWithSources();
    openTheNewYouTubeSourceForm();
    typeIntoField('Nome da fonte', 'Chat do enduro');
    typeIntoField('Endereço da transmissão no YouTube', 'https://www.youtube.com/@BajaSAEBrasil');

    // Act: press "Salvar fonte" and give the page its moment.
    pressButton('Salvar fonte');
    await letThePageFinishWhatItStarted();

    // Assert: the message under the address, nothing sent.
    expect(
      await screen.findByText(
        'Cole o endereço da transmissão: youtube.com/watch?v=…, youtu.be/… ou youtube.com/live/….',
      ),
      'the address must say which forms are read',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'a wrong form must send nothing').toEqual([]);
  });
});

describe('the card of a YouTube source', () => {
  it('shows the quota spent today, and a simulator shows none', () => {
    // Arrange: the simulator and the enduro chat, 1 235 units spent.
    renderPageWithSources(buildEnduroLiveChatSourceThatIsOk());

    // Act: find the two cards.
    const youTubeCard = within(screen.getByRole('listitem', { name: 'Chat do enduro' }));
    const simulatorCard = within(screen.getByRole('listitem', { name: 'Simulador — Enduro' }));

    // Assert: the quota in pt-BR numbers on the YouTube card only.
    expect(
      youTubeCard.getByText('Cota do YouTube: 1.235 de 9.000 unidades hoje'),
      'the YouTube card must show the quota spent today',
    ).toBeInTheDocument();
    expect(
      simulatorCard.queryByText(/Cota do YouTube/),
      'a simulator has no YouTube quota',
    ).not.toBeInTheDocument();
  });

  it('shows the server’s reason when the quota ran out', () => {
    // Arrange: the enduro chat stale because the budget was reached.
    const exhaustedSource = buildEnduroLiveChatSourceThatIsOk();
    exhaustedSource.status = {
      ...exhaustedSource.status,
      isStale: true,
      consecutiveFailures: 1,
      lastError: 'Cota diária do YouTube esgotada; volta às 5h',
      youTubeQuota: { unitsSpentToday: 9_000, dailyUnitsBudget: 9_000 },
    };

    // Act: draw the page with it.
    renderPageWithSources(exhaustedSource);

    // Assert: the card says why, as for any late source, and the full quota.
    const youTubeCard = within(screen.getByRole('listitem', { name: 'Chat do enduro' }));
    expect(
      youTubeCard.getByText('Cota do YouTube: 9.000 de 9.000 unidades hoje'),
      'the card must show the whole budget spent',
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Cota diária do YouTube esgotada; volta às 5h/).length,
      'the server’s reason must be shown',
    ).toBeGreaterThan(0);
  });
});
