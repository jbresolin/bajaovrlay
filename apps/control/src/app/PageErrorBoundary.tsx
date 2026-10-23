import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';
import { logControlEvent } from '@/logging/controlLog';

/** What the boundary keeps: whether the page under it threw. */
type PageErrorBoundaryState = { hasThePageThrown: boolean };

/**
 * Catches an error thrown while drawing the page under it ("Cadastros", "Fontes") and
 * shows a pt-BR message with "Recarregar a página" instead of a blank tab, logging the
 * error. The header above it stays. A class component because React offers catching a
 * drawing error to classes only. What is on air is untouched: the server owns it.
 */
export class PageErrorBoundary extends Component<{ children: ReactNode }, PageErrorBoundaryState> {
  override state: PageErrorBoundaryState = { hasThePageThrown: false };

  /** Marks the page as thrown, so the next draw shows the message. */
  static getDerivedStateFromError(): PageErrorBoundaryState {
    return { hasThePageThrown: true };
  }

  /** Logs what was thrown and where, for whoever reads the console. */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logControlEvent('error', 'a page threw while drawing', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  override render(): ReactNode {
    if (!this.state.hasThePageThrown) {
      return this.props.children;
    }
    const texts = ptBR.app.pageError;
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-destructive">
          {texts.message}
        </p>
        <Button size="sm" onClick={() => window.location.reload()}>
          {texts.reloadButton}
        </Button>
      </div>
    );
  }
}
