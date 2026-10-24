// Finds the enduro's best battle for the battle card (BAJAOVRLAY-43): the two cars that ran
// on the same lap, one right behind the other, for the most consecutive real laps. A lap
// counts only when both cars crossed the line for real (a lap time at or above the timing
// floor: the export's batch-credited laps say nothing about a gap), the car behind within
// `withinMs` of the car ahead, and no other car crossed that lap between them (a fight for
// one place, not two cars with a third between). The race has few close fights, so the search runs over the
// whole race rather than at the static pages' moment.

/** The best battle: the two cars, the moments of its laps and each lap's gap, in order. */
export function findBestBattle(passes, minimumLapTimeMs, withinMs) {
  const realCrossing = new Map();
  const crossingMomentsByLap = new Map();
  for (const [carNumber, lap, crossedAtMs, lapTimeMs] of passes) {
    if (!crossingMomentsByLap.has(lap)) crossingMomentsByLap.set(lap, []);
    crossingMomentsByLap.get(lap).push(crossedAtMs);
    if (lapTimeMs !== null && lapTimeMs >= minimumLapTimeMs)
      realCrossing.set(`${carNumber}:${lap}`, crossedAtMs);
  }
  const carNumbers = [...new Set(passes.map((pass) => pass[0]))];
  const maximumLap = Math.max(...passes.map((pass) => pass[1]));
  let best = null;
  for (const aheadCar of carNumbers) {
    for (const behindCar of carNumbers) {
      if (aheadCar === behindCar) continue;
      let run = [];
      for (let lap = 1; lap <= maximumLap + 1; lap += 1) {
        const aheadAt = realCrossing.get(`${aheadCar}:${lap}`);
        const behindAt = realCrossing.get(`${behindCar}:${lap}`);
        const gapMs = behindAt - aheadAt;
        const isClose =
          aheadAt !== undefined && behindAt !== undefined && gapMs > 0 && gapMs <= withinMs;
        const carsBetween = (crossingMomentsByLap.get(lap) ?? []).filter(
          (moment) => moment > aheadAt && moment < behindAt,
        );
        if (isClose && carsBetween.length === 0) {
          run.push({ lap, crossedAtMs: behindAt, gapMs });
          continue;
        }
        const isBetter = best === null || run.length > best.laps.length;
        if (run.length > 0 && isBetter) best = { aheadCar, behindCar, laps: run };
        run = [];
      }
    }
  }
  return best;
}
