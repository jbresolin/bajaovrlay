/**
 * What "Usar sugestão" puts in "agora" and "a seguir" (packages/shared)
 *
 * What this module is for:
 *   Once the match "agora" is over, the console proposes the next one and "Usar sugestão"
 *   puts it on air (BAJAOVRLAY-65). The operator's own "a seguir" comes first: when "a
 *   seguir" holds a match still to race (the final put there by hand, to run it before
 *   the third place), the proposal moves that match up to "agora", and "a seguir" takes
 *   the next match in play order still to race. Only when "a seguir" is empty, or holds
 *   nothing left to race, is the proposal the play-order suggestion. The page shows this
 *   proposal and the server applies the same one, from the same function.
 *
 * What these tests prove:
 *   - One row per situation: "a seguir" empty; "a seguir" that followed the suggestion; a
 *     match skipped by hand; the final run before the third place; the last match moved
 *     up; "a seguir" already decided or gone from the source; "agora" gone from the
 *     source, with and without a chosen "a seguir"; a focus of another session; no focus.
 *
 * What these tests deliberately do not cover:
 *   - The play-order suggestion itself (byes, a best of 3 under way, the last match
 *     decided): bracketMatchSuggestions.test.ts.
 *   - Refusing "Usar sugestão" when the proposal changed after the page showed it: the
 *     server's bracketMatchFocusCommands.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { BracketRound } from '../dataShapes/index.js';
import type { BracketMatchFocus } from './bracketMatchFocus.js';
import { proposeBracketMatches } from './bracketMatchProposal.js';
import {
  buildDecidedMatch,
  buildQuarterFinals,
  buildSuperPrimeBrackets,
  buildUndecidedMatch,
  parseRoundsAsASourceSendsThem,
  superPrimeCars,
} from './superPrimeBrackets.testSupport.js';

const cars = superPrimeCars;

/** The session of the Super Prime builders. */
const superPrimeSessionId = 'super-prime-30a-competicao';

/** The simulator's focus in this session, with what the operator put in each slot. */
function buildFocusOfThisSession(slots: {
  currentMatchId?: string;
  upNextMatchId?: string;
}): BracketMatchFocus {
  return { sourceId: 'simulador-enduro', sessionId: superPrimeSessionId, ...slots };
}

/**
 * The finals day: quarter-finals and semifinals decided (Corisco and Cactus through), the
 * third place listed before the final as every source lists it (contract C), each
 * decided or not as asked.
 */
function buildFinalsDay(decided: { thirdPlace: boolean; final: boolean }): BracketRound[] {
  const thirdPlace = decided.thirdPlace
    ? buildDecidedMatch('terceiro', cars.pequi, cars.ufsc, cars.pequi)
    : buildUndecidedMatch('terceiro', cars.pequi, cars.ufsc);
  const final = decided.final
    ? buildDecidedMatch('final', cars.corisco, cars.cactus, cars.corisco)
    : buildUndecidedMatch('final', cars.corisco, cars.cactus);
  return [
    buildQuarterFinals({
      'qf-1': cars.corisco,
      'qf-2': cars.pequi,
      'qf-3': cars.cactus,
      'qf-4': cars.ufsc,
    }),
    {
      name: 'Semifinal',
      matches: [
        buildDecidedMatch('sf-1', cars.corisco, cars.pequi, cars.corisco),
        buildDecidedMatch('sf-2', cars.cactus, cars.ufsc, cars.cactus),
      ],
    },
    { name: 'Disputa de 3º lugar', isThirdPlace: true, matches: [thirdPlace] },
    { name: 'Final', matches: [final] },
  ];
}

