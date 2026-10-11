import type { Graphic, Instance } from '@bajaovrlay/shared';

import { wasTakenNoEarlierThan } from './instanceOfGraphicToFollow';

/** What the choice is made from: two slices and what the operator did so far. */
export type GraphicForQuickEditOptions = {
  /** The graphics slice, in the server's order. */
  graphics: Graphic[];
  /** The instances slice: everything on the program and preview outputs. */
  instances: Instance[];
  /**
   * The graphic the operator chose in the dropdown or started editing, or undefined
   * while the operator has done neither.
   */
  graphicIdThePanelStaysOn: string | undefined;
};

/**
 * Chooses the graphic whose form "Edição rápida" shows, in this order:
 * 1. the graphic the panel stays on, while the server still lists it;
 * 2. the graphic taken most recently on the program output (the later one in the
 *    instances slice when two were taken at the same moment), counting only graphics the
 *    server lists, because a form needs the graphic's manifest;
 * 3. the first graphic the server lists.
 * Answers undefined when the server lists no graphic at all.
 * What could go wrong: until the operator chooses or types, a take from the rundown
 * moves the panel to the graphic just taken. That is the point of rule 2, and rule 1 is
 * what protects an operator who is in the middle of something.
 */
export function chooseGraphicForQuickEdit(
  options: GraphicForQuickEditOptions,
): Graphic | undefined {
  const { graphics, instances, graphicIdThePanelStaysOn } = options;

  const graphicThePanelStaysOn = graphics.find(
    (graphic) => graphic.id === graphicIdThePanelStaysOn,
  );
  if (graphicThePanelStaysOn !== undefined) {
    return graphicThePanelStaysOn;
  }

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
  const graphicTakenMostRecently = graphics.find(
    (graphic) => graphic.id === instanceTakenMostRecently?.graphicId,
  );

  return graphicTakenMostRecently ?? graphics[0];
}
