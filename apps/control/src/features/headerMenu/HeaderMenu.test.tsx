/**
 * The "Menu" button in the console's header (apps/control)
 *
 * What this module is for:
 *   Things the operator rarely needs during a show live in one menu of the header
 *   (BAJAOVRLAY-62): "Verificar servidor", "Cópia de segurança", "Pausar gatilhos" (or
 *   "Retomar gatilhos" while paused) and "Acertar relógio agora". The first three were
 *   header buttons before and do what those did. A pause is never hidden in the menu
 *   alone: the header's "Gatilhos pausados" chip shows it (TriggersPausedChip.test.tsx).
 *   "Acertar relógio agora" steps the server clock to NTP's real time at once, after a
 *   confirm saying what on air would jump; Produtor alone may.
 *
 * What these tests prove (a fake server on the WebSocket, `fetch` answered by hand):
 *   - The button is named "Menu" for a screen reader, and lists the four entries.
 *   - "Verificar servidor" asks /health and says the version beside the menu, with the
 *     last NTP answer's time, server and difference; a server that is off is said in pt-BR.
 *   - "Cópia de segurança" opens the backup dialog.
 *   - "Pausar gatilhos" pauses every trigger; paused, the entry reads "Retomar gatilhos"
 *     and lets them run again.
 *   - For Dados the pause entry is greyed out with the role's reason under it, and
 *     sends nothing.
 *   - The menu works from the keyboard: Enter opens it, the arrow keys move between the
 *     entries and Enter picks one; Escape closes it.
 *
 * What these tests deliberately do not cover:
 *   - The backup dialog's contents; features/backup/BackupDialog.test.tsx.
 *   - "Acertar relógio agora" past its entry; features/serverClock/SetServerClockDialog.test.tsx.
 *   - What a pause does on the server; apps/server's triggerFiring.test.ts.
 *   - Where the menu sits in the header: App.test.tsx, and the screenshots in the PR.
 */
import type { SessionAnswer } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheTriggers } from '@/state/triggersLikeTheServerSends.testSupport';

import { HeaderMenu } from './HeaderMenu';

const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-10-11T07:00:00.000Z' },
};

/** Draws the menu on a connected page, the triggers paused or running as asked. */
function renderTheHeaderMenu(options: { isPaused?: boolean; sessionAnswer?: SessionAnswer } = {}) {
  return renderOnControlPageConnectedToFakeServer(
    <HeaderMenu />,
    buildSlicesWithTheTriggers([], options.isPaused ?? false),
    { sessionAnswer: options.sessionAnswer },
  );
}

/** Opens the menu as a keyboard does: Enter on the "Menu" button. */
function openTheMenu(): void {
  // Radix opens its menu on a pointer press or on Enter; Enter needs no pointer stand-in.
  fireEvent.keyDown(screen.getByRole('button', { name: 'Menu' }), { key: 'Enter' });
}

/** The text of every entry of the open menu, top to bottom. */
function listEntriesOfTheMenu(): Array<string | null> {
  return screen.getAllByRole('menuitem').map((menuEntry) => menuEntry.textContent);
}

/** 10 October 2026, 13:00:04 UTC: when the last NTP answer of these tests arrived. */
const momentOfTheLastNtpAnswerMs = Date.parse('2026-10-10T13:00:04.000Z');

/** Answers GET /health as the server does, or fails as a server that is off. */
function answerTheHealthCheck(answer: 'healthy at 0.3.1' | 'switched off') {
  const fetchStandIn = vi.fn(async () => {
    if (answer === 'switched off') {
      throw new TypeError('Failed to fetch');
    }
    return Response.json({
      ok: true,
      version: '0.3.1',
      serverClock: {
        isNtpOn: true,
        lastNtpAnswer: {
          serverName: 'a.st1.ntp.br:123',
          atMs: momentOfTheLastNtpAnswerMs,
          differenceMs: 12,
          roundTripMs: 9,
        },
        offFromRealTimeMs: 3,
      },
    });
  });
  vi.stubGlobal('fetch', fetchStandIn);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return fetchStandIn;
}

