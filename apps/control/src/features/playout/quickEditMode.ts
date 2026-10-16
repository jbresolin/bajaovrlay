/**
 * What "Edição rápida" is doing right now: editing ONE instance, or making a new entry.
 * A pure function of what the panel remembers and the server's instances slice.
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
};

/** Why the panel went back to a new entry: where its instance was, and what became of it. */
export type LostQuickEditTarget = {
  layerId: string;
  output: Instance['target'];
  /** true when another instance now sits on that layer and output; false when it is empty. */
  wasReplaced: boolean;
};

/** The two things the panel can be doing. */
export type QuickEditMode =
  | { kind: 'editingInstance'; instanceBeingEdited: Instance }
  | { kind: 'newTake'; lostTarget: LostQuickEditTarget | undefined };

/**
 * Says what the panel is doing. With a target whose id is still in the slice, it edits
 * the newest copy the server sent of that instance. Otherwise it makes a new entry, and
 * for a target that is gone it says whether its place is empty or taken by another
 * instance.
 *
 * Deliberate: only the id is looked up. A take or a preview always makes a new instance
 * with a new id, so an instance that replaced the target is never mistaken for it, and
 * the panel never moves to another instance by itself (the brief's "never silently
 * retargets"). Only the panel's own accepted commands move it (QuickEditForm.tsx).
 */
export function findQuickEditMode(
  target: QuickEditTarget | null,
  instances: Instance[],
): QuickEditMode {
  if (target === null) {
    return { kind: 'newTake', lostTarget: undefined };
  }

  const instanceBeingEdited = instances.find((instance) => instance.id === target.instanceId);
  if (instanceBeingEdited !== undefined) {
    return { kind: 'editingInstance', instanceBeingEdited };
  }

  const isAnotherInstanceInItsPlace = instances.some(
    (instance) => instance.layerId === target.layerId && instance.target === target.output,
  );
  return {
    kind: 'newTake',
    lostTarget: {
      layerId: target.layerId,
      output: target.output,
      wasReplaced: isAnotherInstanceInItsPlace,
    },
  };
}
