/**
 * The records of the entity library (packages/shared)
 *
 * What this module is for:
 *   The entity library is our own small tables (concept §4, BAJAOVRLAY-19): teams,
 *   people, sponsors and the day's schedule, edited on the "Cadastros" page or imported
 *   from CSV, which item fields can reference. A team is keyed by its car number, the
 *   same key the positions shape uses, so a car in the race and its team join with no
 *   mapping. Every refusal is a pt-BR sentence that names the field, because the CSV
 *   preview shows it next to the line number.
 *
 * What these tests prove:
 *   - A complete team, person, sponsor and schedule slot are accepted as typed, and the
 *     optional parts may be left out, a team's city and state among them (gate 2 of
 *     PR #23: a list of teams often has neither).
 *   - Each rule a record can break is refused with its own pt-BR sentence: a car number
 *     that is not a whole number from 1, a state that is not a Brazilian UF, a tier
 *     outside the five, a roll weight outside 1 to 10, a slot that ends before it starts,
 *     a blank name.
 *   - A slice holds each key once: two teams with the same car number, or two people
 *     with the same id, are refused, naming the repeated key.
 *
 * What these tests deliberately do not cover:
 *   - The commands that change the slices; entityCommands.test.ts.
 *   - What the schedule says now ("em andamento"); scheduleSlotStatus.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { PeopleSchema, PersonSchema } from './person.js';
import { ScheduleSlotSchema } from './scheduleSlot.js';
import { SponsorSchema } from './sponsor.js';
import { TeamSchema, TeamsSchema } from './team.js';

/** The logo of Baja UFPR as the media store names it: the SHA-256 of the file. */
const logoOfBajaUfpr = '9f2c4e6a8b0d1f3e5a7c9b1d3f5e7a9c0b2d4f6e8a0c2e4f6a8b0d2f4e6a8c0b';

/** Team 42, Baja UFPR, from Curitiba, with its logo. */
function buildTeam42() {
  return {
    carNumber: 42,
    teamName: 'Baja UFPR',
    schoolName: 'UFPR',
    schoolFullName: 'Universidade Federal do Paraná',
    city: 'Curitiba',
    state: 'PR',
    logoMediaId: logoOfBajaUfpr,
  };
}

/** The first message Zod gives for a value, or undefined when it is accepted. */
function readFirstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe('a team', () => {
  it('accepts team 42 as typed, logo and full school name included', () => {
    // Arrange: team 42 as the Cadastros form sends it.
    const team42 = buildTeam42();

    // Act: check it.
    const result = TeamSchema.safeParse(team42);

    // Assert: accepted and unchanged.
    expect(result.success, 'a complete team must be accepted').toBe(true);
    expect(result.data, 'the team must not be altered').toEqual(team42);
  });

  it('accepts a team with no logo, no car photo and no full school name', () => {
    // Arrange: a team imported from CSV, which never carries images.
    const teamFromCsv = {
      carNumber: 7,
      teamName: 'Juriti Off-Road',
      schoolName: 'UDESC',
      city: 'Joinville',
      state: 'SC',
    };

    // Act: check it.
    const result = TeamSchema.safeParse(teamFromCsv);

    // Assert: accepted; the graphic shows its no-logo state for it.
    expect(result.success, 'the images and the full school name are optional').toBe(true);
  });

  it('accepts a team with no city and no state', () => {
    // Arrange: a team from a list of entries that names no city.
    const teamWithNoPlace = {
      carNumber: 13,
      teamName: 'Mutum Off-Road',
      schoolName: 'UFMT',
    };

    // Act: check it.
    const result = TeamSchema.safeParse(teamWithNoPlace);

    // Assert: accepted as it is; the team card drops its place line for it.
    expect(result.success, 'the city and the state are optional').toBe(true);
    expect(result.data, 'nothing is made up for the place').toEqual(teamWithNoPlace);
  });

  const refusedTeams = [
    // A car number is what joins a team to the race: it must be one the positions accept.
    {
      name: 'refuses car number 0',
      change: { carNumber: 0 },
      expectedMessage: 'Número do carro: um número inteiro a partir de 1.',
    },
    // A CSV cell "42,5" read as a number must not become a car.
    {
      name: 'refuses car number 42.5',
      change: { carNumber: 42.5 },
      expectedMessage: 'Número do carro: um número inteiro a partir de 1.',
    },
    // The state is the two-letter UF the team card prints; "Paraná" written out is not one.
    {
      name: 'refuses a state written out in full',
      change: { state: 'Paraná' },
      expectedMessage: 'UF: use a sigla de um estado brasileiro (por exemplo PR, SP ou DF).',
    },
    // A lower-case UF is a typo the operator can fix; it is not guessed.
    {
      name: 'refuses a lower-case state',
      change: { state: 'pr' },
      expectedMessage: 'UF: use a sigla de um estado brasileiro (por exemplo PR, SP ou DF).',
    },
    // A team with no name would put an empty line on air.
    {
      name: 'refuses a blank team name',
      change: { teamName: '   ' },
      expectedMessage: 'Nome da equipe: obrigatório.',
    },
    // The media store names files by their SHA-256; anything else is not one of ours.
    {
      name: 'refuses a logo that is not a media id',
      change: { logoMediaId: '../../etc/passwd' },
      expectedMessage: 'Logo: não é uma imagem enviada ao servidor.',
    },
  ];

  it.each(refusedTeams)('$name', ({ change, expectedMessage }) => {
    // Arrange: team 42 with one part broken.
    const brokenTeam = { ...buildTeam42(), ...change };

    // Act: check it.
    const result = TeamSchema.safeParse(brokenTeam);

    // Assert: refused, with the pt-BR sentence the CSV preview shows.
    expect(result.success, 'the broken team must be refused').toBe(false);
    expect(readFirstMessage(result), 'the reason must name the field in pt-BR').toBe(
      expectedMessage,
    );
  });

  it('trims the spaces a CSV cell carries around a name', () => {
    // Arrange: a team name pasted with spaces around it.
    const teamWithSpaces = { ...buildTeam42(), teamName: '  Baja UFPR  ' };

    // Act: check it.
    const result = TeamSchema.safeParse(teamWithSpaces);

    // Assert: stored without the spaces, so two copies of the team do not look different.
    expect(result.data?.teamName, 'the name must be stored trimmed').toBe('Baja UFPR');
  });
});

