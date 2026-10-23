/**
 * Which page of the control page is shown (apps/control)
 *
 * What this module is for:
 *   The control page has four pages: the console (rundown, monitors, layers), "Fontes de
 *   dados", "Cadastros" and "Eventos". Which one is shown is written in the address after
 *   "#" ("#/fontes", "#/cadastros", "#/eventos"), so the
 *   header's links, the browser's back button and a reload all work without a router
 *   library, and the server needs no extra address for the built page.
 *
 * What these tests prove:
 *   - "#/fontes" is the data sources page and "#/cadastros" the entity library, also
 *     with a record after it ("#/cadastros/team/42"), and "#/eventos" the review of the
 *     event inbox; no hash,
 *     "#/" and any unknown hash are the
 *     console, so a stale bookmark never shows an empty page.
 *
 * What these tests deliberately do not cover:
 *   - Following the hash as it changes, and the header's links: src/AppPages.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { type ControlPageName, readPageFromHash } from './currentPage';

const hashScenarios: { name: string; hash: string; expected: ControlPageName }[] = [
  // The address as the operator types it: no hash at all.
  { name: 'shows the console with no hash', hash: '', expected: 'console' },
  // What the header's "Console" link writes.
  { name: 'shows the console for "#/"', hash: '#/', expected: 'console' },
  // What the header's "Fontes" link writes.
  { name: 'shows the data sources page for "#/fontes"', hash: '#/fontes', expected: 'dataSources' },
  // What the header's "Cadastros" link writes (BAJAOVRLAY-19).
  {
    name: 'shows the entity library for "#/cadastros"',
    hash: '#/cadastros',
    expected: 'entityLibrary',
  },
  // "Editar no cadastro" in "Edição rápida" opens one record of Cadastros (gate 2 of PR #23).
  {
    name: 'shows the entity library for the address of one of its records',
    hash: '#/cadastros/team/42',
    expected: 'entityLibrary',
  },
  // What the header's "Eventos" link writes: the review of the event inbox (gate 2 of PR #22).
  { name: 'shows the event review for "#/eventos"', hash: '#/eventos', expected: 'eventReview' },
  // An old or mistyped bookmark falls back to the console rather than a blank page.
  { name: 'shows the console for an unknown hash', hash: '#/camadas', expected: 'console' },
];

describe('readPageFromHash', () => {
  it.each(hashScenarios)('$name', ({ hash, expected }) => {
    // Arrange: the hash comes from the scenario row above.

    // Act: read the page from it.
    const page = readPageFromHash(hash);

    // Assert: the page the row expects.
    expect(page, `the hash "${hash}" must show the ${expected} page`).toBe(expected);
  });
});
