// Builds the 64-car sample bracket for buildSampleData.mjs: the cars seeded in the order
// given, drawn in the standard order (seed 1 meets seed 64, the winner meets the winner of
// 32 against 33, and so on), every match best of three, the better seed winning except where
// the fixture names an upset winner (in the first two rounds only), and the last round left
// undecided. A separate file because it is one responsibility: a plausible big draw.

/** The standard draw order of n seeds: 1 meets n, and the pairs fold so 1 and 2 meet last. */
function standardDrawOrder(seedCount) {
  let order = [1];
  while (order.length < seedCount) {
    const size = order.length * 2;
    order = order.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return order;
}

/**
 * The rounds of a best-of-three bracket over `seededCars` (seed 1 first; each a carNumber,
 * teamName and schoolName), with the fixture's title, round names and upset winners.
 */
export function buildBracket64(seededCars, fixture) {
  const seedOfCar = new Map(seededCars.map((car, index) => [car.carNumber, index + 1]));
  const isUpsetWinner = (car) => fixture.upsetWinnerSeeds.includes(seedOfCar.get(car.carNumber));
  const betterSeeded = (carA, carB) =>
    seedOfCar.get(carA.carNumber) < seedOfCar.get(carB.carNumber) ? carA : carB;

  let carsInRound = standardDrawOrder(seededCars.length).map((seed) => seededCars[seed - 1]);
  const lastDecidedRound = fixture.roundNames.length - 1;
  const rounds = fixture.roundNames.map((name, roundIndex) => {
    const matches = [];
    for (let matchIndex = 0; matchIndex < carsInRound.length / 2; matchIndex += 1) {
      const carA = carsInRound[matchIndex * 2];
      const carB = carsInRound[matchIndex * 2 + 1];
      const favourite = betterSeeded(carA, carB);
      const outsider = favourite === carA ? carB : carA;
      const upset = roundIndex < 2 && isUpsetWinner(outsider);
      const winner = upset ? outsider : favourite;
      const decided = roundIndex < lastDecidedRound;
      // The loser takes one of the three races every third match, so 2–1 shows beside 2–0.
      const loserWins = matchIndex % 3 === 0 ? 1 : 0;
      const describe = (car) => ({
        ...car,
        timeText: '',
        wins: decided ? (car === winner ? 2 : loserWins) : undefined,
      });
      matches.push({
        matchId: `r${roundIndex + 1}-m${matchIndex + 1}`,
        bestOf: fixture.bestOf,
        carA: describe(carA),
        carB: describe(carB),
        winnerCarNumber: decided ? winner.carNumber : undefined,
      });
    }
    carsInRound = matches.map((match) =>
      match.carA.carNumber === match.winnerCarNumber ? match.carA : match.carB,
    );
    return { name, matches };
  });
  return { title: fixture.title, rounds };
}
