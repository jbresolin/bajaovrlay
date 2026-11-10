/**
 * Choosing "agora" and "a seguir" of a Super Prime (apps/server)
 *
 * What this module is for:
 *   The match bug shows the match "agora" and the card the match "a seguir"
 *   (BAJAOVRLAY-65). The operator puts any match of the session in either slot
 *   (setBracketMatchFocus) or takes the system's suggestion (acceptSuggestedBracketMatches,
 *   "Usar sugestão"). Both go the usual path (validate, authorize, apply, save, event log,
 *   broadcast), so each writes an event-log row, refused ones included.
 *
 * What these tests prove:
 *   - A match goes in a slot, one listed after a match not yet run included; a match put
 *     in the other slot moves there; a slot is emptied with no match.
 *   - "Usar sugestão" puts the first undecided match in "agora" and the next in "a
 *     seguir", reading the brackets the server holds when the command arrives.
 *   - A choice in a new session starts a fresh focus: nothing of the earlier session is kept.
 *   - Each refusal, with its code and a pt-BR message: an unknown source, a source with no
 *     brackets, a page that had not heard of the new session, an unknown match, a bye,
 *     and "Usar sugestão" with nothing left to suggest.
 *   - The Produtor may send both; Dados may send neither.
 *   - Every command writes its event-log row, ok or failed.
 *   - The focus is saved: a restart keeps it.
 *
 * What these tests deliberately do not cover:
 *   - What the bound graphics show when the focus or the brackets change, and the focus
 *     never moving when a winner arrives: liveRefreshBracketMatchFocus.test.ts
 *     (modules/bindings).
 *   - Which match is suggested in each situation: shared's bracketMatchSuggestions.test.ts.
 */
import {
  buildBye,
  buildQuarterFinals,
  buildUndecidedMatch,
  superPrimeCars,
} from '@bajaovrlay/shared/superPrimeBrackets.testSupport';
import { describe, expect, it } from 'vitest';

import {
  applyOrThrow,
  dataOperatorActor,
  openStoreWithTheSimulatorOn,
  pollTheSimulatorWithRounds,
  producerActor,
  readFocusOfTheSimulator,
  readNewestEventLogRow,
  simulatorSourceId,
  superPrimeSessionId,
} from './superPrimeOnTheStore.testSupport.js';

const cars = superPrimeCars;

/** "Escolher partida" for a slot, as the page sends it. */
function buildChoiceOf(slot: 'current' | 'upNext', matchId: string | null) {
  return {
    type: 'setBracketMatchFocus',
    sourceId: simulatorSourceId,
    sessionId: superPrimeSessionId,
    slot,
    matchId,
  };
}

/** "Usar sugestão", as the page sends it. */
const acceptTheSuggestion = {
  type: 'acceptSuggestedBracketMatches',
  sourceId: simulatorSourceId,
  sessionId: superPrimeSessionId,
};

