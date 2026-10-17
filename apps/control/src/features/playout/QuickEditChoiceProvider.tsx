import type { Instance } from '@bajaovrlay/shared';
import { createContext, type ReactNode, useContext, useRef, useState } from 'react';

import type { LostQuickEditTarget, QuickEditTarget } from './quickEditMode';

/**
 * What "Edição rápida" was told to work on. It is about the page (what the panel shows),
 * not about the show, so it is the page's own state and never the server's.
 */
export type QuickEditChoice = {
  /** The graphic of a new entry; undefined until chosen, which means the first listed. */
  graphicIdChosen: string | undefined;
  /** The layer of a new entry; undefined until chosen, which means the graphic's default. */
  layerIdChosen: string | undefined;
  /** The instance loaded by a "Camadas" row's "Editar", or null for a new entry. */
  target: QuickEditTarget | null;
  /**
   * Counts the presses that must start a fresh form ("Editar", a graphic chosen). The
   * panel draws the form with it in its React key; letting go of an instance does not
   * change it, which is how the form keeps its values then.
   */
  formLoadNumber: number;
};

/** The choice and the ways to change it. */
export type QuickEditChoiceOnPage = QuickEditChoice & {
  /** A row's "Editar" or "Editar prévia": load that instance into a fresh form. */
  editInstanceInQuickEdit: (instance: Instance) => void;
  /** The graphic dropdown: a new entry of that graphic, on its default layer, fresh form. */
  chooseGraphicForNewEntry: (graphicId: string) => void;
  /**
   * The layer dropdown of a new entry. It also lets go of an instance that is gone, and
   * so of the line about it: the operator has moved on to another layer.
   */
  chooseLayerForNewEntry: (layerId: string) => void;
  /** "Nova entrada": let go of the instance and keep the form as it is. */
  stopEditingTheInstance: () => void;
  /**
   * The panel saw its instance gone: write down what became of it, once, so the line
   * keeps those words. Only for the target with that id; a newer target is left alone.
   */
  writeDownTheLossOfTheTarget: (instanceId: string, lostTarget: LostQuickEditTarget) => void;
  /** "Colocar no ar" or "Prévia" from a new entry: let go of an instance that is gone, and its line. */
  forgetTheLostTarget: () => void;
  /**
   * What the panel works on at this very moment, for a command to note as it is sent.
   * Read at the call, not from the last draw, so a change made in the same press counts.
   */
  readChoiceAsSentNow: () => QuickEditChoiceAsSent;
  /**
   * After the panel's own accepted command made a new instance (its "Colocar no ar", or
   * the "Prévia" of a loaded preview): edit that one, keeping the form on screen, but only
   * if the panel still works on what it worked on when the command was sent. Answers
   * whether it did, so the caller refills the form only then.
   */
  editInstanceMadeByThePanel: (instance: Instance, choiceAsSent: QuickEditChoiceAsSent) => boolean;
};

/**
 * What a command of the panel notes when it is sent: the form it came from, the instance
 * loaded then (null for a new entry) and the new-entry layer chosen then. If any of the
 * three differs when the reply comes, the operator has moved on (another "Editar", a
 * graphic or layer chosen, "Nova entrada") and the reply must not move the panel.
 */
export type QuickEditChoiceAsSent = {
  formLoadNumber: number;
  targetInstanceId: string | null;
  layerIdChosen: string | undefined;
};

const QuickEditChoiceContext = createContext<QuickEditChoiceOnPage | null>(null);

/** Builds what the panel remembers about an instance it is told to edit. */
function buildTargetOfInstance(instance: Instance): QuickEditTarget {
  return {
    instanceId: instance.id,
    graphicId: instance.graphicId,
    layerId: instance.layerId,
    output: instance.target,
  };
}

/**
 * Holds what "Edição rápida" works on, for the whole page. The panel is drawn in the
 * centre column, but the "Editar" buttons that load an instance into it are on the
 * "Camadas" rows of the right column, so the choice cannot live in either alone. main.tsx
 * wraps the page in it once; tests do it through controlPageOnFakeServer.testSupport.tsx.
 * Deliberate: nothing else on the page writes it, so a take from the rundown or a
 * shortcut button never changes what the panel edits.
 */
