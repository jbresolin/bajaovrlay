/**
 * The match in a slot of the focus, and what the graphics receive of it (packages/shared)
 *
 * What this module is for:
 *   A binding to "Chaves › Partida agora" or "Partida a seguir" (BAJAOVRLAY-65) reads the
 *   match the operator put in that slot, from the brackets the source sends now, and
 *   joins each car with its team in Cadastros by car number (the team card's join): the
 *   team's full name, its city and state, its logo. Graphics still receive resolved data
 *   only; this module builds that data.
 *
 * What these tests prove:
 *   - A slot reads the chosen match with its round; an empty slot, a focus of another
 *     session and no focus at all read as not chosen; a chosen match the source no longer
 *     lists reads as gone, naming it.
 *   - The data of a match: the round, the third place, the best of (1 when the source
 *     says nothing), the winner, and each car's number, short name, school and result.
 *   - The join: a team in Cadastros gives its full name, city, state and logo (with its
 *     light plate); a team missing from Cadastros keeps its short name as its name and
 *     has no city or logo, rather than failing the match.
 *
 * What these tests deliberately do not cover:
 *   - Reading one field of that data through a binding, and the live refresh when the
 *     focus changes: bindingResolutionBracketMatchFocus.test.ts and the server's tests.
 */
import { describe, expect, it } from 'vitest';

import type { Team } from '../entities/team.js';
import { buildFakeMediaId } from '../media/fakeMediaIds.testSupport.js';
import type { BracketMatchFocus } from './bracketMatchFocus.js';
import { describeFocusedMatchForGraphics, readFocusedBracketMatch } from './focusedBracketMatch.js';
import {
  buildBestOfThreeUnderWay,
  buildQuarterFinals,
  buildSuperPrimeBrackets,
  superPrimeCars,
} from './superPrimeBrackets.testSupport.js';

const cars = superPrimeCars;

/** The media id of Corisco's logo in the media store. */
const logoOfCoriscoMediaId = buildFakeMediaId(32);

/** Corisco (car 32) in Cadastros with its full name, city, state and a dark logo. */
function buildCoriscoInCadastros(): Team {
  return {
    carNumber: 32,
    teamName: 'Corisco Baja UPE',
    schoolName: 'UPE',
    city: 'Recife',
    state: 'PE',
    logoMediaId: logoOfCoriscoMediaId,
    logoOnLightPlate: true,
  };
}

/** The focus of the simulator's Super Prime with qf-2 "agora" and nothing "a seguir". */
function buildFocusWithQuarterFinal2Now(): BracketMatchFocus {
  return {
    sourceId: 'simulador-enduro',
    sessionId: 'super-prime-30a-competicao',
    currentMatchId: 'qf-2',
  };
}

describe('readFocusedBracketMatch', () => {
  it('reads the match chosen for a slot, with its round', () => {
    // Arrange: the quarter-finals, with qf-2 chosen "agora".
    const brackets = buildSuperPrimeBrackets([buildQuarterFinals()]);
    const focus = buildFocusWithQuarterFinal2Now();

    // Act: read the "agora" slot.
    const reading = readFocusedBracketMatch(brackets, focus, 'current');

    // Assert: it is qf-2, Pequi against Acauã, in the quarter-finals.
    expect(reading.status, 'a chosen match the source lists must read as chosen').toBe('chosen');
    if (reading.status !== 'chosen') {
      return;
    }
    expect(reading.matchInPlayOrder.match.matchId, 'the slot must hold qf-2').toBe('qf-2');
    expect(reading.matchInPlayOrder.roundName, 'the round must come with it').toBe(
      'Quartas de final',
    );
  });

  const emptyScenarios = [
    {
      // Nothing was ever chosen for this source.
      name: 'reads no focus at all as not chosen',
      focus: undefined,
      slot: 'current' as const,
    },
    {
      // "agora" is chosen, "a seguir" is not.
      name: 'reads an empty slot as not chosen',
      focus: buildFocusWithQuarterFinal2Now(),
      slot: 'upNext' as const,
    },
    {
      // The focus was chosen in an earlier session (the simulator restarted since): it
      // must never show a match of another day.
      name: 'reads a focus of another session as not chosen',
      focus: { ...buildFocusWithQuarterFinal2Now(), sessionId: 'super-prime-29a-competicao' },
      slot: 'current' as const,
    },
  ];

  it.each(emptyScenarios)('$name', ({ focus, slot }) => {
    // Arrange: the quarter-finals of today's session.
    const brackets = buildSuperPrimeBrackets([buildQuarterFinals()]);

    // Act: read the slot.
    const reading = readFocusedBracketMatch(brackets, focus, slot);

    // Assert: there is no match to show.
    expect(reading, 'the slot must read as not chosen').toEqual({ status: 'notChosen' });
  });

  it('reads a chosen match the source stopped listing as gone, naming it', () => {
    // Arrange: qf-2 chosen "agora", then the source lists the quarter-finals without it.
    const quarterFinals = buildQuarterFinals();
    const brackets = buildSuperPrimeBrackets([
      {
        ...quarterFinals,
        matches: quarterFinals.matches.filter((match) => match.matchId !== 'qf-2'),
      },
    ]);

    // Act: read the "agora" slot.
    const reading = readFocusedBracketMatch(brackets, buildFocusWithQuarterFinal2Now(), 'current');

    // Assert: the slot is gone, and says which match went.
    expect(reading, 'a removed match must read as gone, never as another match').toEqual({
      status: 'gone',
      matchId: 'qf-2',
    });
  });
});