describe('setBracketMatchFocus', () => {
  it('puts the match chosen in "agora" and logs the command', () => {
    // Arrange: the quarter-finals on the simulator, nothing chosen yet.
    const { stateStore } = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()]);

    // Act: the Produtor chooses qf-2 for "agora".
    applyOrThrow(stateStore, buildChoiceOf('current', 'qf-2'));

    // Assert: qf-2 is "agora", in this session, and the row says so.
    expect(readFocusOfTheSimulator(stateStore), 'qf-2 must be "agora"').toEqual({
      sourceId: simulatorSourceId,
      sessionId: superPrimeSessionId,
      currentMatchId: 'qf-2',
    });
    const newestRow = readNewestEventLogRow(stateStore);
    expect(
      { command: newestRow?.command, actor: newestRow?.actor, result: newestRow?.result },
      "the choice must be logged as the Produtor's, ok",
    ).toEqual({ command: 'setBracketMatchFocus', actor: producerActor, result: { status: 'ok' } });
  });

  it('accepts a match listed after one not yet run, for the final run after the third place', () => {
    // Arrange: the third place listed after the final, neither run yet.
    const { stateStore } = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(stateStore, [
      buildQuarterFinals({
        'qf-1': cars.corisco,
        'qf-2': cars.pequi,
        'qf-3': cars.cactus,
        'qf-4': cars.ufsc,
      }),
      {
        name: 'Semifinal',
        matches: [
          { ...buildUndecidedMatch('sf-1', cars.corisco, cars.pequi), winnerCarNumber: 32 },
          { ...buildUndecidedMatch('sf-2', cars.cactus, cars.ufsc), winnerCarNumber: 13 },
        ],
      },
      { name: 'Final', matches: [buildUndecidedMatch('final', cars.corisco, cars.cactus)] },
      {
        name: 'Disputa de 3º lugar',
        isThirdPlace: true,
        matches: [buildUndecidedMatch('terceiro', cars.pequi, cars.ufsc)],
      },
    ]);

    // Act: the third place is run first on the day, so the Produtor puts it "agora" and
    // the final "a seguir", against the source's order.
    applyOrThrow(stateStore, buildChoiceOf('current', 'terceiro'));
    applyOrThrow(stateStore, buildChoiceOf('upNext', 'final'));

    // Assert: the slots hold what the Produtor chose.
    expect(readFocusOfTheSimulator(stateStore), 'any match may go in either slot').toEqual({
      sourceId: simulatorSourceId,
      sessionId: superPrimeSessionId,
      currentMatchId: 'terceiro',
      upNextMatchId: 'final',
    });
  });

  it('moves a match from "a seguir" to "agora", emptying "a seguir"', () => {
    // Arrange: qf-1 "agora" and qf-2 "a seguir".
    const { stateStore } = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals({ 'qf-1': cars.corisco })]);
    applyOrThrow(stateStore, buildChoiceOf('current', 'qf-1'));
    applyOrThrow(stateStore, buildChoiceOf('upNext', 'qf-2'));

    // Act: qf-2 starts, so the Produtor puts it "agora".
    applyOrThrow(stateStore, buildChoiceOf('current', 'qf-2'));

    // Assert: qf-2 is "agora" and no longer "a seguir": a match is never in both slots.
    expect(readFocusOfTheSimulator(stateStore), 'the match must move, not be in both').toEqual({
      sourceId: simulatorSourceId,
      sessionId: superPrimeSessionId,
      currentMatchId: 'qf-2',
    });
  });

  it('empties a slot when no match is given', () => {
    // Arrange: qf-1 "agora" and qf-2 "a seguir".
    const { stateStore } = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()]);
    applyOrThrow(stateStore, buildChoiceOf('current', 'qf-1'));
    applyOrThrow(stateStore, buildChoiceOf('upNext', 'qf-2'));

    // Act: the Produtor empties "a seguir".
    applyOrThrow(stateStore, buildChoiceOf('upNext', null));

    // Assert: "agora" stays, "a seguir" is empty.
    expect(readFocusOfTheSimulator(stateStore), '"a seguir" must be empty').toEqual({
      sourceId: simulatorSourceId,
      sessionId: superPrimeSessionId,
      currentMatchId: 'qf-1',
    });
  });

  it('starts a fresh focus in a new session, keeping nothing of the earlier one', () => {
    // Arrange: qf-1 "agora" and qf-2 "a seguir" in yesterday's Super Prime, then the
    // simulator restarted: a new session with the same match ids.
    const { stateStore } = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()], 'super-prime-29a-competicao');
    applyOrThrow(stateStore, {
      ...buildChoiceOf('current', 'qf-1'),
      sessionId: 'super-prime-29a-competicao',
    });
    applyOrThrow(stateStore, {
      ...buildChoiceOf('upNext', 'qf-2'),
      sessionId: 'super-prime-29a-competicao',
    });
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()]);

    // Act: the Produtor chooses qf-3 for "agora" in today's session.
    applyOrThrow(stateStore, buildChoiceOf('current', 'qf-3'));

    // Assert: today's focus holds qf-3 only; yesterday's "a seguir" is gone.
    expect(readFocusOfTheSimulator(stateStore), 'a new session starts empty').toEqual({
      sourceId: simulatorSourceId,
      sessionId: superPrimeSessionId,
      currentMatchId: 'qf-3',
    });
  });
});

