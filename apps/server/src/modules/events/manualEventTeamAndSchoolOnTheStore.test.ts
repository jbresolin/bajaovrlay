/**
 * Where a typed event's team and school come from, and a general notice (apps/server)
 *
 * What this module is for:
 *   "+ Evento" (createManualEvent) may leave the team and school blank: the server reads
 *   them from the first source whose positions list the car, and, since BAJAOVRLAY-67,
 *   from Cadastros (the teams of the entity library) when no source lists it. The source
 *   wins when both know the car: it is what the timing screen shows on the day. What the
 *   operator typed always wins over both. A typed notice may also be about no car at all
 *   ("Largada adiada em 15 minutos"), a general notice; a typed penalty never.
 *
 * What these tests prove:
 *   - Table-driven, one row per place the team and school can come from: the source, the
 *     source over Cadastros, Cadastros when no source lists the car, nowhere, and the
 *     operator's own typing over Cadastros.
 *   - A notice with no car is listed with no car, team or school, waiting.
 *   - A penalty with no car is refused (PENALTY_WITHOUT_CAR), in pt-BR, and nothing is
 *     listed.
 *
 * What these tests deliberately do not cover:
 *   - The rest of a typed event (its id, status and moment); inboxCommandsOnTheStore.test.ts.
 *   - The form that fills them in on the page; ManualEventDialog*.test.tsx.
 */
import type { Team } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildShapesWithCar31Leading } from './detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow,
  type EventInboxOnTheStore,
  openEventInboxOnTheStore,
  operatorActor,
  pollTheSimulator,
} from './eventInboxOnTheStore.testSupport.js';

/** Car 47 as Cadastros spells it: the team's full name, not the timing screen's. */
function buildCarnaubaInCadastros(): Team {
  return { carNumber: 47, teamName: 'Carnaúba Baja SAE', schoolName: 'UFERSA Mossoró' };
}

/** Car 12, which the simulator's three cars do not include. */
function buildGralhaAzulInCadastros(): Team {
  return { carNumber: 12, teamName: 'Gralha Azul Baja', schoolName: 'UTFPR' };
}

/** An inbox with the teams given saved in Cadastros, and the simulator polled or not. */
function openInboxWithCadastros(teams: Team[], isTheSimulatorPolled: boolean): EventInboxOnTheStore {
  const inbox = openEventInboxOnTheStore();
  for (const team of teams) {
    applyOrThrow(inbox.stateStore, { type: 'upsertEntity', entityType: 'team', record: team });
  }
  if (isTheSimulatorPolled) {
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
  }
  return inbox;
}

const teamAndSchoolScenarios: Array<{
  name: string;
  teams: Team[];
  isTheSimulatorPolled: boolean;
  carNumber: number;
  typed: { teamName?: string; schoolName?: string };
  expected: { teamName?: string; schoolName?: string };
}> = [
  // The source lists car 47 and Cadastros is empty: as before BAJAOVRLAY-67.
  {
    name: 'reads them from the source when only the source lists the car',
    teams: [],
    isTheSimulatorPolled: true,
    carNumber: 47,
    typed: {},
    expected: { teamName: 'Carnaúba Baja', schoolName: 'UFERSA' },
  },
  // Both know car 47 and spell it differently: the source wins, as the concept doc says.
  {
    name: 'prefers the source over Cadastros when both have the car',
    teams: [buildCarnaubaInCadastros()],
    isTheSimulatorPolled: true,
    carNumber: 47,
    typed: {},
    expected: { teamName: 'Carnaúba Baja', schoolName: 'UFERSA' },
  },
  // No source lists car 12 (it is not among the simulator's cars): Cadastros fills it.
  {
    name: 'falls back to Cadastros when no source lists the car',
    teams: [buildGralhaAzulInCadastros()],
    isTheSimulatorPolled: true,
    carNumber: 12,
    typed: {},
    expected: { teamName: 'Gralha Azul Baja', schoolName: 'UTFPR' },
  },
  // Before the first poll no source lists anything: Cadastros alone still fills it.
  {
    name: 'falls back to Cadastros when no source has polled yet',
    teams: [buildCarnaubaInCadastros()],
    isTheSimulatorPolled: false,
    carNumber: 47,
    typed: {},
    expected: { teamName: 'Carnaúba Baja SAE', schoolName: 'UFERSA Mossoró' },
  },
  // Car 99 is nowhere: the notice shows the car alone.
  {
    name: 'leaves them out when neither the sources nor Cadastros know the car',
    teams: [buildGralhaAzulInCadastros()],
    isTheSimulatorPolled: true,
    carNumber: 99,
    typed: {},
    expected: {},
  },
  // The operator typed the team: it stays, and only the blank school comes from Cadastros.
  {
    name: 'keeps what the operator typed and fills only the blank from Cadastros',
    teams: [buildGralhaAzulInCadastros()],
    isTheSimulatorPolled: true,
    carNumber: 12,
    typed: { teamName: 'Gralha Azul' },
    expected: { teamName: 'Gralha Azul', schoolName: 'UTFPR' },
  },
];

