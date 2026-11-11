/**
 * Why a match focus command is refused (apps/server)
 *
 * What this module is for:
 *   The two match focus commands (BAJAOVRLAY-65), "Escolher partida"
 *   (setBracketMatchFocus) and "Usar sugestão" (acceptSuggestedBracketMatches), are
 *   refused, with a code and a pt-BR sentence, whenever they would put on air something
 *   the Produtor did not mean: a source or match that is not there, another day's session,
 *   or a proposal that changed after the page showed it.
 *
 * What these tests prove, one row each, every refusal logged as failed with the focus
 *   untouched:
 *   - An unknown source; a source that sends no brackets; a page that had not heard of
 *     the new session; a match the brackets do not list; a bye.
 *   - "Usar sugestão" with nothing left to suggest.
 *   - "Usar sugestão" when the proposal changed between the page showing it and the
 *     server receiving it: "agora" changed, or only "a seguir" did.
 *
 * What these tests deliberately do not cover:
 *   - The commands applied, the roles and a restart: bracketMatchFocusCommands.test.ts.
 *   - Which match is proposed in each situation: shared's bracketMatchProposal.test.ts.
 */
import {
  buildBye,
  buildQuarterFinals,
  buildUndecidedMatch,
  superPrimeCars,
} from '@bajaovrlay/shared/superPrimeBrackets.testSupport';
import { describe, expect, it } from 'vitest';

import {
  buildAcceptOf,
  buildChoiceOf,
  openStoreWithTheSimulatorOn,
  pollTheSimulatorWithRounds,
  producerActor,
  readFocusOfTheSimulator,
  readNewestEventLogRow,
} from './superPrimeOnTheStore.testSupport.js';

const cars = superPrimeCars;

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
      command: buildAcceptOf('qf-4', null),
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
    {
      // The page showed qf-1 then qf-2, but qf-1 got its winner before the press reached
      // the server: the proposal is now qf-2 then qf-3, and the press must not put on air
      // something the Produtor never saw.
      name: 'refuses "Usar sugestão" when the proposal changed after the page showed it',
      command: buildAcceptOf('qf-1', 'qf-2'),
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      expectedCode: 'BRACKET_PROPOSAL_CHANGED',
      expectedMessage:
        'A sugestão mudou desde que a página a mostrou (agora qf-2, a seguir qf-3); confira e use a sugestão de novo.',
    },
    {
      // Only "a seguir" changed: the page showed nothing after qf-3, but the source now
      // lists another match still to race.
      name: 'refuses "Usar sugestão" when only "a seguir" of the proposal changed',
      command: buildAcceptOf('qf-2', null),
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      expectedCode: 'BRACKET_PROPOSAL_CHANGED',
      expectedMessage:
        'A sugestão mudou desde que a página a mostrou (agora qf-2, a seguir qf-3); confira e use a sugestão de novo.',
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
