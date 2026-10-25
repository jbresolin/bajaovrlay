/**
 * Each shape's bindable paths are listed once (packages/shared)
 *
 * What this module is for:
 *   listBindablePathsOfShape is read many times a second while a race runs: every "Valor
 *   agora" line of the item editor and every live refresh on the server resolve a binding,
 *   and each resolution looks its path up in the list (findBindablePath). The paths of a
 *   shape are written in code and never change with the data a source sends, so the list
 *   of each shape is built the first time it is asked for and kept (BAJAOVRLAY-45; before,
 *   the positions' list of 145 paths was built anew at every lookup).
 *
 * What these tests prove:
 *   - Two calls for the same shape hand back the very same list.
 *   - Each shape has a list of its own.
 *   - The list kept cannot be changed by a caller, so no caller can spoil it for the next.
 *   - findBindablePath hands back the list's own entry for a path, and nothing for a path
 *     the shape does not list.
 *
 * What these tests deliberately do not cover:
 *   - Which paths each shape lists: bindablePaths.test.ts and the shape-by-shape files.
 */
import { describe, expect, it } from 'vitest';

import { findBindablePath, listBindablePathsOfShape } from './bindablePaths.js';

describe('listBindablePathsOfShape, asked again', () => {
  it('hands back the very same list for the same shape', () => {
    // Arrange: the positions' paths, asked for once.
    const positionsPathsFirst = listBindablePathsOfShape('positions');

    // Act: ask for them again, as the next resolution does.
    const positionsPathsAgain = listBindablePathsOfShape('positions');

    // Assert: the same list, not a copy built again.
    expect(positionsPathsAgain, 'the positions list must be built once and kept').toBe(
      positionsPathsFirst,
    );
  });

  it('keeps one list per shape', () => {
    // Arrange: nothing to set up; the lists are fixed in code.

    // Act: ask for the session's and the positions' paths.
    const sessionPaths = listBindablePathsOfShape('session');
    const positionsPaths = listBindablePathsOfShape('positions');

    // Assert: two different lists, each of its own shape.
    expect(sessionPaths, 'each shape must have a list of its own').not.toBe(positionsPaths);
    expect(
      findBindablePath('session', 'state')?.label,
      'a lookup in the session must find the flag',
    ).toBe('Sessão › Bandeira');
  });

  it('refuses a change to the list it keeps', () => {
    // Arrange: the standings' paths, as a caller receives them.
    const standingsPaths = listBindablePathsOfShape('standings');
    const lengthBefore = standingsPaths.length;

    // Act: a careless caller tries to add a path of its own.
    const addAPath = () =>
      (standingsPaths as unknown as Array<{ path: string }>).push({ path: 'entries.99.teamName' });

    // Assert: refused, and the list is what it was.
    expect(addAPath, 'the kept list must not take a change').toThrow(TypeError);
    expect(
      listBindablePathsOfShape('standings'),
      'the next caller must get the list unchanged',
    ).toHaveLength(lengthBefore);
  });

  it('finds a path as the very entry of the list, and nothing for a path not listed', () => {
    // Arrange: the positions' entry for the team of a car chosen by number, in the list.
    const entryInTheList = listBindablePathsOfShape('positions').find(
      (bindablePath) => bindablePath.path === 'entryOfCar.teamName',
    );

    // Act: look that path up, and one the positions do not list.
    const entryFound = findBindablePath('positions', 'entryOfCar.teamName');
    const entryNotListed = findBindablePath('positions', 'entries.10.teamName');

    // Assert: the same entry, and nothing for the 11th place (only ten have paths).
    expect(entryFound, 'the lookup must hand back the list’s own entry').toBe(entryInTheList);
    expect(entryNotListed, 'a path not listed is not found').toBeUndefined();
  });
});
