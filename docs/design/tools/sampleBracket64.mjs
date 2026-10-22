// Builds the 64-slot sample bracket for buildSampleData.mjs: the cars seeded in the order
// given, drawn in the standard order (seed 1 meets seed 64, the winner meets the winner of
// 32 against 33, and so on), every match best of three, the better seed winning except where
// the fixture names an upset winner (in the first two rounds only), and the last round left
// undecided. A field short of the slots (60 cars in 64) gives the top seeds a bye: a match
// with no second car, won by W.O.; and the fixture names matches where the opponent did not
// run, also won by W.O. A separate file because it is one responsibility: a plausible draw.

/** The standard draw order of n seeds: 1 meets n, and the pairs fold so 1 and 2 meet last. */
function standardDrawOrder(seedCount) {
  let order = [1];
  while (order.length < seedCount) {
    const size = order.length * 2;
    order = order.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return order;
}

/** A match with no second car: the car in it advances by W.O. without running. */
function buildByeMatch(matchId, car) {
  return {
    matchId,
    walkover: true,
    carA: { ...car, timeText: '' },
    winnerCarNumber: car.carNumber,
  };
}

/**
 * The rounds of a best-of-three bracket over `seededCars` (seed 1 first; each a carNumber,
 * teamName and schoolName), with the fixture's title, round names, upset winners and
 * walkovers. In the standard order the better seed is always first in a pair, so a missing
 * car is always the second one.
 */
export function buildBracket64(seededCars, fixture) {
  const seedOfCar = new Map(seededCars.map((car, index) => [car.carNumber, index + 1]));
  const isUpsetWinner = (car) => fixture.upsetWinnerSeeds.includes(seedOfCar.get(car.carNumber));
  const betterSeeded = (carA, carB) =>
    seedOfCar.get(carA.carNumber) < seedOfCar.get(carB.carNumber) ? carA : carB;

  // A seed past the field has no car: its slot is empty.
  let carsInRound = standardDrawOrder(seededCars.length).map((seed) => seededCars[seed - 1]);
  const lastDecidedRound = fixture.roundNames.length - 1;
  const rounds = fixture.roundNames.map((name, roundIndex) => {
    const matches = [];
    for (let matchIndex = 0; matchIndex < carsInRound.length / 2; matchIndex += 1) {
      const matchId = `r${roundIndex + 1}-m${matchIndex + 1}`;
      const carA = carsInRound[matchIndex * 2];
      const carB = carsInRound[matchIndex * 2 + 1];
      if (carB === undefined) {
        matches.push(buildByeMatch(matchId, carA));
        continue;
      }
      const favourite = betterSeeded(carA, carB);
      const outsider = favourite === carA ? carB : carA;
      const upset = roundIndex < 2 && isUpsetWinner(outsider);
      const winner = upset ? outsider : favourite;
      const decided = roundIndex < lastDecidedRound;
      // The opponent did not run: no races, the winner advances by W.O.
      const isWalkover = decided && fixture.walkoverMatchIds.includes(matchId);
      // The loser takes one of the three races every third match, so 2–1 shows beside 2–0.
      const loserWins = matchIndex % 3 === 0 ? 1 : 0;
      const describe = (car) => {
        const hasWins = decided && !isWalkover;
        let wins;
        if (hasWins) wins = car === winner ? 2 : loserWins;
        return { ...car, timeText: '', wins };
      };
      matches.push({
        matchId,
        bestOf: fixture.bestOf,
        walkover: isWalkover || undefined,
        carA: describe(carA),
        carB: describe(carB),
        winnerCarNumber: decided ? winner.carNumber : undefined,
      });
    }
    carsInRound = matches.map((match) => {
      const carAWon = match.carA.carNumber === match.winnerCarNumber;
      return carAWon ? match.carA : match.carB;
    });
    return { name, matches };
  });
  return { title: fixture.title, rounds };
}
