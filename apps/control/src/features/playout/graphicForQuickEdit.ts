import type { Graphic, Instance } from '@bajaovrlay/shared';

import { wasTakenNoEarlierThan } from './instanceOfGraphicToFollow';

/**
 * The take "Edição rápida" went to by itself: which graphic, and the moment the server
 * put it on air. The panel remembers it so that the graphic leaving the air is not
 * mistaken for news.
 */
export type TakeFollowedByQuickEdit = {
  graphicId: string;
  /** The instance's `takenAt`, as the server wrote it. */
  takenAt: string;
};

/** What the take to follow is found from: two slices and what the panel remembers. */
export type TakeForQuickEditToFollowOptions = {
  /** The graphics slice, in the server's order. */
  graphics: Graphic[];
  /** The instances slice: everything on the program and preview outputs. */
  instances: Instance[];
  /** The take the panel followed until now, or undefined when it has followed none. */
  takeThePanelLastFollowed: TakeFollowedByQuickEdit | undefined;
};

/** What the choice is made from: the same, and what the operator did so far. */
export type GraphicForQuickEditOptions = TakeForQuickEditToFollowOptions & {
  /**
   * The graphic the operator chose in the dropdown or started editing, or undefined
   * while the operator has done neither.
   */
  graphicIdThePanelStaysOn: string | undefined;
};

/**
 * Finds the take "Edição rápida" follows from now on: the one taken most recently on
 * the program output (the later one in the instances slice when two were taken at the
 * same moment), counting only graphics the server lists, because a form needs the
 * graphic's manifest. While nothing on air is as recent as the take the panel already
 * followed, that take is kept: its graphic left the air, and whatever is still on air
 * was taken before it.
 * What could go wrong: a graphic taken at the very same moment as the one the panel
 * followed counts as news once the followed one leaves the air.
 */
export function findTakeForQuickEditToFollow(
  options: TakeForQuickEditToFollowOptions,
): TakeFollowedByQuickEdit | undefined {
  const { graphics, instances, takeThePanelLastFollowed } = options;

  let instanceTakenMostRecently: Instance | undefined = undefined;
  for (const instance of instances) {
    const isOnProgram = instance.target === 'program';
    const isOfAListedGraphic = graphics.some((graphic) => graphic.id === instance.graphicId);
    if (!isOnProgram || !isOfAListedGraphic) {
      continue;
    }
    if (
      instanceTakenMostRecently === undefined ||
      wasTakenNoEarlierThan(instance, instanceTakenMostRecently)
    ) {
      instanceTakenMostRecently = instance;
    }
  }

  if (instanceTakenMostRecently === undefined) {
    return takeThePanelLastFollowed;
  }
  const isEarlierThanTheTakeFollowed =
    takeThePanelLastFollowed !== undefined &&
    Date.parse(instanceTakenMostRecently.takenAt) < Date.parse(takeThePanelLastFollowed.takenAt);
  if (isEarlierThanTheTakeFollowed) {
    return takeThePanelLastFollowed;
  }
  return {
    graphicId: instanceTakenMostRecently.graphicId,
    takenAt: instanceTakenMostRecently.takenAt,
  };
}

/**
 * Chooses the graphic whose form "Edição rápida" shows, in this order:
 * 1. the graphic the panel stays on, while the server still lists it;
 * 2. the graphic of the take the panel follows (findTakeForQuickEditToFollow), while the
 *    server still lists it. That graphic may have left the air since: the panel keeps
 *    its form, so the operator can put the same thing back with "Colocar no ar";
 * 3. the graphic taken most recently on the program output, when the followed take's
 *    graphic is no longer listed;
 * 4. the first graphic the server lists.
 * Answers undefined when the server lists no graphic at all.
 * What could go wrong: until the operator chooses or types, a take from the rundown
 * moves the panel to the graphic just taken. That is the point of rule 2, and rule 1 is
 * what protects an operator who is in the middle of something.
 */
export function chooseGraphicForQuickEdit(
  options: GraphicForQuickEditOptions,
): Graphic | undefined {
  const { graphics, instances, graphicIdThePanelStaysOn, takeThePanelLastFollowed } = options;

  const graphicThePanelStaysOn = graphics.find(
    (graphic) => graphic.id === graphicIdThePanelStaysOn,
  );
  if (graphicThePanelStaysOn !== undefined) {
    return graphicThePanelStaysOn;
  }

  const takeToFollow = findTakeForQuickEditToFollow({
    graphics,
    instances,
    takeThePanelLastFollowed,
  });
  const graphicOfTheTakeToFollow = graphics.find(
    (graphic) => graphic.id === takeToFollow?.graphicId,
  );
  if (graphicOfTheTakeToFollow !== undefined) {
    return graphicOfTheTakeToFollow;
  }

  // The followed take's graphic is no longer listed, so it is left out and what is on
  // air now decides.
  const latestTakeOnAirNow = findTakeForQuickEditToFollow({
    graphics,
    instances,
    takeThePanelLastFollowed: undefined,
  });
  const graphicTakenMostRecently = graphics.find(
    (graphic) => graphic.id === latestTakeOnAirNow?.graphicId,
  );

  return graphicTakenMostRecently ?? graphics[0];
}
