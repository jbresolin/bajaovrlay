/**
 * What changed between the cars visible before an update and after it, keyed by car
 * number: the view keeps one row node per visible car, so the diff says which nodes to
 * keep (and slide), which to create and which to take away. Slots count from 1 on the
 * page, whatever the page's first position is.
 */

/** A car that was on the page and still is, with its slot before and after. */
export type StayingRow = {
  carNumber: number;
  slotBefore: number;
  slotAfter: number;
  /** `up` when the car climbed toward slot 1, `down` when it dropped, `same` otherwise. */
  direction: 'up' | 'down' | 'same';
};

/** The whole comparison. */
export type TowerRowDiff = {
  /** The cars on both pages, in the order of the page after. */
  staying: StayingRow[];
  /** The car numbers that were not on the page and now are, in page order. */
  entering: number[];
  /** The car numbers that were on the page and no longer are, in their old order. */
  leaving: number[];
  /** The car now in slot 1 when it is not the car that was there; undefined otherwise. */
  newLeaderCarNumber: number | undefined;
};

type EntryWithCarNumber = { carNumber: number };

/** Compares the visible entries before and after an update (see the module comment). */
export function diffVisibleRows(
  before: readonly EntryWithCarNumber[],
  after: readonly EntryWithCarNumber[],
): TowerRowDiff {
  const slotBeforeByCarNumber = new Map<number, number>();
  before.forEach((entry, index) => {
    slotBeforeByCarNumber.set(entry.carNumber, index + 1);
  });
  const carNumbersAfter = new Set(after.map((entry) => entry.carNumber));

  const staying: StayingRow[] = [];
  const entering: number[] = [];
  after.forEach((entry, index) => {
    const slotAfter = index + 1;
    const slotBefore = slotBeforeByCarNumber.get(entry.carNumber);
    if (slotBefore === undefined) {
      entering.push(entry.carNumber);
      return;
    }
    staying.push({
      carNumber: entry.carNumber,
      slotBefore,
      slotAfter,
      direction: chooseDirection(slotBefore, slotAfter),
    });
  });

  const leaving = before
    .map((entry) => entry.carNumber)
    .filter((carNumber) => !carNumbersAfter.has(carNumber));

  const leaderBefore = before[0]?.carNumber;
  const leaderAfter = after[0]?.carNumber;
  const hasNewLeader = leaderAfter !== undefined && leaderAfter !== leaderBefore;

  return {
    staying,
    entering,
    leaving,
    newLeaderCarNumber: hasNewLeader ? leaderAfter : undefined,
  };
}

/** Up means a smaller slot number (closer to the top of the tower). */
function chooseDirection(slotBefore: number, slotAfter: number): StayingRow['direction'] {
  if (slotAfter < slotBefore) {
    return 'up';
  }
  if (slotAfter > slotBefore) {
    return 'down';
  }
  return 'same';
}
