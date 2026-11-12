/**
 * The header's "Relógio sem sincronização" chip (apps/control)
 *
 * What this module is for:
 *   The header's clock warning ("Relógio do servidor X s fora da hora certa") needs an
 *   answer from NTP to know how far off the clock is; when no source answers at all, the
 *   operator learned it only from "Verificar servidor" (found by BAJAOVRLAY-75). Since the
 *   addition of 2026-11-12 to BAJAOVRLAY-76, when neither NTP nor HTTPS has answered the
 *   server for a full poll interval, the header shows an amber "Relógio sem
 *   sincronização", next to the clock warning, with a tooltip saying the clocks use the
 *   computer's time. It clears on the first good answer of either source. The server
 *   decides; the chip follows the `time` message.
 *
 * What these tests prove (a fake server on the WebSocket):
 *   - Nothing while the server says it is in sync, and nothing before any `time` message.
 *   - The chip once the server says it is without sync, as a status, with the tooltip
 *     (opened from the keyboard: the chip can take the focus).
 *   - It goes with the next `time` message after a good answer.
 *   - It stands beside the clock warning when both apply.
 *
 * What these tests deliberately do not cover:
 *   - When the server is without sync; apps/server's serverClockHttpFallback.test.ts.
 *   - Where the chip sits in the header: AppShell, and the screenshots in the PR.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { ServerClockOffWarning } from './ServerClockOffWarning';
import { ServerClockWithoutSyncChip } from './ServerClockWithoutSyncChip';

/** 12 October 2026, 13:15 UTC on the server's clock. */
const serverTimeMs = Date.parse('2026-10-12T13:15:00.000Z');

/** The header's two clock signs, side by side as AppShell draws them. */
function TheHeaderClockSigns() {
  return (
    <>
      <ServerClockOffWarning />
      <ServerClockWithoutSyncChip />
    </>
  );
}

/** Draws the header's clock signs on a connected page. */
function renderTheHeaderClockSigns() {
  return renderOnControlPageConnectedToFakeServer(
    <TheHeaderClockSigns />,
    buildSlicesWithNothingOnAir(),
  );
}

describe('the "Relógio sem sincronização" chip', () => {
  it('shows nothing while the server is in sync, nor before any time message', () => {
    // Arrange: the signs on a connected page; nothing heard about the clock yet.
    const { fakeServer } = renderTheHeaderClockSigns();
    const chipBeforeAnyTime = screen.queryByText('Relógio sem sincronização');

    // Act: the time message says the server clock is in sync.
    fakeServer.sendMessage({
      type: 'time',
      serverNowMs: serverTimeMs,
      serverClockStepCount: 0,
      isServerClockWithoutSync: false,
    });

    // Assert: no chip, before or after.
    expect(chipBeforeAnyTime, 'nothing known, nothing shown').not.toBeInTheDocument();
    expect(
      screen.queryByText('Relógio sem sincronização'),
      'in sync, nothing to warn about',
    ).not.toBeInTheDocument();
  });

  it('shows the chip, with its tooltip, once neither NTP nor HTTPS has answered', async () => {
    // Arrange: the signs on a connected page.
    const { fakeServer } = renderTheHeaderClockSigns();

    // Act: the time message says the server clock is without sync; the operator tabs onto
    // the chip to read why.
    fakeServer.sendMessage({
      type: 'time',
      serverNowMs: serverTimeMs,
      serverClockStepCount: 0,
      isServerClockWithoutSync: true,
    });
    const chip = screen.getByRole('status');
    fireEvent.focus(chip);

    // Assert: the chip says it, and its tooltip says what that means.
    expect(chip, 'the chip is in the header').toHaveTextContent('Relógio sem sincronização');
    expect(
      await screen.findByRole('tooltip'),
      'the tooltip says the clocks use the computer’s time',
    ).toHaveTextContent('Nem NTP nem HTTPS responderam; os relógios usam a hora do computador.');
  });

  it('goes with the next time message after a good answer', () => {
    // Arrange: the chip showing.
    const { fakeServer } = renderTheHeaderClockSigns();
    fakeServer.sendMessage({
      type: 'time',
      serverNowMs: serverTimeMs,
      serverClockStepCount: 0,
      isServerClockWithoutSync: true,
    });

    // Act: HTTPS answers on the server; its next time message says so.
    fakeServer.sendMessage({
      type: 'time',
      serverNowMs: serverTimeMs + 10_000,
      serverClockStepCount: 0,
      isServerClockWithoutSync: false,
    });

    // Assert: the chip is gone.
    expect(
      screen.queryByText('Relógio sem sincronização'),
      'cleared by the first good answer',
    ).not.toBeInTheDocument();
  });

  it('stands beside the clock warning when both apply', () => {
    // Arrange: the signs on a connected page.
    const { fakeServer } = renderTheHeaderClockSigns();

    // Act: the server clock is 8 s behind by NTP's last answer, and nothing answers now.
    fakeServer.sendMessage({
      type: 'time',
      serverNowMs: serverTimeMs,
      serverClockStepCount: 0,
      offFromRealTimeMs: 8_200,
      isServerClockWithoutSync: true,
    });

    // Assert: both, warning first.
    const statuses = screen.getAllByRole('status').map((status) => status.textContent);
    expect(statuses, 'the warning, then the chip').toEqual([
      'Relógio do servidor 8 s fora da hora certa',
      'Relógio sem sincronização',
    ]);
  });
});
