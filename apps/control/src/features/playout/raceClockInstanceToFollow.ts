import type { Instance } from '@bajaovrlay/shared';

import { raceClockGraphicId } from './raceClockTakeForm';

/** Which race clock the take panel follows, and how many are on the program output. */
export type RaceClockInstanceToFollow = {
  /** The race clock taken most recently, or undefined when none is on program. */
  instanceToFollow: Instance | undefined;
  /** More than one means the panel must say which one it follows. */
  numberOfRaceClocksOnProgram: number;
};

/**
 * Finds the race clock the take panel shows and updates: an instance of the race clock
 * graphic on the program output, on whatever layer it is, because a rundown item can put
 * the clock on any layer. Of several, the one taken most recently is followed: it is the
 * operator's last action. Two taken at the very same moment give the later one in the
 * slice, so the answer never flips between them.
 */
export function findRaceClockInstanceToFollow(instances: Instance[]): RaceClockInstanceToFollow {
  const raceClocksOnProgram = instances.filter(
    (instance) => instance.graphicId === raceClockGraphicId && instance.target === 'program',
  );

  let instanceToFollow: Instance | undefined = undefined;
  for (const raceClock of raceClocksOnProgram) {
    const wasTakenNoEarlierThanTheOneFollowed =
      instanceToFollow === undefined ||
      Date.parse(raceClock.takenAt) >= Date.parse(instanceToFollow.takenAt);
    if (wasTakenNoEarlierThanTheOneFollowed) {
      instanceToFollow = raceClock;
    }
  }

  return { instanceToFollow, numberOfRaceClocksOnProgram: raceClocksOnProgram.length };
}
