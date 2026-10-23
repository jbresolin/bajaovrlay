/**
 * The simulated race direction: penalties and warnings in a simulated enduro (apps/server)
 *
 * What this module is for:
 *   The event inbox (BAJAOVRLAY-44) shows a penalty when a source's incidents list gains
 *   one. Until the Baja app sends real ones (BAJAOVRLAY-18), the simulator plays the race
 *   direction: simulatedIncidents.ts draws a few penalties and warnings over the race
 *   (about one every 30 minutes, the first one always a penalty) from the seed, like the
 *   flags, and lists those whose moment has passed, with the car's team, a plausible
 *   pt-BR reason, the penalty and the lap the car was on.
 *
 * What these tests prove:
 *   - The same seed gives the same incidents at the same moment, and another seed gives
 *     others: the race direction is as deterministic as the rest of the race.
 *   - Every four-hour race of the seeds 1 to 100 has at least one penalty, and the
 *     default race has warnings too.
 *   - Nothing is listed at the green flag; an incident, once listed, is listed the same
 *     way (same id, same text) at every later moment, so the inbox sees it as one event.
 *   - No incident is given to a car that had already retired at its moment.
 *   - Each incident's lap is the lap the car was running at that moment.
 *   - The incidents pass the canonical shape all through the race.
 *
 * What these tests deliberately do not cover:
 *   - How the adapter dates and names the shapes (simulatorAdapter.test.ts).
 *   - Turning incidents into events (modules/events, the detectors' tests).
 *   - Whether the reasons and penalties match the real rulebook: they are plausible, not
 *     real, like everything else the simulator makes up (see the README).
 */
import { validateDataShape } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { drawBreakdownOfCar } from './breakdowns.js';
import { buildFlagScheduleOfRace, convertElapsedTimeToRunningTime } from './flags.js';
import { buildSimulatedIncidents, drawIncidentScheduleOfRace } from './simulatedIncidents.js';
import { type EnduroSimulationSettings, simulateEnduroAt } from './simulateEnduro.js';

const oneMinuteMs = 60_000;
const oneHourMs = 60 * oneMinuteMs;
const fourHoursMs = 4 * oneHourMs;
const defaultRace: EnduroSimulationSettings = {
  seed: 2027,
  carCount: 60,
  sessionDurationMs: fourHoursMs,
};
/** The session id the adapter gives the default race started at 13:00 on 14 August 2027. */
const sessionIdOfTheDefaultRace = 'simulador-enduro-2027-1818248400000';

/** The incidents of a race at an elapsed moment, built as the adapter builds them. */
function buildIncidentsAt(settings: EnduroSimulationSettings, elapsedMs: number) {
  const raceState = simulateEnduroAt(settings, elapsedMs);
  return buildSimulatedIncidents(raceState, sessionIdOfTheDefaultRace, 1_818_248_400_000);
}

