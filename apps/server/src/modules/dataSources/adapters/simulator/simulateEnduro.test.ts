/**
 * The simulated enduro, as a pure function of seed and time (apps/server)
 *
 * What this module is for:
 *   simulateEnduroAt answers the whole state of a simulated Baja enduro (every car's
 *   completed laps, pit stops, breakdowns and the flag) at one simulated moment, from
 *   the seed alone, with no memory between calls. A restart, a replay or a test asks
 *   for a moment and gets the same race.
 *
 * What these tests prove:
 *   - Same seed and same moment give a deep-equal race; another seed, another race.
 *   - Over four hours with 60 cars (a handful of seeds): some cars retire, within a
 *     stated band; pit stops happen; at least one yellow comes out; laps stay plausible.
 *   - Cars stop at the line after the checkered flag, and nothing moves once finished.
 *   - One race told in race language, from the 2027 seed, so a change to the model
 *     that rewrites the race shows up here; in it, a car that retires during a pit
 *     stop shows retired from that moment.
 *   - It is fast: a poll at the end of a four-hour race with 60 cars takes well under
 *     the shortest poll interval.
 *
 * What these tests deliberately do not cover:
 *   - The shapes built from the state (shapesFromRaceState.test.ts).
 *   - Wall time and speed (simulatorAdapter.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { orderCarsByRacePosition } from './raceOrder.js';
import { type EnduroRaceState, simulateEnduroAt } from './simulateEnduro.js';

const fourHoursMs = 4 * 60 * 60 * 1000;
const oneMinuteMs = 60_000;
/** The default race: seed 2027, 60 cars, four hours. */
const defaultRace = { seed: 2027, carCount: 60, sessionDurationMs: fourHoursMs };
/** Long enough after the start for any red and the checkered period to be over. */
const longAfterTheFinishMs = fourHoursMs + 2 * 60 * oneMinuteMs;

/** The car of a race state with the given number; throws when it is not racing. */
function findCar(raceState: EnduroRaceState, carNumber: number) {
  const car = raceState.cars.find((candidate) => candidate.carNumber === carNumber);
  if (car === undefined) {
    throw new Error(`car ${String(carNumber)} is not in the race`);
  }
  return car;
}

describe('the same race at the same moment', () => {
  it('is deep-equal for the same seed and moment, and different for another seed', () => {
    // Arrange: two hours into the default race, and the same moment of seed 2028.
    const twoHoursMs = 2 * 60 * oneMinuteMs;

    // Act: simulate the 2027 race twice and the 2028 race once.
    const firstLook = simulateEnduroAt(defaultRace, twoHoursMs);
    const secondLook = simulateEnduroAt(defaultRace, twoHoursMs);
    const anotherRace = simulateEnduroAt({ ...defaultRace, seed: 2028 }, twoHoursMs);

    // Assert: the same race twice, and seed 2028 is not that race.
    expect(secondLook, 'the same seed and moment must give the same race').toEqual(firstLook);
    expect(anotherRace.cars, 'another seed must give another race').not.toEqual(firstLook.cars);
  });

  it('does not depend on the moments asked before', () => {
    // Arrange: the race ninety minutes in, asked first, as by the first poll after a restart.
    const ninetyMinutesMs = 90 * oneMinuteMs;
    const askedFirst = simulateEnduroAt(defaultRace, ninetyMinutesMs);

    // Act: ask for three other moments (one of another race), then ninety minutes again.
    simulateEnduroAt(defaultRace, 10 * oneMinuteMs);
    simulateEnduroAt(defaultRace, 3 * 60 * oneMinuteMs);
    simulateEnduroAt({ ...defaultRace, seed: 7 }, ninetyMinutesMs);
    const afterOtherCalls = simulateEnduroAt(defaultRace, ninetyMinutesMs);

    // Assert: the history of calls changes nothing.
    expect(afterOtherCalls, 'the race must not remember earlier calls').toEqual(askedFirst);
  });
});

