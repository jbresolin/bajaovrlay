import { useEffect, useState } from 'react';

/**
 * The six pages of the control page. Which one is shown lives in the address after "#"
 * (decision D15 of BAJAOVRLAY-17): no router library, and nothing to add on the server,
 * which serves the built page as plain files and would answer 404 to a path like
 * "/fontes". The header's links, the browser's back button and a reload all just work.
 * "Cadastros" (the entity library) joined with BAJAOVRLAY-19, "Eventos" (the review of the
 * event inbox) at gate 2 of PR #22, "Saídas e camadas" (outputs and layers) with
 * BAJAOVRLAY-49, "Histórico" (every change of the show read back) with BAJAOVRLAY-30, and
 * "Entrar" (the login, the only page without a session while the PINs are set) with
 * BAJAOVRLAY-29; main.tsx draws the login page itself, before any connection is opened.
 */
export type ControlPageName =
  | 'console'
  | 'dataSources'
  | 'entityLibrary'
  | 'eventReview'
  | 'outputsAndLayers'
  | 'history'
  | 'login';

/** What the header's links write after "#" for each page. */
export const hashOfEachPage = {
  console: '#/',
  dataSources: '#/fontes',
  entityLibrary: '#/cadastros',
  eventReview: '#/eventos',
  outputsAndLayers: '#/saidas',
  history: '#/historico',
  login: '#/entrar',
} as const satisfies Record<ControlPageName, string>;

/**
 * Reads the page from the address's hash. Anything but "#/fontes", "#/cadastros",
 * "#/eventos", "#/saidas", "#/historico" and "#/entrar" is the console, so an old or mistyped bookmark shows the console instead of an empty page.
 * "#/cadastros/<kind>/<key>" is Cadastros opened on one record (recordToOpen.ts).
 */
export function readPageFromHash(hash: string): ControlPageName {
  if (hash === hashOfEachPage.dataSources) {
    return 'dataSources';
  }
  if (hash === hashOfEachPage.eventReview) {
    return 'eventReview';
  }
  if (hash === hashOfEachPage.outputsAndLayers) {
    return 'outputsAndLayers';
  }
  if (hash === hashOfEachPage.history) {
    return 'history';
  }
  if (hash === hashOfEachPage.login) {
    return 'login';
  }
  const isOneRecordOfTheLibrary = hash.startsWith(`${hashOfEachPage.entityLibrary}/`);
  if (hash === hashOfEachPage.entityLibrary || isOneRecordOfTheLibrary) {
    return 'entityLibrary';
  }
  return 'console';
}

/** Returns the page the address names now, and draws again whenever the hash changes. */
export function useCurrentPage(): ControlPageName {
  const [currentPage, setCurrentPage] = useState(() => readPageFromHash(window.location.hash));

  useEffect(() => {
    function followTheHash(): void {
      setCurrentPage(readPageFromHash(window.location.hash));
    }
    window.addEventListener('hashchange', followTheHash);
    return () => {
      window.removeEventListener('hashchange', followTheHash);
    };
  }, []);

  return currentPage;
}
