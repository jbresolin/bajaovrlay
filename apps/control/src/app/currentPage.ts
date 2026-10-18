import { useEffect, useState } from 'react';

/**
 * The two pages of the control page. Which one is shown lives in the address after "#"
 * (decision D15 of BAJAOVRLAY-17): no router library, and nothing to add on the server,
 * which serves the built page as plain files and would answer 404 to a path like
 * "/fontes". The header's links, the browser's back button and a reload all just work.
 */
export type ControlPageName = 'console' | 'dataSources';

/** What the header's links write after "#" for each page. */
export const hashOfEachPage = {
  console: '#/',
  dataSources: '#/fontes',
} as const satisfies Record<ControlPageName, string>;

/**
 * Reads the page from the address's hash. Anything but "#/fontes" is the console, so an
 * old or mistyped bookmark shows the console instead of an empty page.
 */
export function readPageFromHash(hash: string): ControlPageName {
  if (hash === hashOfEachPage.dataSources) {
    return 'dataSources';
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
