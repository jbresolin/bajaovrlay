/**
 * The Baja app tournament preset against the tournament answers (packages/shared)
 *
 * What this module is for:
 *   The tournament preset (torneio.preset.json, BAJAOVRLAY-54) reads the Baja app's
 *   torneio.php into brackets: rounds holding matches, a round with a pending or unknown
 *   side left out with the rounds after it, the third place moved before the final. The
 *   names come from the event's teams (equipes.php, every 10 minutes), short else full, as
 *   in the race and table presets: a regional event's teams may have no short names at all
 *   (26SE has none), and its Super Prime must still map (gate 2 of PR #38). These tests run
 *   it on the real 25SU and 26BR Super Primes and the made-up pending one, and validate
 *   every shape it gives, as the store does with a poll.
 *
 * What these tests prove:
 *   - The real 25SU and 26BR Super Primes and the made-up pending one pass, ending with the
 *     rounds expected.
 *   - Names: the teams' short names first; the tournament's own when the teams have none;
 *     the teams' full names when neither has a short one (25SU with every short name
 *     blanked, as 26SE's would be).
 *   - A bye is a W.O. on either slot: the real 25SU bye (second slot) and the same match
 *     with the bye on the first slot both give car 4 alone, by W.O.; a match raced carries
 *     no W.O.
 *
 * What these tests deliberately do not cover:
 *   - Grouping matches into rounds and the round contracts on their own:
 *     applyFlexMappingBrackets.test.ts and applyFlexMappingBracketContracts.test.ts.
 *   - The other presets: bajaAppPresets.test.ts and bajaAppRacePreset.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { bajaAppFixtureFiles, readBajaAppFixture } from '../../bajaAppFixtures.testSupport.js';
import { buildBracketConfigOf25SU, mapAndValidate } from './bajaAppPresetMapping.testSupport.js';

/** One match of the brackets as the tests read it. */
type MappedMatch = Record<string, unknown> & {
  carA?: Record<string, unknown>;
  carB?: Record<string, unknown>;
};

/** The matches of the first round ("Oitavas de Final" in 25SU) of mapped brackets. */
function readFirstRoundMatches(shapes: Record<string, unknown> | undefined): MappedMatch[] {
  const brackets = shapes?.brackets as { rounds: Array<{ matches: MappedMatch[] }> } | undefined;
  return brackets?.rounds[0]?.matches ?? [];
}

/** The real 25SU Super Prime with one change made to a copy of it. */
function build25SUSuperPrimeWith(change: (tournament: Record<string, unknown>) => void) {
  const tournament = readBajaAppFixture(bajaAppFixtureFiles.superPrime25SU);
  change(tournament);
  return tournament;
}

/** Blanks the short names of every team in a tournament, as an event without them has. */
function blankTheTournamentShortNames(tournament: Record<string, unknown>): void {
  const rounds = tournament.rounds as Array<{ matches: Array<{ slots: unknown[] }> }>;
  for (const round of rounds) {
    for (const match of round.matches) {
      for (const slot of match.slots as Array<{ team?: Record<string, unknown> }>) {
        if (slot.team !== undefined) {
          slot.team.short_name = '';
          slot.team.school_short = '';
        }
      }
    }
  }
}

/** The real 25SU teams, their short names blanked as 26SE's are. */
function build25SUTeamsWithoutShortNames() {
  const teams = readBajaAppFixture(bajaAppFixtureFiles.teams25SU);
  const teamList = teams.teams as Array<Record<string, unknown>>;
  return {
    ...teams,
    teams: teamList.map((team) => ({ ...team, short_name: '', school_short: null })),
  };
}