describe('four hours of enduro with 60 cars, over a handful of seeds', () => {
  const seedsToCheck = [1, 2, 3, 2027, 31337];
  // The band of the field that may retire over four hours. The model aims at about 15 %
  // breaking down, half of them for good (7.5 %, four or five cars in 60); these five
  // seeds retire 2 to 8 cars. The floor, 3 %, is two cars in 60: a model that retired
  // almost nobody fails it. The ceiling, a fifth of the field, catches one gone wild.
  const fewestRetiredShare = 0.03;
  const mostRetiredShare = 0.2;

  it.each(seedsToCheck)('seed %i retires 3 to 20 %% of the field', (seed) => {
    // Arrange: the race of this seed, long after the finish.
    const race = { ...defaultRace, seed };

    // Act: look at the race when everything is over.
    const finalState = simulateEnduroAt(race, longAfterTheFinishMs);

    // Assert: the share of retired cars is inside the stated band.
    const retiredCars = finalState.cars.filter((car) => car.status === 'retired');
    const retiredShare = retiredCars.length / finalState.cars.length;
    expect(
      retiredShare,
      'at least two cars in 60 must retire over four hours',
    ).toBeGreaterThanOrEqual(fewestRetiredShare);
    expect(retiredShare, 'no more than a fifth of the field may retire').toBeLessThanOrEqual(
      mostRetiredShare,
    );
  });

  it.each(seedsToCheck)('seed %i has pit stops for every car still running', (seed) => {
    // Arrange: the race of this seed, long after the finish.
    const race = { ...defaultRace, seed };

    // Act: look at the race when everything is over.
    const finalState = simulateEnduroAt(race, longAfterTheFinishMs);

    // Assert: every car that did not retire pitted at least twice (a stop every 8 to 14
    // laps, and a four-hour race is 30 or more laps).
    const finishers = finalState.cars.filter((car) => car.status !== 'retired');
    const finishersWithFewPitStops = finishers.filter((car) => car.pitStopCount < 2);
    expect(
      finishersWithFewPitStops.map((car) => car.carNumber),
      'every finisher must have pitted at least twice',
    ).toEqual([]);
  });

  it.each(seedsToCheck)('seed %i shows a yellow flag at some moment', (seed) => {
    // Arrange: the race of this seed, sampled every minute of the four hours.
    const race = { ...defaultRace, seed };
    const minutes = Array.from({ length: 240 }, (_, index) => index);

    // Act: read the flag at each minute.
    const flagsSeen = new Set(
      minutes.map((minute) => simulateEnduroAt(race, minute * oneMinuteMs).flag),
    );

    // Assert: a yellow came out at least once.
    expect(flagsSeen.has('yellow'), 'a four-hour enduro must see at least one yellow').toBe(true);
  });

  it.each(seedsToCheck)('seed %i keeps every lap between 4 and 30 minutes', (seed) => {
    // Arrange: the race of this seed, long after the finish.
    const race = { ...defaultRace, seed };

    // Act: look at every completed lap.
    const finalState = simulateEnduroAt(race, longAfterTheFinishMs);
    const lapDurationsMs = finalState.cars.flatMap((car) =>
      car.lapCompletedAtRunningMs.map(
        (completedAtMs, index) => completedAtMs - (car.lapCompletedAtRunningMs[index - 1] ?? 0),
      ),
    );

    // Assert: no lap faster than 4:00, none slower than a lap with a long breakdown stop.
    const shortestLapMs = Math.min(...lapDurationsMs);
    const longestLapMs = Math.max(...lapDurationsMs);
    expect(shortestLapMs, 'no lap may be faster than 4 minutes').toBeGreaterThan(4 * oneMinuteMs);
    expect(longestLapMs, 'no lap may be slower than 30 minutes').toBeLessThan(30 * oneMinuteMs);
  });
});

describe('the checkered flag', () => {
  it('makes each running car cross the line exactly once after the checkered flag', () => {
    // Arrange: the checkered flag comes out when four hours of running time are up.
    const checkeredAtRunningMs = fourHoursMs;

    // Act: look at the race once the session is over.
    const finishedState = simulateEnduroAt(defaultRace, longAfterTheFinishMs);

    // Assert: every car that did not retire has exactly one lap completed after the
    // checkered moment: its final lap.
    const carsWithoutExactlyOneFinalLap = finishedState.cars
      .filter((car) => car.status !== 'retired')
      .filter((car) => {
        const lapsAfterTheCheckered = car.lapCompletedAtRunningMs.filter(
          (completedAtMs) => completedAtMs >= checkeredAtRunningMs,
        );
        return lapsAfterTheCheckered.length !== 1;
      })
      .map((car) => car.carNumber);
    expect(
      carsWithoutExactlyOneFinalLap,
      'every running car must take the checkered flag exactly once',
    ).toEqual([]);
  });

  it('moves nothing once the session is finished', () => {
    // Arrange: two moments after the session is finished, the second much later.
    const finishedAtMs = longAfterTheFinishMs;
    const muchLaterMs = longAfterTheFinishMs * 2;

    // Act: look at the race at both moments.
    const finishedState = simulateEnduroAt(defaultRace, finishedAtMs);
    const muchLaterState = simulateEnduroAt(defaultRace, muchLaterMs);

    // Assert: the session is finished, and every car is exactly where it was.
    expect(finishedState.flag, 'the session is finished long after the end').toBe('finished');
    expect(muchLaterState.cars, 'nothing may move once the session is finished').toEqual(
      finishedState.cars,
    );
  });
});