describe('acceptSuggestedBracketMatches', () => {
  it('puts the first undecided match "agora" and the next "a seguir"', () => {
    // Arrange: qf-1 decided while qf-1 was "agora".
    const { stateStore } = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()]);
    applyOrThrow(stateStore, buildChoiceOf('current', 'qf-1'));
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals({ 'qf-1': cars.corisco })]);

    // Act: "Usar sugestão".
    applyOrThrow(stateStore, acceptTheSuggestion);

    // Assert: qf-2 "agora", qf-3 "a seguir", and the row is logged.
    expect(readFocusOfTheSimulator(stateStore), 'the suggestion must fill both slots').toEqual({
      sourceId: simulatorSourceId,
      sessionId: superPrimeSessionId,
      currentMatchId: 'qf-2',
      upNextMatchId: 'qf-3',
    });
    expect(readNewestEventLogRow(stateStore)?.command, 'the command must be logged').toBe(
      'acceptSuggestedBracketMatches',
    );
  });

  it('empties "a seguir" when only one match is left', () => {
    // Arrange: three quarter-finals decided, qf-4 left.
    const { stateStore } = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(stateStore, [
      buildQuarterFinals({ 'qf-1': cars.corisco, 'qf-2': cars.pequi, 'qf-3': cars.cactus }),
    ]);
    applyOrThrow(stateStore, buildChoiceOf('upNext', 'qf-1'));

    // Act: "Usar sugestão".
    applyOrThrow(stateStore, acceptTheSuggestion);

    // Assert: qf-4 "agora", nothing "a seguir" (qf-1, decided, is not kept there).
    expect(readFocusOfTheSimulator(stateStore), 'nothing must follow the last match').toEqual({
      sourceId: simulatorSourceId,
      sessionId: superPrimeSessionId,
      currentMatchId: 'qf-4',
    });
  });
});

describe('the refusals of the match focus', () => {
  const refusalScenarios = [
    {
      // A page or a script naming a source that was deleted.
      name: 'refuses a source that does not exist',
      command: { ...buildChoiceOf('current', 'qf-1'), sourceId: 'cronometragem-oficial' },
      rounds: [buildQuarterFinals()],
      expectedCode: 'DATA_SOURCE_NOT_FOUND',
      expectedMessage:
        'A fonte de dados "cronometragem-oficial" não existe; ela pode ter sido excluída.',
    },
    {
      // The source has sent no brackets (yet): there is no match to choose from.
      name: 'refuses a source that sends no brackets',
      command: buildChoiceOf('current', 'qf-1'),
      rounds: undefined,
      expectedCode: 'BRACKETS_NOT_SENT',
      expectedMessage: 'A fonte Simulador — Enduro não manda chaves agora.',
    },
    {
      // The page still showed yesterday's session when the Produtor chose: the same id
      // would land on a match of another day.
      name: 'refuses a choice made in a session the source no longer sends',
      command: { ...buildChoiceOf('current', 'qf-1'), sessionId: 'super-prime-29a-competicao' },
      rounds: [buildQuarterFinals()],
      expectedCode: 'BRACKET_SESSION_CHANGED',
      expectedMessage:
        'A chave mudou de sessão (agora super-prime-30a-competicao); escolha a partida de novo.',
    },
    {
      // A typo in a script, or a match the source dropped since the page drew its list.
      name: 'refuses a match the brackets do not list',
      command: buildChoiceOf('current', 'qf-9'),
      rounds: [buildQuarterFinals()],
      expectedCode: 'BRACKET_MATCH_NOT_FOUND',
      expectedMessage: 'A partida qf-9 não está entre as partidas disputadas da chave.',
    },
    {
      // A bye is not raced: there is nothing to put on air.
      name: 'refuses a bye',
      command: buildChoiceOf('current', 'r1-m1'),
      rounds: [
        {
          name: 'Oitavas de final',
          matches: [
            buildBye('r1-m1', cars.bajaUfmg),
            buildUndecidedMatch('r1-m2', cars.corisco, cars.buffalo),
          ],
        },
      ],
      expectedCode: 'BRACKET_MATCH_NOT_FOUND',
      expectedMessage: 'A partida r1-m1 não está entre as partidas disputadas da chave.',
    },
    {
      // The final is decided: nothing is left to suggest.
      name: 'refuses "Usar sugestão" with nothing left to suggest',
      command: acceptTheSuggestion,
      rounds: [
        buildQuarterFinals({
          'qf-1': cars.corisco,
          'qf-2': cars.pequi,
          'qf-3': cars.cactus,
          'qf-4': cars.ufsc,
        }),
      ],
      expectedCode: 'NO_SUGGESTED_BRACKET_MATCH',
      expectedMessage: 'Não há partida a sugerir: todas as partidas da chave já têm vencedor.',
    },
  ];

  it.each(refusalScenarios)('$name', ({ command, rounds, expectedCode, expectedMessage }) => {
    // Arrange: the simulator with this row's brackets (or none sent yet).
    const { stateStore } = openStoreWithTheSimulatorOn();
    if (rounds !== undefined) {
      pollTheSimulatorWithRounds(stateStore, rounds);
    }

    // Act: send the command as the Produtor.
    const outcome = stateStore.applyCommand(command, producerActor);

    // Assert: refused with the code and the sentence, logged as failed, the focus untouched.
    expect(outcome, 'the command must be refused with its reason').toEqual({
      ok: false,
      error: { code: expectedCode, message: expectedMessage },
    });
    expect(readNewestEventLogRow(stateStore)?.result, 'the refusal must be logged').toEqual({
      status: 'failed',
      error: { code: expectedCode, message: expectedMessage },
    });
    expect(readFocusOfTheSimulator(stateStore), 'a refusal must change nothing').toBeUndefined();
  });
});