describe('describeFocusedMatchForGraphics', () => {
  it('joins a car with its team in Cadastros: full name, city, state and logo', () => {
    // Arrange: a semifinal at 1 × 1 between Corisco (in Cadastros) and Pequi.
    const matchInPlayOrder = {
      match: buildBestOfThreeUnderWay('sf-1', cars.corisco, 1, cars.pequi, 1),
      roundName: 'Semifinal',
      isThirdPlace: false,
    };

    // Act: build the data the graphics receive.
    const data = describeFocusedMatchForGraphics(matchInPlayOrder, [buildCoriscoInCadastros()]);

    // Assert: Corisco carries what Cadastros knows, beside the bracket's short name.
    expect(data.carA, 'Corisco must be joined with its team by car number').toEqual({
      carNumber: 32,
      shortName: 'Corisco',
      teamName: 'Corisco Baja UPE',
      schoolName: 'UPE',
      city: 'Recife',
      state: 'PE',
      logoUrl: `/media/${logoOfCoriscoMediaId}`,
      logoOnLightPlate: true,
      wins: 1,
    });
    expect(
      { roundName: data.roundName, isThirdPlace: data.isThirdPlace, bestOf: data.bestOf },
      'the round and the series must come with the match',
    ).toEqual({ roundName: 'Semifinal', isThirdPlace: false, bestOf: 3 });
  });

  it('keeps a team missing from Cadastros with its short name and no city or logo', () => {
    // Arrange: the same semifinal; Pequi (car 12) is not in Cadastros.
    const matchInPlayOrder = {
      match: buildBestOfThreeUnderWay('sf-1', cars.corisco, 1, cars.pequi, 1),
      roundName: 'Semifinal',
      isThirdPlace: false,
    };

    // Act: build the data the graphics receive.
    const data = describeFocusedMatchForGraphics(matchInPlayOrder, [buildCoriscoInCadastros()]);

    // Assert: Pequi is drawn from the bracket alone, nothing invented.
    expect(data.carB, "a team not in Cadastros must keep the bracket's names only").toEqual({
      carNumber: 12,
      shortName: 'Pequi',
      teamName: 'Pequi',
      schoolName: 'UnB',
      wins: 1,
    });
  });

  it('gives a single race a best of 1, its times and its winner', () => {
    // Arrange: a timed quarter-final Corisco won, run in 41.9 s against 43.2 s.
    const matchInPlayOrder = {
      match: {
        matchId: 'qf-1',
        carA: { ...cars.corisco, timeMs: 41_870 },
        carB: { ...cars.buffalo, timeMs: 43_215 },
        winnerCarNumber: 32,
      },
      roundName: 'Quartas de final',
      isThirdPlace: false,
    };

    // Act: build the data the graphics receive, with nobody in Cadastros.
    const data = describeFocusedMatchForGraphics(matchInPlayOrder, []);

    // Assert: a best of 1, the two times and Corisco as the winner.
    expect(data.bestOf, 'a match with no best of is a single race').toBe(1);
    expect(
      [data.carA.timeMs, data.carB.timeMs],
      'each car must carry its time in this match',
    ).toEqual([41_870, 43_215]);
    expect(data.winnerCarNumber, 'the winner must be named once decided').toBe(32);
  });
});
