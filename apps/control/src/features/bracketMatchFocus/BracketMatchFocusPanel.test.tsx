/**
 * "Partidas da chave" on the console (apps/control)
 *
 * What this module is for:
 *   The match bug shows the Super Prime's match "agora" and the card the match "a seguir"
 *   (BAJAOVRLAY-65). The console's "Partidas da chave" shows both, proposes the next match
 *   once "agora" has its winner (never moving it by itself), and lists every match so the
 *   Produtor can put any one in either slot. Each button sends one command; the slots
 *   change when the server's slices say so.
 *
 * What these tests prove:
 *   - With no source sending a Super Prime the panel is not there.
 *   - It names the match "agora" and "a seguir", and proposes nothing while "agora" runs.
 *   - A winner arriving brings the proposal ("Partida encerrada: Corisco venceu. Próxima
 *     sugerida: …"); "Usar sugestão" sends acceptSuggestedBracketMatches with the session.
 *   - "Escolher outra" lists every match with its progress and the suggested ones; "Agora"
 *     on one sends setBracketMatchFocus for it; "Esvaziar" sends an empty slot.
 *   - A chosen match the source stopped listing is named, with the graphics showing nothing.
 *   - A refusal of the server is shown under the panel.
 *   - For Dados the buttons are greyed out, with the role's reason written beside them.
 *
 * What these tests deliberately do not cover:
 *   - What each slot and the proposal read in every situation: matchFocusOfEachSource.test.ts.
 *   - The commands' rules: apps/server's bracketMatchFocusCommands.test.ts.
 */
import type {
  BracketMatchFocus,
  BracketRound,
  DataSnapshot,
  SessionAnswer,
  Slices,
} from '@bajaovrlay/shared';
import {
  buildQuarterFinals,
  buildSuperPrimeBrackets,
  superPrimeCars,
} from '@bajaovrlay/shared/superPrimeBrackets.testSupport';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  buildSlicesWithDataSources,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { BracketMatchFocusPanel } from './BracketMatchFocusPanel';

const cars = superPrimeCars;

/** The session of shared's Super Prime builders, which every command must name. */
const superPrimeSessionId = 'super-prime-30a-competicao';

const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-11-15T07:00:00.000Z' },
};

/** The simulator's snapshot holding these rounds of today's Super Prime. */
function buildSnapshotWithRounds(rounds: BracketRound[]): DataSnapshot {
  return {
    sourceId: 'simulador-enduro',
    receivedAtMs: 1_793_552_400_000,
    shapes: { brackets: buildSuperPrimeBrackets(rounds) },
  };
}

/** A hello with the simulator sending these rounds and the operator's focus. */
function buildSlicesWithTheSuperPrime(
  rounds: BracketRound[],
  focus: BracketMatchFocus | undefined,
): Slices {
  return {
    ...buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildSnapshotWithRounds(rounds)],
    }),
    bracketMatchFocuses: focus === undefined ? [] : [focus],
  };
}

/** qf-1 "agora" and qf-2 "a seguir" in today's session. */
function buildFocusOnTheFirstTwo(): BracketMatchFocus {
  return {
    sourceId: 'simulador-enduro',
    sessionId: superPrimeSessionId,
    currentMatchId: 'qf-1',
    upNextMatchId: 'qf-2',
  };
}

