import type { Instance } from '@bajaovrlay/shared';

/** Which instance of a graphic "Edição rápida" follows, and how many are on program. */
export type InstanceOfGraphicToFollow = {
  /** The instance taken most recently, or undefined when the graphic is not on program. */
  instanceToFollow: Instance | undefined;
  /** More than one means the panel must say which one it follows. */
  numberOfInstancesOnProgram: number;
};

/**
 * Answers whether `instance` was taken later than `otherInstance`, or at the very same
 * moment. Counting "the same moment" as yes is what makes a walk through a slice in
 * order end on the later one in the slice, so the answer never flips between two
 * instances taken together.
 */
export function wasTakenNoEarlierThan(instance: Instance, otherInstance: Instance): boolean {
  return Date.parse(instance.takenAt) >= Date.parse(otherInstance.takenAt);
}

/**
 * Finds the instance "Edição rápida" shows and updates for the chosen graphic: an
 * instance of that graphic on the program output, on whatever layer it is, because a
 * rundown item can put a graphic on any layer. Of several, the one taken most recently
 * is followed: it is the operator's last action. Two taken at the very same moment give
 * the later one in the slice.
 */
export function findInstanceOfGraphicToFollow(
  instances: Instance[],
  graphicId: string,
): InstanceOfGraphicToFollow {
  const instancesOfTheGraphicOnProgram = instances.filter(
    (instance) => instance.graphicId === graphicId && instance.target === 'program',
  );

  let instanceToFollow: Instance | undefined = undefined;
  for (const instance of instancesOfTheGraphicOnProgram) {
    if (instanceToFollow === undefined || wasTakenNoEarlierThan(instance, instanceToFollow)) {
      instanceToFollow = instance;
    }
  }

  return {
    instanceToFollow,
    numberOfInstancesOnProgram: instancesOfTheGraphicOnProgram.length,
  };
}