describe('the incidents of a simulated race', () => {
  it('are the same for the same seed and moment, and others for another seed', () => {
    // Arrange: the default race and the same race with seed 2028, both at 3 hours.
    const otherRace = { ...defaultRace, seed: 2028 };

    // Act: build the incidents twice for the default race and once for the other.
    const firstReading = buildIncidentsAt(defaultRace, 3 * oneHourMs);
    const secondReading = buildIncidentsAt(defaultRace, 3 * oneHourMs);
    const otherSeedReading = buildIncidentsAt(otherRace, 3 * oneHourMs);

    // Assert: the same seed repeats itself exactly; another seed is another race direction.
    expect(secondReading, 'the same seed and moment must give the same incidents').toEqual(
      firstReading,
    );
    expect(otherSeedReading.entries, 'another seed must give other incidents').not.toEqual(
      firstReading.entries,
    );
  });

  it('give every four-hour race of the seeds 1 to 100 at least one penalty', () => {
    // Arrange: the seeds 1 to 100.
    const seeds = Array.from({ length: 100 }, (_, index) => index + 1);

    // Act: keep the seeds whose drawn incidents hold no penalty.
    const seedsWithoutPenalty = seeds.filter((seed) => {
      const schedule = drawIncidentScheduleOfRace({ ...defaultRace, seed });
      return !schedule.some((incident) => incident.kind === 'penalty');
    });

    // Assert: none; a rehearsal must always have a penalty to approve.
    expect(seedsWithoutPenalty, 'every race must have at least one penalty').toEqual([]);
  });

  it('give the default race both penalties and warnings, about one every 30 minutes', () => {
    // Arrange: the default four-hour race.

    // Act: draw its incidents.
    const schedule = drawIncidentScheduleOfRace(defaultRace);

    // Assert: eight incidents, the first a penalty, with warnings among the rest.
    expect(schedule, 'four hours must hold eight incidents').toHaveLength(8);
    expect(schedule[0]?.kind, 'the first incident of a race is always a penalty').toBe('penalty');
    expect(
      schedule.some((incident) => incident.kind === 'warning'),
      'the default race must have a warning too',
    ).toBe(true);
  });

  it('list nothing at the green flag', () => {
    // Arrange: the default race at its first moment.

    // Act: build its incidents.
    const incidents = buildIncidentsAt(defaultRace, 0);

    // Assert: an empty list, for the default race's session.
    expect(incidents, 'nothing has happened at the green flag').toEqual({
      sessionId: sessionIdOfTheDefaultRace,
      updatedAtMs: 1_818_248_400_000,
      entries: [],
    });
  });

  it('list an incident the same way at every later moment', () => {
    // Arrange: the incidents at 2 hours and at the end of the race.
    const atTwoHours = buildIncidentsAt(defaultRace, 2 * oneHourMs);
    const atTheEnd = buildIncidentsAt(defaultRace, fourHoursMs);

    // Act: look up, at the end, each incident listed at 2 hours.
    const sameIncidentsAtTheEnd = atTwoHours.entries.map((incident) =>
      atTheEnd.entries.find((laterIncident) => laterIncident.incidentId === incident.incidentId),
    );

    // Assert: some were listed at 2 hours, more at the end, and each one unchanged.
    expect(atTwoHours.entries.length, 'some incidents happen in two hours').toBeGreaterThan(0);
    expect(atTheEnd.entries.length, 'more happen by the end').toBeGreaterThan(
      atTwoHours.entries.length,
    );
    expect(sameIncidentsAtTheEnd, 'an incident must never change once listed').toEqual(
      atTwoHours.entries,
    );
  });

  it('never give an incident to a car that had already retired', () => {
    // Arrange: thirty seeded races and the retirement moment of each car.
    const seeds = Array.from({ length: 30 }, (_, index) => index + 1);

    // Act: keep every incident whose car had retired before its moment.
    const incidentsOfRetiredCars = seeds.flatMap((seed) => {
      const settings = { ...defaultRace, seed };
      const flagSchedule = buildFlagScheduleOfRace(seed, fourHoursMs);
      return drawIncidentScheduleOfRace(settings).filter((incident) => {
        const breakdown = drawBreakdownOfCar(seed, incident.carIndex, fourHoursMs);
        const runningMs = convertElapsedTimeToRunningTime(incident.atElapsedMs, flagSchedule);
        return breakdown?.kind === 'retirement' && breakdown.atRunningMs <= runningMs;
      });
    });

    // Assert: none; the race direction does not penalise a car parked in the paddock.
    expect(incidentsOfRetiredCars, 'no incident may go to a retired car').toEqual([]);
  });

  it("give each incident the lap its car was running at the incident's moment", () => {
    // Arrange: the default race's incidents, all of them listed at the end.
    const schedule = drawIncidentScheduleOfRace(defaultRace);
    const atTheEnd = buildIncidentsAt(defaultRace, fourHoursMs);

    // Act: for each one, the laps its car had completed at that moment, plus the one it ran.
    const lapsCheck = schedule.map((incident, index) => {
      const raceThen = simulateEnduroAt(defaultRace, incident.atElapsedMs);
      const carThen = raceThen.cars[incident.carIndex];
      const lapRunningThen = (carThen?.lapCompletedAtRunningMs.length ?? 0) + 1;
      return { expected: lapRunningThen, listed: atTheEnd.entries[index]?.lap };
    });

    // Assert: every listed lap is the lap being run when the incident happened.
    for (const { expected, listed } of lapsCheck) {
      expect(listed, 'the lap must be the one the car was running then').toBe(expected);
    }
  });

  it('pass the incidents shape every half hour of the race', () => {
    // Arrange: every half hour from the green flag to the end.
    const moments = Array.from({ length: 9 }, (_, index) => index * 30 * oneMinuteMs);

    // Act: validate the incidents at each moment.
    const problems = moments.flatMap((elapsedMs) => {
      const validation = validateDataShape('incidents', buildIncidentsAt(defaultRace, elapsedMs));
      return validation.isValid ? [] : [`${String(elapsedMs)}: ${validation.errorMessage}`];
    });

    // Assert: no moment produced an invalid shape.
    expect(problems, 'the incidents must be valid all through the race').toEqual([]);
  });
});