describe('"Partidas da chave"', () => {
  it('is not there when no source sends a Super Prime', () => {
    // Arrange: the simulator sending the enduro alone.
    const slices = buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34('simulador-enduro')],
    });

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<BracketMatchFocusPanel />, slices);

    // Assert: nothing drawn.
    expect(
      screen.queryByRole('region', { name: 'Partidas da chave' }),
      'there is no match to show',
    ).toBe(null);
  });

  it('names the match "agora" and "a seguir", and proposes nothing while "agora" runs', () => {
    // Arrange: qf-1 "agora", qf-2 "a seguir", nothing decided.
    const slices = buildSlicesWithTheSuperPrime([buildQuarterFinals()], buildFocusOnTheFirstTwo());

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<BracketMatchFocusPanel />, slices);

    // Assert: both slots named; no "Usar sugestão" while the match runs.
    const panel = screen.getByRole('region', { name: 'Partidas da chave' });
    expect(
      within(panel).getByText('Corisco × Buffalo (Quartas de final)'),
      '"agora"',
    ).toBeVisible();
    expect(within(panel).getByText('Pequi × Acauã (Quartas de final)'), '"a seguir"').toBeVisible();
    expect(
      within(panel).queryByRole('button', { name: 'Usar sugestão' }),
      'nothing is proposed while "agora" runs',
    ).toBe(null);
  });

  it('proposes the next match once "agora" is won, and "Usar sugestão" asks for it', () => {
    // Arrange: qf-1 "agora", then the source gives it to Corisco.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <BracketMatchFocusPanel />,
      buildSlicesWithTheSuperPrime([buildQuarterFinals()], buildFocusOnTheFirstTwo()),
    );
    act(() => {
      fakeServer.sendMessage({
        type: 'dataSnapshot',
        sourceId: 'simulador-enduro',
        snapshot: buildSnapshotWithRounds([buildQuarterFinals({ 'qf-1': cars.corisco })]),
        serverNowMs: 1_793_552_460_000,
      });
    });

    // Act: press "Usar sugestão".
    fireEvent.click(screen.getByRole('button', { name: 'Usar sugestão' }));

    // Assert: the proposal named the winner and the next match; the press asked for it.
    expect(screen.getByText('Partida encerrada: Corisco venceu.'), 'the winner').toBeVisible();
    expect(
      screen.getByText('Próxima sugerida: Pequi × Acauã (Quartas de final)'),
      'the suggested next match',
    ).toBeVisible();
    expect(fakeServer.listCommandsReceived(), 'the press asks for the suggestion').toEqual([
      {
        type: 'acceptSuggestedBracketMatches',
        sourceId: 'simulador-enduro',
        sessionId: superPrimeSessionId,
      },
    ]);
  });

  it('lists every match to choose from, and "Agora" on one puts it "agora"', () => {
    // Arrange: qf-1 decided while "agora"; the page proposes qf-2.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <BracketMatchFocusPanel />,
      buildSlicesWithTheSuperPrime(
        [buildQuarterFinals({ 'qf-1': cars.corisco })],
        buildFocusOnTheFirstTwo(),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Escolher outra' }));
    const list = screen.getByRole('dialog', { name: 'Escolher partida' });

    // Act: put qf-4 "agora", skipping qf-3.
    fireEvent.click(
      within(list).getByRole('button', {
        name: 'Agora: Piratas Cerrado × UFSC (Quartas de final)',
      }),
    );

    // Assert: the list showed each match's progress and the suggestions; the press asked
    // for qf-4 "agora".
    expect(within(list).getByText('encerrada'), 'qf-1 is decided').toBeVisible();
    expect(within(list).getByText('sugerida agora'), 'qf-2 is suggested "agora"').toBeVisible();
    expect(within(list).getByText('sugerida a seguir'), 'qf-3 "a seguir"').toBeVisible();
    expect(fakeServer.listCommandsReceived(), 'the press puts qf-4 "agora"').toEqual([
      {
        type: 'setBracketMatchFocus',
        sourceId: 'simulador-enduro',
        sessionId: superPrimeSessionId,
        slot: 'current',
        matchId: 'qf-4',
      },
    ]);
  });

  it('empties "a seguir" from the list', () => {
    // Arrange: qf-1 "agora", qf-2 "a seguir"; the list open.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <BracketMatchFocusPanel />,
      buildSlicesWithTheSuperPrime([buildQuarterFinals()], buildFocusOnTheFirstTwo()),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Escolher partida' }));

    // Act: press "Esvaziar "A seguir"".
    fireEvent.click(screen.getByRole('button', { name: 'Esvaziar "A seguir"' }));

    // Assert: an empty slot asked for.
    expect(fakeServer.listCommandsReceived(), 'the press empties "a seguir"').toEqual([
      {
        type: 'setBracketMatchFocus',
        sourceId: 'simulador-enduro',
        sessionId: superPrimeSessionId,
        slot: 'upNext',
        matchId: null,
      },
    ]);
  });

  it('names a chosen match the source stopped listing', () => {
    // Arrange: "agora" names qf-9, which the source does not list.
    const slices = buildSlicesWithTheSuperPrime([buildQuarterFinals()], {
      sourceId: 'simulador-enduro',
      sessionId: superPrimeSessionId,
      currentMatchId: 'qf-9',
    });

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<BracketMatchFocusPanel />, slices);

    // Assert: the page says the match went and the graphics show nothing.
    expect(
      screen.getByText(
        'A partida escolhida (qf-9) saiu da chave; os gráficos não mostram nada. Escolha outra.',
      ),
      'a removed match must be named',
    ).toBeVisible();
  });

  it("shows the server's refusal under the panel", () => {
    // Arrange: nothing chosen, the suggestion offered.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <BracketMatchFocusPanel />,
      buildSlicesWithTheSuperPrime([buildQuarterFinals()], undefined),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Usar sugestão' }));

    // Act: the server refuses: the simulator restarted meanwhile.
    act(() => {
      fakeServer.refuseLastCommand({
        code: 'BRACKET_SESSION_CHANGED',
        message:
          'A chave mudou de sessão (agora simulador-enduro-2027-super-prime); escolha a partida de novo.',
      });
    });

    // Assert: the refusal is shown.
    expect(
      screen.getByRole('alert'),
      'the operator must read why nothing changed',
    ).toHaveTextContent('A chave mudou de sessão');
  });

  it('greys out the buttons for Dados, with the reason written', () => {
    // Arrange: nothing chosen, the page opened by Dados.
    renderOnControlPageConnectedToFakeServer(
      <BracketMatchFocusPanel />,
      buildSlicesWithTheSuperPrime([buildQuarterFinals()], undefined),
      { sessionAnswer: dataRoleAtMesa2 },
    );

    // Act: nothing; read the buttons.
    const useSuggestion = screen.getByRole('button', { name: 'Usar sugestão' });
    const choose = screen.getByRole('button', { name: 'Escolher partida' });

    // Assert: both greyed out, and the reason in words.
    expect(
      [useSuggestion, choose].map((button) => (button as HTMLButtonElement).disabled),
      'Dados may not move "agora"',
    ).toEqual([true, true]);
    expect(
      screen.getByText('O papel Dados não pode mudar o que está no ar. Peça ao Produtor.'),
      "the role's reason must be written, a greyed-out button shows no tooltip",
    ).toBeVisible();
  });
});
