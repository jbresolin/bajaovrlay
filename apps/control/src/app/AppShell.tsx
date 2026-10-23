import { cn } from 'cn';

import { buttonVariants } from '@/components/ui/button';
import { ConnectionBadge } from '@/features/connection/ConnectionBadge';
import { DataSourcesHealthChip } from '@/features/dataSources/DataSourcesHealthChip';
import { DataSourcesPage } from '@/features/dataSources/DataSourcesPage';
import { EntityLibraryPage } from '@/features/entityLibrary/EntityLibraryPage';
import { EventReviewPage } from '@/features/events/EventReviewPage';
import { KeyboardMapDialog } from '@/features/keyboardHelp/KeyboardMapDialog';
import { ServerHealthCheck } from '@/features/serverHealth/ServerHealthCheck';
import { ptBR } from '@/i18n/ptBR';

import { ConsoleView } from './ConsoleView';
import { type ControlPageName, hashOfEachPage, useCurrentPage } from './currentPage';
import { PageErrorBoundary } from './PageErrorBoundary';

const pageLinkTexts = ptBR.app.pageLinks;

/**
 * The frame of the control page: a header that is always there, and below it the page
 * the address names (currentPage.ts) — the console (ConsoleView.tsx), "Fontes de dados"
 * (features/dataSources), which the header's "Fontes" and chip open in a new tab,
 * "Cadastros" (features/entityLibrary), which "Cadastros" opens in a new tab too, or the
 * review of the event inbox (features/events), which "Eventos" opens in a new tab; each of
 * those three in a PageErrorBoundary, so a bug shows a pt-BR message, not a blank tab. The
 * header holds the product name, the links to the four pages, the data sources
 * chip ("Fontes: 2 ok · 1 atrasada"), the server check, the connection badge and the
 * "?" button, which lists every keyboard shortcut (src/keyboard/keyboardMap.ts).
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
            <PageLink
              page="entityLibrary"
              currentPage={currentPage}
              text={pageLinkTexts.entityLibrary}
            />
            <PageLink
              page="eventReview"
              currentPage={currentPage}
              text={pageLinkTexts.eventReview}
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

      {currentPage === 'console' && <ConsoleView />}
      {currentPage === 'dataSources' && (
        <PageErrorBoundary>
          <DataSourcesPage />
        </PageErrorBoundary>
      )}
      {currentPage === 'entityLibrary' && (
        <PageErrorBoundary>
          <EntityLibraryPage />
        </PageErrorBoundary>
      )}
      {currentPage === 'eventReview' && (
        <PageErrorBoundary>
          <EventReviewPage />
        </PageErrorBoundary>
      )}
    </div>
  );
}

/**
 * One header link to a page, drawn as a small button and marked when it is the current
 * page. "Fontes" always opens in a new tab (João's ruling 2 at gate 2 of PR #16): the
 * console must never unmount under the producer, since its keys (Esc, "Limpar tudo"), an
 * unsaved item draft and the monitors live in it; "Cadastros" and "Eventos" do the same,
 * for the same reason. "Console" stays a plain link in the same tab: from another page's tab it turns
 * that tab into a console, and nothing is lost.
 */
function PageLink(props: { page: ControlPageName; currentPage: ControlPageName; text: string }) {
  const isCurrentPage = props.page === props.currentPage;
  const isOpenedInANewTab = props.page !== 'console';
  return (
    <a
      href={hashOfEachPage[props.page]}
      target={isOpenedInANewTab ? '_blank' : undefined}
      rel={isOpenedInANewTab ? 'noopener' : undefined}
      aria-current={isCurrentPage ? 'page' : undefined}
      className={cn(buttonVariants({ variant: isCurrentPage ? 'secondary' : 'ghost', size: 'sm' }))}
    >
      {props.text}
    </a>
  );
}