describe('who may move the match focus', () => {
  it('lets the Produtor choose and refuses Dados, with a logged refusal', () => {
    // Arrange: the quarter-finals on the simulator.
    const { stateStore } = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(stateStore, [buildQuarterFinals()]);

    // Act: Dados tries both commands, then the Produtor chooses.
    const choiceByDados = stateStore.applyCommand(
      buildChoiceOf('current', 'qf-1'),
      dataOperatorActor,
    );
    const suggestionByDados = stateStore.applyCommand(acceptTheSuggestion, dataOperatorActor);
    const choiceByTheProducer = stateStore.applyCommand(
      buildChoiceOf('current', 'qf-2'),
      producerActor,
    );

    // Assert: Dados is refused NOT_ALLOWED twice; the Produtor's choice is in force.
    expect(
      [choiceByDados.ok, suggestionByDados.ok, choiceByTheProducer.ok],
      'only the Produtor may move "agora" and "a seguir"',
    ).toEqual([false, false, true]);
    expect(
      !choiceByDados.ok && choiceByDados.error.code,
      'Dados must be refused as not allowed',
    ).toBe('NOT_ALLOWED');
    expect(readFocusOfTheSimulator(stateStore)?.currentMatchId, "the Produtor's choice").toBe(
      'qf-2',
    );
  });
});

describe('the match focus across a restart', () => {
  it('keeps "agora" and "a seguir" as they were', () => {
    // Arrange: qf-1 "agora" and qf-2 "a seguir", on a database file.
    const firstBoot = openStoreWithTheSimulatorOn();
    pollTheSimulatorWithRounds(firstBoot.stateStore, [buildQuarterFinals()]);
    applyOrThrow(firstBoot.stateStore, buildChoiceOf('current', 'qf-1'));
    applyOrThrow(firstBoot.stateStore, buildChoiceOf('upNext', 'qf-2'));

    // Act: boot again on the same file.
    const secondBoot = openStoreWithTheSimulatorOn(firstBoot.databasePath);

    // Assert: the focus is back as it was.
    expect(readFocusOfTheSimulator(secondBoot.stateStore), 'a restart must keep the focus').toEqual(
      {
        sourceId: simulatorSourceId,
        sessionId: superPrimeSessionId,
        currentMatchId: 'qf-1',
        upNextMatchId: 'qf-2',
      },
    );
  });
});
