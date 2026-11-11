/**
 * "Verificar servidor" names the late data sources (apps/control)
 *
 * What this module is for:
 *   When a feed breaks mid-race the operator's first move is often "Verificar servidor":
 *   is it the server, or the source? Until BAJAOVRLAY-32 the answer named the version and
 *   the clock only, so a late source looked like a healthy server and nothing else. Its
 *   answer now ends with the data sources that are on: which are late ("atrasada"), which
 *   in error, or that every one is ok. The chaos suite's data source scenarios read it on
 *   the real page (apps/control/e2e/chaos).
 *
 * What these tests prove (a fake server on the WebSocket, `fetch` answered by hand):
 *   - A source that is failing and kept its last data is named as late.
 *   - A source that never had data and fails is named as in error.
 *   - With every source on and healthy, the answer says they are all ok.
 *   - With no source on, the answer says nothing of sources.
 *
 * What these tests deliberately do not cover:
 *   - The version and NTP sentences: HeaderMenu.test.tsx.
 *   - When "atrasada" turns into "com erro" (a minute of failing): dataSourceHealth.test.ts.
 */
import type { DataSource } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { HeaderMenu } from '@/features/headerMenu/HeaderMenu';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSeededSimulatorThatIsOff,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsStale,
  buildSimulatorThatNeverHadData,
  buildSlicesWithDataSources,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

/** Answers GET /health as a server of version 0.3.1 with NTP off does. */
function answerTheHealthCheckWithNtpOff(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        ok: true,
        version: '0.3.1',
        serverClock: { isNtpOn: false, lastNtpAnswer: null, offFromRealTimeMs: 0 },
      }),
    ),
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
}

/** The same source under another id and label, as a second source an operator made. */
function renamedAs(source: DataSource, id: string, label: string): DataSource {
  return { ...source, id, label };
}

const versionAndClockSentence =
  'Servidor no ar, versão 0.3.1. NTP desligado: o relógio do servidor segue o da máquina.';

const sourceScenarios = [
  // The chaos suite's case: the Baja app's race stopped answering and its data was kept.
  {
    name: 'names a failing source that kept its data as late',
    dataSources: [renamedAs(buildSimulatorThatIsStale(), 'baja-enduro', 'Baja app — Enduro')],
    expectedText: `${versionAndClockSentence} Fontes atrasadas: Baja app — Enduro.`,
  },
  // A source that never answered has nothing to be late with: it is in error.
  {
    name: 'names a source that never had data as in error',
    dataSources: [
      buildSimulatorThatIsOk(),
      renamedAs(buildSimulatorThatNeverHadData(), 'cronometragem', 'Cronometragem'),
    ],
    expectedText: `${versionAndClockSentence} Fontes com erro: Cronometragem.`,
  },
  // The answer an operator hopes for.
  {
    name: 'says every source that is on is ok',
    dataSources: [buildSimulatorThatIsOk()],
    expectedText: `${versionAndClockSentence} Fontes ligadas: todas ok.`,
  },
  // A sources sentence with no source on would be noise.
  {
    name: 'says nothing of sources when none is on',
    dataSources: [buildSeededSimulatorThatIsOff()],
    expectedText: versionAndClockSentence,
  },
];

describe('"Verificar servidor" and the data sources', () => {
  it.each(sourceScenarios)('$name', async ({ dataSources, expectedText }) => {
    // Arrange: the menu on a page whose server holds these sources, /health answering.
    answerTheHealthCheckWithNtpOff();
    renderOnControlPageConnectedToFakeServer(
      <HeaderMenu />,
      buildSlicesWithDataSources({ dataSources }),
    );

    // Act: open the menu with Enter and pick "Verificar servidor".
    fireEvent.keyDown(screen.getByRole('button', { name: 'Menu' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Verificar servidor' }));

    // Assert: the answer beside the menu ends with what the sources are.
    expect(
      await screen.findByText(expectedText),
      'the server check must say which sources are late or in error',
    ).toBeInTheDocument();
  });
});