describe('the teams slice', () => {
  it('refuses two teams with the same car number, naming the car', () => {
    // Arrange: car 42 twice, as a CSV with a repeated line would give.
    const teams = [buildTeam42(), { ...buildTeam42(), teamName: 'Baja UFPR B' }];

    // Act: check the slice.
    const result = TeamsSchema.safeParse(teams);

    // Assert: refused; a car number joins one team only.
    expect(result.success, 'a car number must belong to one team').toBe(false);
    expect(readFirstMessage(result), 'the reason must name the car').toBe(
      'O carro 42 aparece duas vezes.',
    );
  });

  it('accepts two teams with different car numbers', () => {
    // Arrange: cars 42 and 7.
    const teams = [
      buildTeam42(),
      {
        carNumber: 7,
        teamName: 'Juriti Off-Road',
        schoolName: 'UDESC',
        city: 'Joinville',
        state: 'SC',
      },
    ];

    // Act: check the slice.
    const result = TeamsSchema.safeParse(teams);

    // Assert: accepted.
    expect(result.success, 'different cars must be accepted together').toBe(true);
  });
});

describe('a person', () => {
  it('accepts the narrator with no team and no photo', () => {
    // Arrange: the narrator of the stream.
    const narrator = { personId: 'narrador-joao', name: 'João Bresolin', role: 'Narrador' };

    // Act: check it.
    const result = PersonSchema.safeParse(narrator);

    // Assert: accepted as typed.
    expect(result.data, 'a person needs only an id, a name and a role').toEqual(narrator);
  });

  it('accepts a team member with the car number of their team', () => {
    // Arrange: the captain of team 42.
    const captain = {
      personId: 'capita-ufpr',
      name: 'Ana Souza',
      role: 'Capitã',
      carNumber: 42,
    };

    // Act: check it.
    const result = PersonSchema.safeParse(captain);

    // Assert: accepted with the car number.
    expect(result.data?.carNumber, 'the team is named by its car number').toBe(42);
  });

  it('refuses a person with no role, naming the field', () => {
    // Arrange: a judge whose role was left blank.
    const judgeWithoutRole = { personId: 'juiz-1', name: 'Carlos Lima', role: '' };

    // Act: check it.
    const result = PersonSchema.safeParse(judgeWithoutRole);

    // Assert: refused; a lower third with no role reads as a mistake on air.
    expect(readFirstMessage(result), 'the reason must name the role').toBe('Função: obrigatório.');
  });

  it('refuses two people with the same id in the slice', () => {
    // Arrange: two rows that both say narrador-joao.
    const people = [
      { personId: 'narrador-joao', name: 'João Bresolin', role: 'Narrador' },
      { personId: 'narrador-joao', name: 'João B.', role: 'Comentarista' },
    ];

    // Act: check the slice.
    const result = PeopleSchema.safeParse(people);

    // Assert: refused, naming the id.
    expect(readFirstMessage(result), 'the reason must name the repeated id').toBe(
      'O id "narrador-joao" aparece duas vezes.',
    );
  });
});