describe('the header menu', () => {
  it('is a button named "Menu" with the four entries', () => {
    // Arrange: the menu on a page whose triggers run.
    renderTheHeaderMenu();

    // Act: open it.
    openTheMenu();

    // Assert: the four entries, in this order.
    expect(listEntriesOfTheMenu(), 'the menu must hold the four actions').toEqual([
      'Verificar servidor',
      'Cópia de segurança',
      'Pausar gatilhos',
      'Acertar relógio agora',
    ]);
  });

  it('checks the server from "Verificar servidor" and says its version', async () => {
    // Arrange: a server that answers /health with version 0.3.1.
    const fetchStandIn = answerTheHealthCheck('healthy at 0.3.1');
    renderTheHeaderMenu();
    openTheMenu();

    // Act: pick "Verificar servidor".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Verificar servidor' }));

    // Assert: /health was asked, and the version and the last NTP answer are said beside
    // the menu (the time of day in this computer's zone, as every time on the page).
    const timeOfTheAnswer = new Date(momentOfTheLastNtpAnswerMs).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    expect(
      await screen.findByText(
        `Servidor no ar, versão 0.3.1. Última resposta do NTP às ${timeOfTheAnswer} (a.st1.ntp.br:123), diferença de +12 ms.`,
      ),
      'the page must show the version and what the server clock last heard from NTP',
    ).toBeInTheDocument();
    expect(fetchStandIn, 'the page must ask the /health address').toHaveBeenCalledWith('/health');
  });

  it('says in pt-BR that the server could not be reached', async () => {
    // Arrange: a server that is switched off.
    answerTheHealthCheck('switched off');
    renderTheHeaderMenu();
    openTheMenu();

    // Act: pick "Verificar servidor".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Verificar servidor' }));

    // Assert: the reason, in pt-BR.
    expect(
      await screen.findByText('Não foi possível falar com o servidor.'),
      'the page must tell the operator the server did not answer',
    ).toBeInTheDocument();
  });

  it('opens the backup dialog from "Cópia de segurança"', async () => {
    // Arrange: a server whose backup summary never answers (the dialog's contents are
    // BackupDialog.test.tsx's), and the menu open.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    renderTheHeaderMenu();
    openTheMenu();

    // Act: pick "Cópia de segurança".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cópia de segurança' }));

    // Assert: the dialog is open.
    expect(
      await screen.findByRole('dialog', { name: 'Cópia de segurança' }),
      'the entry must open the dialog its header button opened',
    ).toBeInTheDocument();
  });

  it('pauses the triggers from "Pausar gatilhos"', () => {
    // Arrange: the triggers running, the menu open.
    const { fakeServer } = renderTheHeaderMenu({ isPaused: false });
    openTheMenu();

    // Act: pick "Pausar gatilhos".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pausar gatilhos' }));

    // Assert: the server is asked to pause every trigger.
    expect(fakeServer.listCommandsReceived(), 'the entry pauses every trigger').toEqual([
      { type: 'setTriggersPaused', isPaused: true },
    ]);
  });

  it('offers "Retomar gatilhos" while paused, and lets them run again', () => {
    // Arrange: the triggers paused for the rehearsal, the menu open.
    const { fakeServer } = renderTheHeaderMenu({ isPaused: true });
    openTheMenu();
    const entriesWhilePaused = listEntriesOfTheMenu();

    // Act: pick "Retomar gatilhos".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Retomar gatilhos' }));

    // Assert: the entry said "Retomar gatilhos", and the press unpauses.
    expect(entriesWhilePaused, 'paused, the entry offers to resume').toContain('Retomar gatilhos');
    expect(fakeServer.listCommandsReceived(), 'the entry lets the triggers run again').toEqual([
      { type: 'setTriggersPaused', isPaused: false },
    ]);
  });

  it('greys out the pause for Dados, with the reason, and sends nothing', async () => {
    // Arrange: the menu of Dados at "Mesa 2", open.
    const { fakeServer } = renderTheHeaderMenu({ sessionAnswer: dataRoleAtMesa2 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    });
    openTheMenu();
    const pauseEntry = screen.getByRole('menuitem', { name: /Pausar gatilhos/ });

    // Act: try to pick it.
    fireEvent.click(pauseEntry);

    // Assert: greyed out, the role's sentence under it, nothing sent.
    expect(pauseEntry, 'the pause is greyed out for Dados, never hidden').toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(pauseEntry, 'the entry says why, in pt-BR').toHaveTextContent(
      'O papel Dados não pode fazer isso: é com o Produtor.',
    );
    expect(fakeServer.listCommandsReceived(), 'Dados’s press sends nothing').toEqual([]);
  });

  it('works from the keyboard: Enter opens, the arrows move, Enter picks, Escape closes', async () => {
    // Arrange: a server whose backup summary never answers, the triggers running.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    renderTheHeaderMenu();

    // Act: open with Enter and close with Escape; open again, go down one entry from
    // the first and pick it with Enter.
    openTheMenu();
    const firstFocusedEntry = document.activeElement?.textContent;
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    const entriesAfterEscape = screen.queryAllByRole('menuitem');
    openTheMenu();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowDown' });
    // Radix moves the focus a moment after the key, not during it.
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe('Cópia de segurança');
    });
    const secondFocusedEntry = document.activeElement?.textContent;
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' });

    // Assert: Enter put the focus on the first entry; Escape closed the menu; the arrow
    // moved to "Cópia de segurança", and Enter opened its dialog.
    expect(firstFocusedEntry, 'Enter must open the menu on its first entry').toBe(
      'Verificar servidor',
    );
    expect(entriesAfterEscape, 'Escape must close the menu').toEqual([]);
    expect(secondFocusedEntry, 'the down arrow must move to the next entry').toBe(
      'Cópia de segurança',
    );
    expect(
      await screen.findByRole('dialog', { name: 'Cópia de segurança' }),
      'Enter on an entry must do what a click does',
    ).toBeInTheDocument();
  });
});
