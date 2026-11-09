/**
 * "Acertar relógio agora" and its confirm (apps/control)
 *
 * What this module is for:
 *   The server keeps real time from NTP (BAJAOVRLAY-62). While something on program or
 *   preview counts time it does not step a big difference by itself; Produtor can, from
 *   the header's menu, after a confirm saying what on air would jump and by how much.
 *   The page asks `POST /api/v1/server-clock/set-now` and says what the server did.
 *
 * What these tests prove (a fake server on the WebSocket, `fetch` answered by hand):
 *   - The confirm says what on air jumps, and by how much when the header knows.
 *   - "Acertar agora" posts to the server and says by how much the clock was stepped.
 *   - "Cancelar" closes the confirm and asks nothing.
 *   - A server with NTP off answers why, and the page shows it in pt-BR.
 *   - For Dados the entry is greyed out with its reason, and opens nothing.
 *
 * What these tests deliberately do not cover:
 *   - The other entries of the menu; features/headerMenu/HeaderMenu.test.tsx.
 *   - What the server does; apps/server's serverClockRoute.test.ts and
 *     serverClockDiscipline.test.ts.
 */
import type { SessionAnswer } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { HeaderMenu } from '@/features/headerMenu/HeaderMenu';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheTriggers } from '@/state/triggersLikeTheServerSends.testSupport';

const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-10-11T07:00:00.000Z' },
};

/** 10 October 2026, 13:00:04 UTC on the server clock. */
const momentOfTheLastNtpAnswerMs = Date.parse('2026-10-10T13:00:04.000Z');

/** Draws the header menu on a connected page, as Produtor or as the given session. */
function renderTheHeaderMenu(options: { sessionAnswer?: SessionAnswer } = {}) {
  return renderOnControlPageConnectedToFakeServer(
    <HeaderMenu />,
    buildSlicesWithTheTriggers([], false),
    { sessionAnswer: options.sessionAnswer },
  );
}

/** Opens the menu as a keyboard does: Enter on the "Menu" button. */
function openTheMenu(): void {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Menu' }), { key: 'Enter' });
}

describe('"Acertar relógio agora"', () => {
  it('asks first on "Acertar relógio agora", saying what jumps and by how much', () => {
    // Arrange: the server clock held 8 s behind real time (the header says so), the menu open.
    const { fakeServer } = renderTheHeaderMenu();
    fakeServer.sendMessage({
      type: 'time',
      serverNowMs: momentOfTheLastNtpAnswerMs,
      offFromRealTimeMs: 8_200,
    });
    openTheMenu();

    // Act: pick "Acertar relógio agora".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Acertar relógio agora' }));

    // Assert: a confirm saying what on air jumps, and by how much.
    const confirm = screen.getByRole('dialog', { name: 'Acertar o relógio do servidor agora?' });
    expect(confirm, 'the confirm says what on air jumps').toHaveTextContent(
      'O relógio de prova e as contagens regressivas no Programa e na Prévia pulam de uma vez para a hora certa.',
    );
    expect(confirm, 'and by how much').toHaveTextContent(
      'O relógio do servidor está 8 s atrasado.',
    );
  });

  it('steps the server clock on "Acertar agora" and says by how much', async () => {
    // Arrange: a server that steps its clock 8.2 s forwards; the confirm open.
    const fetchStandIn = vi.fn(async () => Response.json({ steppedByMs: 8_200 }));
    vi.stubGlobal('fetch', fetchStandIn);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    renderTheHeaderMenu();
    openTheMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Acertar relógio agora' }));

    // Act: confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Acertar agora' }));

    // Assert: the server was asked, and the dialog says the step.
    expect(
      await screen.findByText('Relógio acertado: 8,2 s para a frente.'),
      'the producer must see what the server did',
    ).toBeInTheDocument();
    expect(fetchStandIn, 'the page posts to the server clock route').toHaveBeenCalledWith(
      '/api/v1/server-clock/set-now',
      { method: 'POST' },
    );
  });

  it('asks nothing on "Cancelar"', () => {
    // Arrange: the confirm open.
    const fetchStandIn = vi.fn();
    vi.stubGlobal('fetch', fetchStandIn);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    renderTheHeaderMenu();
    openTheMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Acertar relógio agora' }));

    // Act: cancel.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert: closed, nothing asked.
    expect(screen.queryByRole('dialog'), 'the confirm closes').not.toBeInTheDocument();
    expect(fetchStandIn, 'nothing is asked of the server').not.toHaveBeenCalled();
  });

  it("says the server's reason in pt-BR when the clock could not be set", async () => {
    // Arrange: a server started with NTP off; the confirm open.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: 'NTP_OFF',
              message:
                'O NTP está desligado neste servidor (BAJAOVRLAY_NTP_SERVERS=off): não há hora certa para acertar o relógio.',
            },
          },
          { status: 503 },
        ),
      ),
    );
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    renderTheHeaderMenu();
    openTheMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Acertar relógio agora' }));

    // Act: confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Acertar agora' }));

    // Assert: the server's sentence.
    expect(
      await screen.findByText(
        'O NTP está desligado neste servidor (BAJAOVRLAY_NTP_SERVERS=off): não há hora certa para acertar o relógio.',
      ),
      'the producer must see why',
    ).toBeInTheDocument();
  });

  it('greys out "Acertar relógio agora" for Dados, with the reason, and asks nothing', async () => {
    // Arrange: the menu of Dados at "Mesa 2", open.
    const fetchStandIn = vi.fn();
    vi.stubGlobal('fetch', fetchStandIn);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    renderTheHeaderMenu({ sessionAnswer: dataRoleAtMesa2 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    });
    openTheMenu();
    const setClockEntry = screen.getByRole('menuitem', { name: /Acertar relógio agora/ });

    // Act: try to pick it.
    fireEvent.click(setClockEntry);

    // Assert: greyed out, the reason under it, no confirm, nothing asked.
    expect(setClockEntry, 'greyed out for Dados, never hidden').toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(setClockEntry, 'the entry says why, in pt-BR').toHaveTextContent(
      'Só o Produtor acerta o relógio: o que conta tempo no ar pula.',
    );
    expect(screen.queryByRole('dialog'), 'no confirm opens').not.toBeInTheDocument();
    expect(fetchStandIn, 'nothing is asked of the server').not.toHaveBeenCalled();
  });
});
