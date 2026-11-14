import { cn } from 'cn';

import { buttonVariants } from '@/components/ui/button';
import { ConnectionBadge } from '@/features/connection/ConnectionBadge';
import { DataSourcesHealthChip } from '@/features/dataSources/DataSourcesHealthChip';
import { DataSourcesPage } from '@/features/dataSources/DataSourcesPage';
import { EntityLibraryPage } from '@/features/entityLibrary/EntityLibraryPage';
import { EventReviewPage } from '@/features/events/EventReviewPage';
import { HeaderMenu } from '@/features/headerMenu/HeaderMenu';
import { HistoryPage } from '@/features/history/HistoryPage';
import { KeyboardMapDialog } from '@/features/keyboardHelp/KeyboardMapDialog';
import { OperatorBadge } from '@/features/login/OperatorBadge';
import { ObsTally } from '@/features/obs/ObsTally';
import { OutputsAndLayersPage } from '@/features/outputsAndLayers/OutputsAndLayersPage';
import { ServerClockOffWarning } from '@/features/serverClock/ServerClockOffWarning';
import { TriggersPausedChip } from '@/features/triggers/TriggersPausedChip';
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
 * review of the event inbox (features/events), which "Eventos" opens in a new tab, or
 * "Saídas e camadas" (features/outputsAndLayers), which "Saídas" opens in a new tab, or
 * "Histórico" (features/history, BAJAOVRLAY-30), which "Histórico" opens in a new tab; each
 * of those five in a PageErrorBoundary, so a bug shows a pt-BR message, not a blank tab.
 * The header holds the product name, the links to the six pages, the data sources
 * chip ("Fontes: 2 ok · 1 atrasada"), the OBS tally, "Gatilhos e eventos automáticos
 * pausados" while every trigger is paused (BAJAOVRLAY-48), the "Menu" with "Verificar servidor", "Cópia de
 * segurança" and "Pausar gatilhos" (features/headerMenu, BAJAOVRLAY-62), the connection
 * badge, who operates the page ("Produtor · Mesa 1" and "Sair", or "Sem login";
 * BAJAOVRLAY-29) and the "?" button, which lists every keyboard shortcut
 * (src/keyboard/keyboardMap.ts).
 * "#/entrar" is drawn by main.tsx before this shell exists; reached here (a logged-in page
 * whose address was changed by hand) it shows the console.
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
            <PageLink
              page="outputsAndLayers"
              currentPage={currentPage}
              text={pageLinkTexts.outputs}
            />
            <PageLink page="history" currentPage={currentPage} text={pageLinkTexts.history} />
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <DataSourcesHealthChip />
          <ObsTally />
          <TriggersPausedChip />
          <ServerClockOffWarning />
          <HeaderMenu />
          <ConnectionBadge />
          <OperatorBadge />
          <KeyboardMapDialog />
        </div>
      </header>

      {(currentPage === 'console' || currentPage === 'login') && <ConsoleView />}
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
      {currentPage === 'outputsAndLayers' && (
        <PageErrorBoundary>
          <OutputsAndLayersPage />
        </PageErrorBoundary>
      )}
      {currentPage === 'history' && (
        <PageErrorBoundary>
          <HistoryPage />
        </PageErrorBoundary>
      )}
    </div>
  );
}

/**
 * One header link to a page, drawn as a small button and marked when it is the current
 * page. "Fontes" always opens in a new tab (João's ruling 2 at gate 2 of PR #16): the
 * console must never unmount under the producer, since its keys (Esc, "Limpar tudo"), an
 * unsaved item draft and the monitors live in it; "Cadastros", "Eventos", "Saídas" and "Histórico" do the same,
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
