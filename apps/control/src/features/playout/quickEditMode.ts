/**
 * What "Edição rápida" is doing right now: editing ONE instance, or nothing (since
 * BAJAOVRLAY-37 it makes no new entry). A pure function of what the panel remembers and
 * the server's instances slice.
 */
import type { Instance } from '@bajaovrlay/shared';

/**
 * The instance a "Camadas" row's "Editar" (or "Editar prévia") loaded into the panel, as
 * it was at that press. The id is what counts; the rest says what to name in the line
 * shown once the instance is gone.
 */
export type QuickEditTarget = {
  instanceId: string;
  graphicId: string;
  layerId: string;
  output: Instance['target'];
  /**
   * What became of the instance, written down the first time the panel saw it gone
   * (QuickEditPanel.tsx). Kept, so the line never changes its words afterwards.
   */
  lossAsFirstSeen?: LostQuickEditTarget;
};

/** Why the panel let go of its instance: where the instance was, and what became of it. */
export type LostQuickEditTarget = {
  layerId: string;
  output: Instance['target'];
  /**
   * 'left': gone, and nothing on that layer and output now; 'replaced': gone, and another
   * instance sits there; 'graphicNoLongerListed': still there, but the server no longer
   * lists its graphic, whose manifest the form is made from.
   */
  whatHappened: 'left' | 'replaced' | 'graphicNoLongerListed';
};

/** The two things the panel can be doing. */
export type QuickEditMode =
  | { kind: 'editingInstance'; instanceBeingEdited: Instance }
  | { kind: 'nothingLoaded'; lostTarget: LostQuickEditTarget | undefined };

/**
 * Says what the panel is doing. With a target whose id is still in the slice and whose
 * graphic is still listed, it edits the newest copy the server sent of that instance.
 * Otherwise it has nothing loaded and, when it had a target, says why: the graphic is no
 * longer listed, or the instance is gone and its place is empty or taken by another
 * instance, as it was when the panel first saw it (`lossAsFirstSeen`).
 *
 * Deliberate: only the id is looked up. A take or a preview always makes a new instance
 * with a new id, so an instance that replaced the target is never mistaken for it, and
 * the panel never moves to another instance by itself (the brief's "never silently
 * retargets"). Only a Camadas row's "Editar" or "Editar prévia" loads one.
 */
export function findQuickEditMode(
  target: QuickEditTarget | null,
  instances: Instance[],
  listedGraphicIds: string[],
): QuickEditMode {
  if (target === null) {
    return { kind: 'nothingLoaded', lostTarget: undefined };
  }
  // Already seen gone: say what was seen then. Worked out again from the slice, a take
  // made later on that layer would turn "left" into "replaced", which never happened to
  // the instance that was being edited.
  if (target.lossAsFirstSeen !== undefined) {
    return { kind: 'nothingLoaded', lostTarget: target.lossAsFirstSeen };
  }

  const instanceBeingEdited = instances.find((instance) => instance.id === target.instanceId);
  if (instanceBeingEdited !== undefined) {
    const isItsGraphicListed = listedGraphicIds.includes(instanceBeingEdited.graphicId);
    if (isItsGraphicListed) {
      return { kind: 'editingInstance', instanceBeingEdited };
    }
    // Written down like any loss, so the panel does not go back to the instance by
    // itself if the graphic is listed again.
    return {
      kind: 'nothingLoaded',
      lostTarget: {
        layerId: target.layerId,
        output: target.output,
        whatHappened: 'graphicNoLongerListed',
      },
    };
  }

  const isAnotherInstanceInItsPlace = instances.some(
    (instance) => instance.layerId === target.layerId && instance.target === target.output,
  );
  return {
    kind: 'nothingLoaded',
    lostTarget: {
      layerId: target.layerId,
      output: target.output,
      whatHappened: isAnotherInstanceInItsPlace ? 'replaced' : 'left',
    },
  };
}