export function QuickEditChoiceProvider(props: { children: ReactNode }) {
  const choiceAtPageLoad: QuickEditChoice = {
    graphicIdChosen: undefined,
    layerIdChosen: undefined,
    target: null,
    formLoadNumber: 0,
  };
  const [quickEditChoice, setQuickEditChoiceOnScreen] = useState<QuickEditChoice>(choiceAtPageLoad);
  // The newest choice, also before React draws it, so a command's reply can compare
  // against what the operator did a moment ago (editInstanceMadeByThePanel). Every change
  // goes through setQuickEditChoice below, which keeps the two the same.
  const newestChoice = useRef<QuickEditChoice>(choiceAtPageLoad);

  /** Works out the next choice from the newest one, and shows it. */
  function setQuickEditChoice(buildNextChoice: (choiceBefore: QuickEditChoice) => QuickEditChoice) {
    const choiceBefore = newestChoice.current;
    const nextChoice = buildNextChoice(choiceBefore);
    if (nextChoice === choiceBefore) {
      return;
    }
    newestChoice.current = nextChoice;
    setQuickEditChoiceOnScreen(nextChoice);
  }

  function readChoiceAsSentNow(): QuickEditChoiceAsSent {
    const choiceNow = newestChoice.current;
    return {
      formLoadNumber: choiceNow.formLoadNumber,
      targetInstanceId: choiceNow.target?.instanceId ?? null,
      layerIdChosen: choiceNow.layerIdChosen,
    };
  }

  // Compare-and-set: the reply moves the panel only if nothing changed since the send.
  function editInstanceMadeByThePanel(
    instance: Instance,
    choiceAsSent: QuickEditChoiceAsSent,
  ): boolean {
    const choiceAsItIsNow = readChoiceAsSentNow();
    const isStillWhatTheCommandWasSentFrom =
      choiceAsItIsNow.formLoadNumber === choiceAsSent.formLoadNumber &&
      choiceAsItIsNow.targetInstanceId === choiceAsSent.targetInstanceId &&
      choiceAsItIsNow.layerIdChosen === choiceAsSent.layerIdChosen;
    if (!isStillWhatTheCommandWasSentFrom) {
      return false;
    }
    setQuickEditChoice((choiceBefore) => ({
      ...choiceBefore,
      layerIdChosen: instance.layerId,
      target: buildTargetOfInstance(instance),
    }));
    return true;
  }

  const quickEditChoiceOnPage: QuickEditChoiceOnPage = {
    ...quickEditChoice,
    editInstanceInQuickEdit: (instance) =>
      setQuickEditChoice((choiceBefore) => ({
        graphicIdChosen: instance.graphicId,
        layerIdChosen: instance.layerId,
        target: buildTargetOfInstance(instance),
        formLoadNumber: choiceBefore.formLoadNumber + 1,
      })),
    chooseGraphicForNewEntry: (graphicId) =>
      setQuickEditChoice((choiceBefore) => ({
        graphicIdChosen: graphicId,
        layerIdChosen: undefined,
        target: null,
        formLoadNumber: choiceBefore.formLoadNumber + 1,
      })),
    // The dropdown is drawn for a new entry only, so the target here is null or gone.
    chooseLayerForNewEntry: (layerId) =>
      setQuickEditChoice((choiceBefore) => ({
        ...choiceBefore,
        layerIdChosen: layerId,
        target: null,
      })),
    stopEditingTheInstance: () =>
      setQuickEditChoice((choiceBefore) => ({ ...choiceBefore, target: null })),
    writeDownTheLossOfTheTarget: (instanceId, lostTarget) =>
      setQuickEditChoice((choiceBefore) => {
        const targetBefore = choiceBefore.target;
        const isTheTargetSeenGone = targetBefore?.instanceId === instanceId;
        if (targetBefore === null || !isTheTargetSeenGone) {
          return choiceBefore;
        }
        if (targetBefore.lossAsFirstSeen !== undefined) {
          // Already written down. The same object is handed back, so React draws nothing.
          return choiceBefore;
        }
        return { ...choiceBefore, target: { ...targetBefore, lossAsFirstSeen: lostTarget } };
      }),
    forgetTheLostTarget: () =>
      setQuickEditChoice((choiceBefore) => ({ ...choiceBefore, target: null })),
    readChoiceAsSentNow,
    editInstanceMadeByThePanel,
  };
  return (
    <QuickEditChoiceContext.Provider value={quickEditChoiceOnPage}>
      {props.children}
    </QuickEditChoiceContext.Provider>
  );
}

/** What "Edição rápida" works on, and the functions that change it. */
export function useQuickEditChoice(): QuickEditChoiceOnPage {
  const quickEditChoiceOnPage = useContext(QuickEditChoiceContext);
  if (quickEditChoiceOnPage === null) {
    throw new Error('This component must be drawn inside <QuickEditChoiceProvider>.');
  }
  return quickEditChoiceOnPage;
}
