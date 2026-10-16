/**
 * Which rundown the control page shows (apps/control)
 *
 * What this module is for:
 *   The server seeds one rundown ("Sessão principal") and has no command that makes
 *   another, so the page shows the first rundown the server lists. Two areas need to know
 *   which one that is: the rundown column, and "Tomar" under the "Prévia" monitor (to see
 *   whether its take moved that rundown's cursor on). Both ask the same function, so the
 *   rule is written once.
 *
 * What these tests prove:
 *   - The first rundown the server lists is the one shown, also when there are more.
 *   - With no rundown listed (no hello yet) there is none.
 *
 * What these tests deliberately do not cover:
 *   - What the column draws for "no rundown": RundownPanel.test.tsx.
 */
import type { Rundown } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildMainRundown } from '@/state/rundownLikeTheServerSends.testSupport';

import { findRundownShownOnPage } from './rundownShownOnPage';

describe('findRundownShownOnPage', () => {
  it('shows the first rundown the server lists', () => {
    // Arrange: the seeded rundown, and a second one as a later version might send it.
    const mainRundown = buildMainRundown('item-largada-do-enduro');
    const qualifyingRundown = {
      ...buildMainRundown(null),
      id: 'sessao-classificatoria',
      name: 'Classificatória',
    };

    // Act: ask which rundown the page shows.
    const rundownShown = findRundownShownOnPage([mainRundown, qualifyingRundown]);

    // Assert: the first one listed.
    expect(rundownShown, 'the page must show the first rundown the server lists').toEqual(
      mainRundown,
    );
  });

  it('shows no rundown while the server lists none', () => {
    // Arrange: the page has not received the server's hello yet.
    const noRundowns: Rundown[] = [];

    // Act: ask which rundown the page shows.
    const rundownShown = findRundownShownOnPage(noRundowns);

    // Assert: none.
    expect(rundownShown, 'with no rundown listed there is nothing to show').toBeUndefined();
  });
});