describe('proposeBracketMatches', () => {
  const proposalScenarios = [
    {
      // Nothing chosen "a seguir": the play-order suggestion, as at the start of the day.
      name: 'proposes the play-order suggestion when "a seguir" is empty',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      focus: buildFocusOfThisSession({ currentMatchId: 'qf-1' }),
      expected: { currentMatchId: 'qf-2', upNextMatchId: 'qf-3' },
    },
    {
      // "A seguir" was the suggestion when it was set: moving it up gives the suggestion.
      name: 'moves "a seguir" up when it followed the suggestion, which agrees with it',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      focus: buildFocusOfThisSession({ currentMatchId: 'qf-1', upNextMatchId: 'qf-2' }),
      expected: { currentMatchId: 'qf-2', upNextMatchId: 'qf-3' },
    },
    {
      // A car of qf-2 is still in the pits, so the Produtor put qf-3 "a seguir" by hand:
      // qf-3 goes "agora" and qf-2, the first still to race, comes "a seguir".
      name: 'moves a match chosen by hand up to "agora", skipping one not ready',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      focus: buildFocusOfThisSession({ currentMatchId: 'qf-1', upNextMatchId: 'qf-3' }),
      expected: { currentMatchId: 'qf-3', upNextMatchId: 'qf-2' },
    },
    {
      // João's case: the final runs before the third place listed ahead of it. With the
      // final "a seguir" by hand, it goes "agora" and the third place comes after it.
      name: 'moves the final up before the third place when the Produtor put it "a seguir"',
      rounds: buildFinalsDay({ thirdPlace: false, final: false }),
      focus: buildFocusOfThisSession({ currentMatchId: 'sf-2', upNextMatchId: 'final' }),
      expected: { currentMatchId: 'final', upNextMatchId: 'terceiro' },
    },
    {
      // The final is over and the third place, the last match, was "a seguir": it goes
      // "agora" and nothing is left to come after it.
      name: 'moves the last match up and leaves "a seguir" empty',
      rounds: buildFinalsDay({ thirdPlace: false, final: true }),
      focus: buildFocusOfThisSession({ currentMatchId: 'final', upNextMatchId: 'terceiro' }),
      expected: { currentMatchId: 'terceiro', upNextMatchId: undefined },
    },
    {
      // qf-3 was run while qf-1 was "agora" (the bug never followed it): a decided match
      // is never proposed, so the play-order suggestion applies.
      name: 'falls back on the suggestion when "a seguir" is already decided',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco, 'qf-3': cars.cactus })],
      focus: buildFocusOfThisSession({ currentMatchId: 'qf-1', upNextMatchId: 'qf-3' }),
      expected: { currentMatchId: 'qf-2', upNextMatchId: 'qf-4' },
    },
    {
      // The source stopped listing the match "a seguir": there is nothing to move up.
      name: 'falls back on the suggestion when "a seguir" left the source',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      focus: buildFocusOfThisSession({ currentMatchId: 'qf-1', upNextMatchId: 'qf-9' }),
      expected: { currentMatchId: 'qf-2', upNextMatchId: 'qf-3' },
    },
    {
      // "Agora" left the source and nothing is "a seguir": the play-order suggestion, so
      // the bug can go back on air in one press.
      name: 'proposes the suggestion when "agora" left the source',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      focus: buildFocusOfThisSession({ currentMatchId: 'qf-9' }),
      expected: { currentMatchId: 'qf-2', upNextMatchId: 'qf-3' },
    },
    {
      // "Agora" left the source but the Produtor had chosen "a seguir": that comes first.
      name: 'moves the chosen "a seguir" up when "agora" left the source',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      focus: buildFocusOfThisSession({ currentMatchId: 'qf-9', upNextMatchId: 'qf-4' }),
      expected: { currentMatchId: 'qf-4', upNextMatchId: 'qf-2' },
    },
    {
      // The simulator restarted: a focus of another session reads as empty, so its "a
      // seguir" (a match id of another day) is never moved up.
      name: 'ignores the "a seguir" of a focus of another session',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      focus: {
        sourceId: 'simulador-enduro',
        sessionId: 'super-prime-29a-competicao',
        currentMatchId: 'qf-1',
        upNextMatchId: 'qf-4',
      },
      expected: { currentMatchId: 'qf-2', upNextMatchId: 'qf-3' },
    },
    {
      // Nothing was ever chosen for this source.
      name: 'proposes the suggestion when the source has no focus at all',
      rounds: [buildQuarterFinals()],
      focus: undefined,
      expected: { currentMatchId: 'qf-1', upNextMatchId: 'qf-2' },
    },
  ];

  it.each(proposalScenarios)('$name', ({ rounds, focus, expected }) => {
    // Arrange: the brackets the source sends, checked by the brackets shape, and the
    // focus the operator left.
    const brackets = buildSuperPrimeBrackets(parseRoundsAsASourceSendsThem(rounds));

    // Act: ask what "Usar sugestão" would put in the two slots.
    const proposal = proposeBracketMatches(brackets, focus);

    // Assert: "agora" and "a seguir" are the expected matches, or nothing.
    expect(proposal, 'the proposal must put the operator\'s "a seguir" first').toEqual(expected);
  });
});
