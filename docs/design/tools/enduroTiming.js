// The enduro's timing rules for the design (BAJAOVRLAY-43): from the real passes
// (sample_data/results/enduro_passes.xlsx: car, lap, moment it crossed the line, lap time),
// the order of the cars at any moment, each car's laps, gap, interval, last and best lap,
// the race clock, and the on-air text of every number (pt-BR, tenths cut, never rounded, as
// docs/00-concept.md §8 rules). One file for both sides: buildSampleData.mjs (Node) imports
// it to write the static pages' sample, and the enduro timeline page loads it as a classic
// script to recompute the tower as the operator scrubs, so the two can never disagree. That
// is why it sets globalThis.enduroTiming instead of exporting: a page opened from the file
// system cannot load an ES module, and Node runs this file as one all the same.
(function defineEnduroTiming() {
  // ---------------------------------------------------------------- on-air text

  /** A countdown rounds partial seconds up: "1:16:00", dropping the hours while zero. */
  function formatRemainingClock(clockTimeMs) {
    const wholeSeconds = Math.ceil(Math.max(0, clockTimeMs) / 1000);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const seconds = String(wholeSeconds % 60).padStart(2, '0');
    if (hours === 0) return `${minutes}:${seconds}`;
    return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`;
  }

  /** A time of day: 46 865 000 ms after midnight reads "13:01:05". */
  function formatTimeOfDay(msAfterMidnight) {
    const wholeSeconds = Math.floor(msAfterMidnight / 1000);
    const parts = [
      Math.floor(wholeSeconds / 3600),
      Math.floor((wholeSeconds % 3600) / 60),
      wholeSeconds % 60,
    ];
    return parts.map((part) => String(part).padStart(2, '0')).join(':');
  }

  /** 12 399 ms reads "12,3": tenths, cut, decimal comma. */
  function writeSecondsToTheTenthCut(durationMs) {
    const wholeTenths = Math.floor(durationMs / 100);
    return `${Math.floor(wholeTenths / 10)},${wholeTenths % 10}`;
  }

  /** A lap time on air: "4:38,2" (minutes, seconds, one tenth, cut); "" when unknown. */
  function formatLapTimeOnAir(lapTimeMs) {
    if (lapTimeMs === undefined) return '';
    const wholeTenths = Math.floor(lapTimeMs / 100);
    const totalSeconds = Math.floor(wholeTenths / 10);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${Math.floor(totalSeconds / 60)}:${seconds},${wholeTenths % 10}`;
  }

  // A gap or interval: "12,3 s" under a minute; "38:50,0" from a minute up (a car that stopped
  // for a long time on the same lap), where 2330 seconds would not be read as a time.
  const oneMinuteMs = 60 * 1000;
  const writeTimeBehind = (durationMs) =>
    durationMs < oneMinuteMs
      ? `${writeSecondsToTheTenthCut(durationMs)} s`
      : formatLapTimeOnAir(durationMs);

  /** "+12,3 s", "+1 volta", "+2 voltas", or "" when there is no gap (the leader). */
  function formatGapToLeader(entry) {
    if (entry.gapToLeaderLaps !== undefined) {
      return entry.gapToLeaderLaps === 1 ? '+1 volta' : `+${entry.gapToLeaderLaps} voltas`;
    }
    if (entry.gapToLeaderMs !== undefined) return `+${writeTimeBehind(entry.gapToLeaderMs)}`;
    return '';
  }

  /** The interval to the car ahead: "+6,6 s" on its lap, "+1 volta" behind it; "" for the leader. */
  function formatInterval(entry) {
    if (entry.intervalLaps !== undefined) {
      return entry.intervalLaps === 1 ? '+1 volta' : `+${entry.intervalLaps} voltas`;
    }
    if (entry.intervalMs === undefined) return '';
    return `+${writeTimeBehind(entry.intervalMs)}`;
  }

  /** "34 VOLTAS", "1 VOLTA". */
  function writeLapsLabel(laps) {
    return laps === 1 ? '1 VOLTA' : `${laps} VOLTAS`;
  }

  // ---------------------------------------------------------------- the order at a moment

  // The export credits missed laps in batches (many cars at the same second, 11:52:54,
  // 13:02:02...), with lap times of a few seconds. Those laps count, as the timing team
  // counted them, but their times are not laps: a time under the floor is no car's last or
  // best lap and never a fastest lap. The track's real laps run from about 2:57; 2:45 also drops the 2:31 that follows a batch.
  const minimumLapTimeMs = 165000;
  const isLapTimeReal = (lapTimeMs) => lapTimeMs !== null && lapTimeMs >= minimumLapTimeMs;

  // Each car's crossings up to `atMs`: the lap counter and the moment, in order. A pass is
  // [carNumber, lap, msAfterMidnight, lapTimeMs or null] (compact, the page embeds 1 123).
  function collectCrossingsByCar(passes, atMs) {
    const crossingsByCar = new Map();
    for (const [carNumber, lap, crossedAtMs, lapTimeMs] of passes) {
      if (crossedAtMs > atMs) continue;
      if (!crossingsByCar.has(carNumber)) crossingsByCar.set(carNumber, []);
      crossingsByCar.get(carNumber).push({ lap, crossedAtMs, lapTimeMs });
    }
    crossingsByCar.forEach((crossings) =>
      crossings.sort((first, second) => first.lap - second.lap),
    );
    return crossingsByCar;
  }

  /**
   * The cars in order at `atMs`: most laps first, then whoever completed that lap first.
   * Each entry has the canonical positions fields (position, carNumber, laps, lastLapMs,
   * bestLapMs, gapToLeaderMs or gapToLeaderLaps, intervalMs, status) and the lap of its best.
   */
  function positionsAt(passes, atMs) {
    const crossingsByCar = collectCrossingsByCar(passes, atMs);
    const cars = [...crossingsByCar.entries()].map(([carNumber, crossings]) => {
      const lastCrossing = crossings.at(-1);
      const timedLaps = crossings.filter(
        (crossing) => isLapTimeReal(crossing.lapTimeMs) && crossing.lap > 0,
      );
      const best = timedLaps.reduce(
        (fastest, crossing) =>
          fastest === null || crossing.lapTimeMs < fastest.lapTimeMs ? crossing : fastest,
        null,
      );
      return {
        carNumber,
        laps: lastCrossing.lap,
        reachedAtMs: lastCrossing.crossedAtMs,
        crossedAtMsByLap: new Map(
          crossings.map((crossing) => [crossing.lap, crossing.crossedAtMs]),
        ),
        lastLapMs: isLapTimeReal(lastCrossing.lapTimeMs) ? lastCrossing.lapTimeMs : undefined,
        bestLapMs: best?.lapTimeMs,
        bestLapNumber: best?.lap,
      };
    });
    cars.sort(
      (first, second) =>
        second.laps - first.laps ||
        first.reachedAtMs - second.reachedAtMs ||
        first.carNumber - second.carNumber,
    );
    const leader = cars[0];
    return cars.map((car, index) => {
      const entry = {
        position: index + 1,
        carNumber: car.carNumber,
        laps: car.laps,
        lastLapMs: car.lastLapMs,
        bestLapMs: car.bestLapMs,
        bestLapNumber: car.bestLapNumber,
        status: 'running',
      };
      if (index === 0 || car.laps === 0) return entry;
      if (car.laps === leader.laps)
        entry.gapToLeaderMs = car.reachedAtMs - leader.crossedAtMsByLap.get(car.laps);
      else entry.gapToLeaderLaps = leader.laps - car.laps;
      // The interval is a time only behind a car on the same lap. Behind a car a lap or more
      // ahead it is that many laps: a time there runs to many minutes, and the export's
      // batch-credited laps can even make it negative.
      const carAhead = cars[index - 1];
      if (carAhead.laps > car.laps) entry.intervalLaps = carAhead.laps - car.laps;
      else entry.intervalMs = car.reachedAtMs - carAhead.crossedAtMsByLap.get(car.laps);
      return entry;
    });
  }

  /**
   * The race clock at `atMs` for a session that starts at `startMs` and lasts `durationMs`:
   * the time remaining, the flag (green while it runs, checkered from the end, the cars still
   * finishing their lap) and the leader's laps.
   */
  function sessionAt(passes, atMs, startMs, durationMs) {
    const elapsedMs = atMs - startMs;
    let flag = 'green';
    if (elapsedMs < 0) flag = 'pre';
    if (elapsedMs >= durationMs) flag = 'checkered';
    const leader = positionsAt(passes, atMs)[0];
    return {
      flag,
      remainingMs: Math.max(0, durationMs - Math.max(0, elapsedMs)),
      lapsCompletedByLeader: leader?.laps ?? 0,
    };
  }

  /**
   * Every moment the overall best lap was beaten, in order: the car, its lap, the time. The
   * first lap from the standing start is left out (it is not a flying lap), and so is every
   * time under the floor above.
   */
  function listFastestLapEvents(passes) {
    const byMoment = [...passes].sort((first, second) => first[2] - second[2]);
    const events = [];
    let bestSoFar = Infinity;
    for (const [carNumber, lap, crossedAtMs, lapTimeMs] of byMoment) {
      if (!isLapTimeReal(lapTimeMs) || lap < 2 || lapTimeMs >= bestSoFar) continue;
      bestSoFar = lapTimeMs;
      events.push({ carNumber, lap, crossedAtMs, lapTimeMs });
    }
    return events;
  }

  globalThis.enduroTiming = {
    formatRemainingClock,
    formatTimeOfDay,
    writeSecondsToTheTenthCut,
    formatLapTimeOnAir,
    formatGapToLeader,
    formatInterval,
    writeLapsLabel,
    positionsAt,
    sessionAt,
    listFastestLapEvents,
    minimumLapTimeMs,
  };
})();