describe('the 2027 race, told in race language', () => {
  it('car 58 pits from the lead after lap 35 and retires, and car 25 takes the lead and wins', () => {
    // Arrange: three moments of the 2027 race, found by exploring the seeded race: 2 h 47
    // in, 2 h 55 in, and long after the finish. A change to the model that rewrites this
    // race breaks this test on purpose, so the reviewer sees the race changed.
    const at2h47Ms = 167 * oneMinuteMs;
    const at2h55Ms = 175 * oneMinuteMs;

    // Act: look at the race order at each moment.
    const leaderAt2h47 = orderCarsByRacePosition(simulateEnduroAt(defaultRace, at2h47Ms).cars)[0];
    const raceAt2h55 = simulateEnduroAt(defaultRace, at2h55Ms);
    const leaderAt2h55 = orderCarsByRacePosition(raceAt2h55.cars)[0];
    const winner = orderCarsByRacePosition(
      simulateEnduroAt(defaultRace, longAfterTheFinishMs).cars,
    )[0];

    // Assert: 58 leads from the pits on 35 laps; then 58 is out and 25 leads; 25 wins.
    expect(leaderAt2h47?.carNumber, 'car 58 must lead at 2 h 47').toBe(58);
    expect(leaderAt2h47?.status, 'the leader must be in the pits').toBe('inPit');
    expect(leaderAt2h47?.lapCompletedAtRunningMs, 'the leader has done 35 laps').toHaveLength(35);
    expect(findCar(raceAt2h55, 58).status, 'car 58 must have retired by 2 h 55').toBe('retired');
    expect(
      findCar(raceAt2h55, 58).lapCompletedAtRunningMs,
      'car 58 retired without completing another lap',
    ).toHaveLength(35);
    expect(leaderAt2h55?.carNumber, 'car 25 must lead at 2 h 55').toBe(25);
    expect(winner?.carNumber, 'car 25 must win the race').toBe(25);
    expect(winner?.hasTakenTheCheckeredFlag, 'the winner must take the checkered flag').toBe(true);
    expect(winner?.lapCompletedAtRunningMs, 'the winner does 51 laps').toHaveLength(51);
  });

  it('car 58 shows retired from the moment it breaks down in the pits', () => {
    // Arrange: car 58 went into the pits at 2 h 46 min 13 s for a stop that would end at
    // 2 h 49 min 17 s, and breaks down for good at 2 h 47 min 23.8 s, during the stop.
    // Look a second before and a moment after the breakdown, both inside the stop.
    const secondBeforeTheBreakdownMs = 10_043_000;
    const justAfterTheBreakdownMs = 10_044_000;

    // Act: read car 58 at both moments.
    const beforeTheBreakdown = findCar(
      simulateEnduroAt(defaultRace, secondBeforeTheBreakdownMs),
      58,
    );
    const afterTheBreakdown = findCar(simulateEnduroAt(defaultRace, justAfterTheBreakdownMs), 58);

    // Assert: in the pits before; retired after, not in the pits until the stop's end.
    expect(beforeTheBreakdown.status, 'car 58 is in the pits before it breaks down').toBe('inPit');
    expect(
      afterTheBreakdown.status,
      'car 58 must show retired once it broke down, though its stop has not ended',
    ).toBe('retired');
  });
});

describe('the time a poll takes', () => {
  it('simulates the end of a four-hour race with 60 cars in well under 200 ms', () => {
    // Arrange: warm the code up once, as a running server would be.
    simulateEnduroAt(defaultRace, fourHoursMs);

    // Act: time ten polls at the end of the race.
    const startedAtMs = performance.now();
    for (let poll = 0; poll < 10; poll += 1) {
      simulateEnduroAt(defaultRace, fourHoursMs - poll * 1000);
    }
    const averagePollMs = (performance.now() - startedAtMs) / 10;

    // Assert: a generous bound (the budget is 50 ms; this machine-independent check only
    // catches a model that went quadratic).
    expect(averagePollMs, 'one poll must take well under 200 ms').toBeLessThan(200);
  });
});