describe("a typed event's team and school", () => {
  it.each(teamAndSchoolScenarios)(
    '$name',
    ({ teams, isTheSimulatorPolled, carNumber, typed, expected }) => {
      // Arrange: Cadastros and the simulator as this row has them.
      const inbox = openInboxWithCadastros(teams, isTheSimulatorPolled);

      // Act: the operator types a notice for the car, with what this row typed.
      applyOrThrow(inbox.stateStore, {
        type: 'createManualEvent',
        noticeKind: 'notice',
        carNumber,
        ...typed,
        reason: 'Carro parado na reta dos boxes',
      });

      // Assert: the team and school this row expects, from where it expects them.
      const payload = inbox.stateStore.readAllSlices().events[0]?.payload;
      expect(
        { teamName: payload?.teamName, schoolName: payload?.schoolName },
        'the team and school must come from the place this row names',
      ).toEqual({ teamName: expected.teamName, schoolName: expected.schoolName });
    },
  );
});

describe('a general notice, about no car', () => {
  it('lists a typed notice with no car, team or school, waiting', () => {
    // Arrange: Cadastros with a team and the simulator polled, so a car could be found.
    const inbox = openInboxWithCadastros([buildGralhaAzulInCadastros()], true);

    // Act: the operator types a notice about the event itself.
    applyOrThrow(inbox.stateStore, {
      type: 'createManualEvent',
      noticeKind: 'notice',
      reason: 'Largada adiada em 15 minutos',
    });

    // Assert: the notice alone, waiting for the operator.
    const event = inbox.stateStore.readAllSlices().events[0];
    expect(event?.payload, 'a general notice carries no car, team or school').toEqual({
      noticeKind: 'notice',
      reason: 'Largada adiada em 15 minutos',
    });
    expect(event?.status, 'it waits for the operator like any typed event').toBe('pending');
  });

  it('refuses a typed penalty with no car, and lists nothing', () => {
    // Arrange: an inbox with nothing in it.
    const inbox = openInboxWithCadastros([], false);

    // Act: a penalty typed without a car.
    const outcome = inbox.stateStore.applyCommand(
      {
        type: 'createManualEvent',
        noticeKind: 'penalty',
        reason: 'Reabastecimento com o motor ligado',
        penaltyText: '+120 segundos',
      },
      operatorActor,
    );

    // Assert: refused, saying a penalty is always given to a car.
    expect(outcome, 'a penalty with no car must be refused, saying why').toEqual({
      ok: false,
      error: {
        code: 'PENALTY_WITHOUT_CAR',
        message: 'Uma penalidade é sempre dada a um carro: informe o número do carro.',
      },
    });
    expect(inbox.stateStore.readAllSlices().events, 'nothing may be listed').toEqual([]);
  });
});
