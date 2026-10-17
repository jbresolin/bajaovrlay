import type { Instance } from '@bajaovrlay/shared';
import { createContext, type ReactNode, useContext, useState } from 'react';

import type { LostQuickEditTarget, QuickEditTarget } from './quickEditMode';

/**
 * What "Edição rápida" was told to work on. It is about the page (what the panel shows),
 * not about the show, so it is the page's own state and never the server's.
 */
export type QuickEditChoice = {
  /** The instance loaded by a "Camadas" row's "Editar", or null when nothing is loaded. */
  target: QuickEditTarget | null;
  /**
   * Counts the presses of "Editar" and "Editar prévia". The panel draws the form with it
   * in its React key, so every such press starts a fresh form, even for the instance
   * already loaded.
   */
  formLoadNumber: number;
};

/** The choice and the ways to change it. */
export type QuickEditChoiceOnPage = QuickEditChoice & {
  /** A row's "Editar" or "Editar prévia": load that instance into a fresh form. */
  editInstanceInQuickEdit: (instance: Instance) => void;
  /**
   * "Parar de editar", and "Novo gráfico…": let go of the instance, and of the line about
   * an instance that is gone. The panel then has nothing loaded.
   */
  stopEditingTheInstance: () => void;
  /**
   * The panel saw its instance gone: write down what became of it, once, so the line
   * keeps those words. Only for the target with that id; a newer target is left alone.
   */
  writeDownTheLossOfTheTarget: (instanceId: string, lostTarget: LostQuickEditTarget) => void;
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
 * shortcut button never changes what the panel edits. Since BAJAOVRLAY-37 the panel sends
 * nothing that makes a new instance, so no reply of the server ever moves it either.
 */
export function QuickEditChoiceProvider(props: { children: ReactNode }) {
  const [quickEditChoice, setQuickEditChoice] = useState<QuickEditChoice>({
    target: null,
    formLoadNumber: 0,
  });

  const quickEditChoiceOnPage: QuickEditChoiceOnPage = {
    ...quickEditChoice,
    editInstanceInQuickEdit: (instance) =>
      setQuickEditChoice((choiceBefore) => ({
        target: buildTargetOfInstance(instance),
        formLoadNumber: choiceBefore.formLoadNumber + 1,
      })),
    stopEditingTheInstance: () =>
      setQuickEditChoice((choiceBefore) =>
        choiceBefore.target === null ? choiceBefore : { ...choiceBefore, target: null },
      ),
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