describe('a sponsor', () => {
  /** The Diamante sponsor, in every roll more often than anyone. */
  function buildDiamanteSponsor() {
    return {
      sponsorId: 'patrocinador-diamante',
      name: 'Mineradora Serra Azul',
      tier: 'diamante',
      rollWeight: 10,
    };
  }

  it('accepts the Diamante sponsor with no logo yet', () => {
    // Arrange: the sponsor, imported from CSV before its logo was uploaded.
    const sponsor = buildDiamanteSponsor();

    // Act: check it.
    const result = SponsorSchema.safeParse(sponsor);

    // Assert: accepted; the logo is added on the page later.
    expect(result.data, 'a sponsor without a logo must be accepted').toEqual(sponsor);
  });

  const refusedSponsors = [
    // The levels are the design's six (sponsorLevels.ts); "platina" is not one.
    {
      name: 'refuses a level outside the six',
      change: { tier: 'platina' },
      expectedMessage: 'Cota: use diamante, ouro, prata, bronze, apoio ou realizacao.',
    },
    // A weight of 0 would mean "never in the roll"; deleting the sponsor says that.
    {
      name: 'refuses a roll weight of 0',
      change: { rollWeight: 0 },
      expectedMessage: 'Peso no rodízio: um número inteiro de 1 a 10.',
    },
    // The scale stops at 10, so the Diamante sponsor is not drowned by a typo of 100.
    {
      name: 'refuses a roll weight of 11',
      change: { rollWeight: 11 },
      expectedMessage: 'Peso no rodízio: um número inteiro de 1 a 10.',
    },
    // Half a weight has no meaning in a roll.
    {
      name: 'refuses a roll weight of 2.5',
      change: { rollWeight: 2.5 },
      expectedMessage: 'Peso no rodízio: um número inteiro de 1 a 10.',
    },
  ];

  it.each(refusedSponsors)('$name', ({ change, expectedMessage }) => {
    // Arrange: the Diamante sponsor with one part broken.
    const brokenSponsor = { ...buildDiamanteSponsor(), ...change };

    // Act: check it.
    const result = SponsorSchema.safeParse(brokenSponsor);

    // Assert: refused with the pt-BR sentence.
    expect(readFirstMessage(result), 'the reason must name the field in pt-BR').toBe(
      expectedMessage,
    );
  });
});

describe('a schedule slot', () => {
  /** The enduro on Saturday 14 November 2026, from 10:00 to 14:00 in Brasília (UTC−3). */
  function buildSaturdayEnduroSlot() {
    return {
      slotId: 'enduro-sabado',
      sessionName: 'Enduro de Resistência',
      sessionKind: 'enduro',
      startsAtMs: Date.parse('2026-11-14T13:00:00.000Z'),
      endsAtMs: Date.parse('2026-11-14T17:00:00.000Z'),
      place: 'Pista principal',
    };
  }

  it('accepts the enduro with its start, end and place', () => {
    // Arrange: the Saturday enduro.
    const slot = buildSaturdayEnduroSlot();

    // Act: check it.
    const result = ScheduleSlotSchema.safeParse(slot);

    // Assert: accepted as typed.
    expect(result.data, 'a complete slot must be accepted').toEqual(slot);
  });

  it('accepts a slot with no end and no place', () => {
    // Arrange: the awards ceremony, whose end nobody knows.
    const ceremony = {
      slotId: 'premiacao',
      sessionName: 'Premiação',
      sessionKind: 'other',
      startsAtMs: Date.parse('2026-11-15T19:00:00.000Z'),
    };

    // Act: check it.
    const result = ScheduleSlotSchema.safeParse(ceremony);

    // Assert: accepted.
    expect(result.success, 'the end and the place are optional').toBe(true);
  });

  const refusedSlots = [
    // An end before the start is a typo, and would make the status meaningless.
    {
      name: 'refuses a slot that ends before it starts',
      change: { endsAtMs: Date.parse('2026-11-14T12:00:00.000Z') },
      expectedMessage: 'Fim: deve ser depois do início.',
    },
    // The kinds are the session shape's own, so a slot and a source say the same word.
    {
      name: 'refuses a kind of session the shapes do not know',
      change: { sessionKind: 'rally' },
      expectedMessage:
        'Prova: use enduro, acceleration, speed, traction, suspension, maneuverability ou other.',
    },
  ];

  it.each(refusedSlots)('$name', ({ change, expectedMessage }) => {
    // Arrange: the enduro with one part broken.
    const brokenSlot = { ...buildSaturdayEnduroSlot(), ...change };

    // Act: check it.
    const result = ScheduleSlotSchema.safeParse(brokenSlot);

    // Assert: refused with the pt-BR sentence.
    expect(readFirstMessage(result), 'the reason must name the field in pt-BR').toBe(
      expectedMessage,
    );
  });
});
