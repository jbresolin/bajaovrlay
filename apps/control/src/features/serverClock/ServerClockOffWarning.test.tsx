/**
 * The header's warning that the server clock is off real time (apps/control)
 *
 * What this module is for:
 *   The server keeps real time from NTP (BAJAOVRLAY-62). It steps a big difference by
 *   itself, except while something on program or preview counts time: then it slews at
 *   0.5% and the header says "Relógio do servidor X s fora da hora certa" from 2 s on,
 *   until it is covered or Produtor uses "Acertar relógio agora". The number comes with
 *   the server's ten-second `time` message.
 *
 * What these tests prove (a fake server on the WebSocket):
 *   - No warning while the server clock is within 2 s of real time.
 *   - 8 s behind: the warning says 8 s; 8 h behind (the machine slept): 28.800 s.
 *   - It goes once the server clock is back within 2 s.
 *
 * What these tests deliberately do not cover:
 *   - Rounding and when the store changes; state/serverConnection.serverClock.test.ts.
 *   - When the server holds a difference; apps/server's serverClockDiscipline.test.ts.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { ServerClockOffWarning } from './ServerClockOffWarning';

/** 12 October 2026, 13:15 UTC on the server's clock. */
const serverTimeMs = Date.parse('2026-10-12T13:15:00.000Z');

describe("the header's server clock warning", () => {
  it('shows nothing while the server clock is within 2 s of real time', () => {
    // Arrange: the warning on a connected page.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <ServerClockOffWarning />,
      buildSlicesWithNothingOnAir(),
    );

    // Act: the time message says the server clock is 1.4 s behind.
    fakeServer.sendMessage({ type: 'time', serverNowMs: serverTimeMs, offFromRealTimeMs: 1_400 });

    // Assert: no warning.
    expect(
      screen.queryByText(/fora da hora certa/),
      'under 2 s off there is nothing to warn about',
    ).not.toBeInTheDocument();
  });

  const warningScenarios = [
    // A running clock held a sync's difference: the operator sees it.
    {
      name: '8 s behind',
      offFromRealTimeMs: 8_200,
      expectedText: 'Relógio do servidor 8 s fora da hora certa',
    },
    // The machine slept a night with the enduro clock on air.
    {
      name: '8 h behind',
      offFromRealTimeMs: 8 * 60 * 60 * 1000,
      expectedText: 'Relógio do servidor 28.800 s fora da hora certa',
    },
  ];

  it.each(warningScenarios)(
    'says so when the server clock is $name',
    ({ offFromRealTimeMs, expectedText }) => {
      // Arrange: the warning on a connected page.
      const { fakeServer } = renderOnControlPageConnectedToFakeServer(
        <ServerClockOffWarning />,
        buildSlicesWithNothingOnAir(),
      );

      // Act: the time message says how far behind the server clock is.
      fakeServer.sendMessage({ type: 'time', serverNowMs: serverTimeMs, offFromRealTimeMs });

      // Assert: the warning, in whole seconds.
      expect(
        screen.getByText(expectedText),
        'the header must say how far off it is',
      ).toBeInTheDocument();
    },
  );

  it('goes once the server clock is back within 2 s', () => {
    // Arrange: the warning showing 8 s.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <ServerClockOffWarning />,
      buildSlicesWithNothingOnAir(),
    );
    fakeServer.sendMessage({ type: 'time', serverNowMs: serverTimeMs, offFromRealTimeMs: 8_200 });

    // Act: "Acertar relógio agora" was used; the next time message says 3 ms.
    fakeServer.sendMessage({ type: 'time', serverNowMs: serverTimeMs, offFromRealTimeMs: 3 });

    // Assert: gone.
    expect(
      screen.queryByText(/fora da hora certa/),
      'the warning goes when it is right',
    ).not.toBeInTheDocument();
  });
});
