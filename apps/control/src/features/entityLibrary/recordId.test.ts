/**
 * The ids the page makes for new records (apps/control)
 *
 * What this module is for:
 *   A new person, sponsor or schedule slot needs an id before it is saved (BAJAOVRLAY-19).
 *   The page makes it, and a tablet opens the page over plain http on the LAN, where a
 *   browser offers no crypto.randomUUID (only on https or localhost): calling it blanked
 *   the page at gate 2 of PR #23. makeRecordId builds the id from crypto.getRandomValues,
 *   which every browser offers on any address.
 *
 * What these tests prove:
 *   - With crypto.randomUUID missing, as on plain http, an id is still made, written as a
 *     version-4 UUID.
 *   - A thousand ids in a row are all different.
 *
 * What these tests deliberately do not cover:
 *   - The page using it; EntityLibraryPageOverPlainHttp.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { takeRandomUUIDAwayAsOnPlainHttp } from './plainHttpCrypto.testSupport';
import { makeRecordId } from './recordId';

describe('makeRecordId', () => {
  it('makes a version-4 UUID when crypto.randomUUID is missing', () => {
    // Arrange: a page over plain http, with no crypto.randomUUID.
    takeRandomUUIDAwayAsOnPlainHttp();

    // Act: make an id.
    const recordId = makeRecordId();

    // Assert: a version-4 UUID, made without randomUUID.
    expect(recordId, 'an id written as a version-4 UUID').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('makes a different id every time', () => {
    // Arrange: a page over plain http.
    takeRandomUUIDAwayAsOnPlainHttp();

    // Act: make a thousand ids.
    const recordIds = new Set(Array.from({ length: 1000 }, () => makeRecordId()));

    // Assert: a thousand different ones.
    expect(recordIds.size, 'no id is made twice').toBe(1000);
  });
});
