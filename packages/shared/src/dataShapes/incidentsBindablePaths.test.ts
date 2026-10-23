/**
 * The paths a binding may point at in the incidents (packages/shared)
 *
 * What this module is for:
 *   The incidents shape (BAJAOVRLAY-44) joins the bindable shapes like the others, so a
 *   graphic with a list field (a future board of penalties) can read it whole. Its single
 *   path is listed apart from bindablePaths.test.ts to keep that file under its limit.
 *
 * What these tests prove:
 *   - The incidents offer the whole list only, typed incidentsEntries, labelled
 *     "Incidentes › Lista completa".
 *
 * What these tests deliberately do not cover:
 *   - That the path names a field of the shape; bindablePathsMatchShapes.test.ts.
 *   - How an incident reaches the air: the event inbox fills the notice (modules/events).
 */
import { describe, expect, it } from 'vitest';

import { listBindablePathsOfShape } from './bindablePaths.js';

describe('listBindablePathsOfShape for the incidents', () => {
  it('offers only the whole list of the incidents', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the incidents paths.
    const incidentsPaths = listBindablePathsOfShape('incidents');

    // Assert: one path. An incident reaches the air through the event inbox (an event
    // fills the notice), not through a binding to "the 3rd incident", whose place in the
    // list means nothing to a viewer; the whole list is there for a future penalty board.
    expect(incidentsPaths, 'incidents must offer only the whole list').toEqual([
      {
        path: 'entries',
        label: 'Incidentes › Lista completa',
        valueType: 'incidentsEntries',
        isCarChosenByNumber: false,
      },
    ]);
  });
});