describe('the tournament preset', () => {
  const bracketScenarios = [
    // The real 25SU Super Prime: byes, best of 3, the third place listed after the final.
    {
      name: 'maps the real 25SU Super Prime, the third place moved before the final',
      tournamentFile: bajaAppFixtureFiles.superPrime25SU,
      teamsFile: bajaAppFixtureFiles.teams25SU,
      expectedLastRounds: ['Disputa 3° lugar', 'Final'],
    },
    // The real 26BR Super Prime: 64 slots, single races until the semifinals.
    {
      name: 'maps the real 26BR Super Prime',
      tournamentFile: bajaAppFixtureFiles.superPrime26BR,
      teamsFile: bajaAppFixtureFiles.teams26BR,
      expectedLastRounds: ['Disputa 3° lugar', 'Final'],
    },
    // The made-up bracket: the semifinals still running, so the final and third place
    // have pending sides and are left out until they are known.
    {
      name: 'leaves out the made-up bracket’s pending final and third place',
      tournamentFile: bajaAppFixtureFiles.superPrime25SUWithPendingSlots,
      teamsFile: bajaAppFixtureFiles.teams25SU,
      expectedLastRounds: ['Quartas de final', 'Semifinais'],
    },
  ];

  it.each(bracketScenarios)('$name', ({ tournamentFile, teamsFile, expectedLastRounds }) => {
    // Arrange: this row's tournament answer and its event's teams.
    const responses = {
      torneio: readBajaAppFixture(tournamentFile),
      equipes: readBajaAppFixture(teamsFile),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildBracketConfigOf25SU(), responses);

    // Assert: valid brackets, ending with this row's rounds.
    expect(problems, 'the tournament must map with no problem').toEqual([]);
    const brackets = shapes?.brackets as { rounds: Array<{ name: string }> };
    expect(
      brackets.rounds.slice(-2).map((round) => round.name),
      'the last two rounds listed',
    ).toEqual(expectedLastRounds);
  });

  const nameScenarios = [
    // The teams' short names win, whatever the tournament writes: the tournament's blanked.
    {
      name: 'names the cars by the teams’ short names',
      tournament: build25SUSuperPrimeWith(blankTheTournamentShortNames),
      teams: readBajaAppFixture(bajaAppFixtureFiles.teams25SU),
      expectedCars: [
        ['Pelznickel', 'UNIFEBE'],
        ['Coyote', 'UCS-CX'],
      ],
    },
    // An empty teams list: the tournament's own short names are the next choice.
    {
      name: 'falls back to the tournament’s own short names when the teams list has none',
      tournament: readBajaAppFixture(bajaAppFixtureFiles.superPrime25SU),
      teams: { event_id: '25SU', teams: [] },
      expectedCars: [
        ['Pelznickel', 'UNIFEBE'],
        ['Coyote', 'UCS-CX'],
      ],
    },
    // No short name anywhere, as on 26SE: the teams' full names, rather than every poll
    // failing on a missing team name.
    {
      name: 'falls back to the teams’ full names when no short name exists anywhere',
      tournament: build25SUSuperPrimeWith(blankTheTournamentShortNames),
      teams: build25SUTeamsWithoutShortNames(),
      expectedCars: [
        ['Pelznickel UNIFEBE', 'Centro Universitário da Fundação Educacional de Brusque - UNIFEBE'],
        ['Coyote Baja', 'Universidade de Caxias do Sul - Caxias do Sul'],
      ],
    },
  ];

  it.each(nameScenarios)('$name', ({ tournament, teams, expectedCars }) => {
    // Arrange: this row's tournament and teams.
    const responses = { torneio: tournament, equipes: teams };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildBracketConfigOf25SU(), responses);

    // Assert: valid, and match 114 (car 6 against car 10) named as this row says.
    expect(problems, 'the tournament must map with no problem').toEqual([]);
    const match114 = readFirstRoundMatches(shapes)[1];
    expect(
      [match114?.carA, match114?.carB].map((car) => [car?.teamName, car?.schoolName]),
      'the two cars of match 114, team and school',
    ).toEqual(expectedCars);
  });

  const byeScenarios = [
    // The real answer: match 113's bye is on the second slot.
    { name: 'gives a bye on the second slot as car 4 alone by W.O.', isByeOnTheFirstSlot: false },
    // The same match with its slots the other way round: the API may draw it either way.
    { name: 'gives a bye on the first slot as car 4 alone by W.O.', isByeOnTheFirstSlot: true },
  ];

  it.each(byeScenarios)('$name', ({ isByeOnTheFirstSlot }) => {
    // Arrange: the real 25SU Super Prime, match 113's slots swapped for the second row.
    const tournament = build25SUSuperPrimeWith((answer) => {
      const rounds = answer.rounds as Array<{ matches: Array<{ slots: unknown[] }> }>;
      const match113 = rounds[0]?.matches[0];
      if (isByeOnTheFirstSlot && match113 !== undefined) {
        match113.slots.reverse();
      }
    });
    const responses = {
      torneio: tournament,
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams25SU),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildBracketConfigOf25SU(), responses);

    // Assert: valid; car 4 is carA, through by W.O., with no carB; match 114, raced, says
    // nothing of a W.O. (the API marks none but byes).
    expect(problems, 'the tournament must map with no problem').toEqual([]);
    const [match113, match114] = readFirstRoundMatches(shapes);
    expect(match113, 'car 4 alone, by W.O.').toEqual({
      matchId: '113',
      bestOf: 3,
      walkover: true,
      winnerCarNumber: 4,
      carA: { carNumber: 4, teamName: 'Sinuelo', schoolName: 'FAHOR', wins: 0 },
    });
    expect(match114?.walkover, 'a match raced is not a W.O.').toBeUndefined();
  });
});
