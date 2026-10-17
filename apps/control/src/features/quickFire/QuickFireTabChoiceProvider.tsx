import { createContext, type ReactNode, useContext, useState } from 'react';

import type { QuickFireTab } from './quickFireTabs';

/** The tab the operator chose in the quick-fire strip, and the way to choose another. */
export type QuickFireTabChoiceOnPage = {
  /** The tab chosen last, or null while nothing was chosen (the strip shows its first tab). */
  chosenTab: QuickFireTab | null;
  chooseTab: (tab: QuickFireTab) => void;
};

const QuickFireTabChoiceContext = createContext<QuickFireTabChoiceOnPage | null>(null);

/**
 * Holds which tab of the quick-fire strip the operator chose, for the whole page. The
 * strip is drawn in the right column, but "Novo gráfico…" of "Edição rápida" in the centre
 * opens the item editor on the panel the strip shows (BAJAOVRLAY-37), so the choice cannot
 * live in the strip alone. It is about the page (which tab is open), not the show, so it
 * is the page's own state and never the server's: two operators may look at different
 * tabs. main.tsx wraps the page in it once; tests do it through
 * controlPageOnFakeServer.testSupport.tsx.
 */
export function QuickFireTabChoiceProvider(props: { children: ReactNode }) {
  const [chosenTab, setChosenTab] = useState<QuickFireTab | null>(null);
  const quickFireTabChoiceOnPage: QuickFireTabChoiceOnPage = { chosenTab, chooseTab: setChosenTab };
  return (
    <QuickFireTabChoiceContext.Provider value={quickFireTabChoiceOnPage}>
      {props.children}
    </QuickFireTabChoiceContext.Provider>
  );
}

/** The quick-fire tab the operator chose, and the function that chooses another. */
export function useQuickFireTabChoice(): QuickFireTabChoiceOnPage {
  const quickFireTabChoiceOnPage = useContext(QuickFireTabChoiceContext);
  if (quickFireTabChoiceOnPage === null) {
    throw new Error('This component must be drawn inside <QuickFireTabChoiceProvider>.');
  }
  return quickFireTabChoiceOnPage;
}
