/**
 * "Verificar servidor" names what the server clock follows (apps/control)
 *
 * What this module is for:
 *   The server clock follows NTP, or the Date headers of HTTPS servers while NTP is
 *   quiet, or nothing (BAJAOVRLAY-76). "Verificar servidor" says which, with the last
 *   answer's time and difference, so an operator at a venue that blocks NTP sees that the
 *   clock is still on real time, and from where.
 *
 * What these tests prove (a fake server on the WebSocket, `fetch` answered by hand):
 *   - Following NTP: "Relógio: NTP (a.st1.ntp.br), última resposta às …, diferença de +12 ms."
 *   - Following HTTPS: "Relógio: HTTPS (www.cloudflare.com), …, diferença de -41 ms."
 *   - Following nothing: "sem sincronização — hora do computador", with NTP's last answer.
 *   - Following nothing and no answer ever: the sentence alone.
 *
 * What these tests deliberately do not cover:
 *   - A server from before BAJAOVRLAY-76 (no source): HeaderMenu.test.tsx, the old sentence.
 *   - When the server follows which; apps/server's serverClockHttpFallback.test.ts.
 */
import type { ServerClockSource } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { HeaderMenu } from '@/features/headerMenu/HeaderMenu';
import { buildTheThreeServerClockSources } from '@/features/serverClock/serverClockSourceFixtures.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

/** Answers GET /health as a server of version 0.3.1 on NTP whose clock follows `source`. */
function answerTheHealthCheckFollowing(source: ServerClockSource): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        ok: true,
        version: '0.3.1',
        serverClock: { isNtpOn: true, lastNtpAnswer: null, offFromRealTimeMs: 0, source },
      }),
    ),
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
}

/** Opens the menu and picks "Verificar servidor". */
function checkTheServerFromTheMenu(): void {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Menu' }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Verificar servidor' }));
}

describe('"Verificar servidor" and the source of the server clock', () => {
  // Each row is one source the operator may meet (the support file says why each exists).
  const sourceCases = [
    ...buildTheThreeServerClockSources(),
    {
      // The uplink was out from the boot on: nothing ever answered.
      name: 'nothing, no answer ever',
      source: { following: 'none', lastAnswer: null } satisfies ServerClockSource,
      expectedSentence: 'Relógio: sem sincronização — hora do computador.',
    },
  ];

  it.each(sourceCases)('says the clock follows $name', async ({ source, expectedSentence }) => {
    // Arrange: a server whose clock follows the row's source.
    answerTheHealthCheckFollowing(source);
    renderOnControlPageConnectedToFakeServer(<HeaderMenu />, buildSlicesWithNothingOnAir());

    // Act: "Verificar servidor".
    checkTheServerFromTheMenu();

    // Assert: the version, then what the clock follows.
    expect(
      await screen.findByText(`Servidor no ar, versão 0.3.1. ${expectedSentence}`),
      'the operator must see where the clock takes its time from',
    ).toBeInTheDocument();
  });
});
