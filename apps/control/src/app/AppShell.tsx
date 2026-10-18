import { cn } from 'cn';

import { buttonVariants } from '@/components/ui/button';
import { ConnectionBadge } from '@/features/connection/ConnectionBadge';
import { DataSourcesHealthChip } from '@/features/dataSources/DataSourcesHealthChip';
import { DataSourcesPage } from '@/features/dataSources/DataSourcesPage';
import { KeyboardMapDialog } from '@/features/keyboardHelp/KeyboardMapDialog';
import { ServerHealthCheck } from '@/features/serverHealth/ServerHealthCheck';
import { ptBR } from '@/i18n/ptBR';

import { ConsoleView } from './ConsoleView';
import { type ControlPageName, hashOfEachPage, useCurrentPage } from './currentPage';

const pageLinkTexts = ptBR.app.pageLinks;

/**
 * The frame of the control page: a header that is always there, and below it the page
 * the address names (currentPage.ts) — the console (ConsoleView.tsx) or "Fontes de
 * dados" (features/dataSources). The header holds the product name, the links to the two
 * pages, the data sources chip ("Fontes: 2 ok · 1 atrasada"), the server check, the
 * connection badge and the "?" button, which lists every keyboard shortcut
 * (src/keyboard/keyboardMap.ts).
 */
export function AppShell() {
  const currentPage = useCurrentPage();

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{ptBR.app.title}</h1>
          <nav aria-label={pageLinkTexts.navigationLabel} className="flex items-center gap-1">
            <PageLink page="console" currentPage={currentPage} text={pageLinkTexts.console} />
            <PageLink
              page="dataSources"
              currentPage={currentPage}
              text={pageLinkTexts.dataSources}
            />
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <DataSourcesHealthChip />
          <ServerHealthCheck />
          <ConnectionBadge />
          <KeyboardMapDialog />
        </div>
      </header>

      {currentPage === 'console' ? <ConsoleView /> : <DataSourcesPage />}
    </div>
  );
}

/** One header link to a page, drawn as a small button and marked when it is the current page. */
function PageLink(props: { page: ControlPageName; currentPage: ControlPageName; text: string }) {
  const isCurrentPage = props.page === props.currentPage;
  return (
    <a
      href={hashOfEachPage[props.page]}
      aria-current={isCurrentPage ? 'page' : undefined}
      className={cn(buttonVariants({ variant: isCurrentPage ? 'secondary' : 'ghost', size: 'sm' }))}
    >
      {props.text}
    </a>
  );
}
