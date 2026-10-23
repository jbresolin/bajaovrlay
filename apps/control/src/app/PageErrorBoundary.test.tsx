/**
 * A page's error boundary (apps/control)
 *
 * What this module is for:
 *   "Cadastros" and "Fontes" each open in a tab of their own. A bug in either used to
 *   blank the whole tab (gate 2 of PR #23); the boundary around each route shows a pt-BR
 *   message and a "Recarregar a página" button instead, and logs the error, so the
 *   operator knows what happened and the header stays.
 *
 * What these tests prove:
 *   - A page that throws while drawing shows the message and the button, not a blank tab.
 *   - A page that draws shows itself, untouched.
 *
 * What these tests deliberately do not cover:
 *   - The real reload (the browser's location.reload).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PageErrorBoundary } from './PageErrorBoundary';

/** A page that throws while drawing, as the form did over plain http. */
function PageThatThrows(): never {
  throw new TypeError('crypto.randomUUID is not a function');
}

describe('PageErrorBoundary', () => {
  it('shows a pt-BR message and a reload button when the page throws', () => {
    // Arrange: React's own report of the error kept off the test output.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act: draw the throwing page inside the boundary.
    render(
      <PageErrorBoundary>
        <PageThatThrows />
      </PageErrorBoundary>,
    );

    // Assert: the message and the button.
    expect(screen.getByRole('alert'), 'the message').toHaveTextContent(
      'Esta página encontrou um erro e parou. Recarregue para continuar; nada do que está no ar foi afetado.',
    );
    expect(screen.getByRole('button', { name: 'Recarregar a página' }), 'the button').toBeVisible();
    vi.restoreAllMocks();
  });

  it('draws a page that works as it is', () => {
    // Arrange and act: a page that draws.
    render(
      <PageErrorBoundary>
        <p>Equipes cadastradas</p>
      </PageErrorBoundary>,
    );

    // Assert: the page, and no message.
    expect(screen.getByText('Equipes cadastradas'), 'the page').toBeVisible();
    expect(screen.queryByRole('alert'), 'no message').not.toBeInTheDocument();
  });
});
