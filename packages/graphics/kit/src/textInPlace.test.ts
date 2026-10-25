/**
 * Writing a text in place (packages/graphics/kit)
 *
 * What this module is for:
 *   Every graphic rewrites its texts on air through writeTextIfChanged, so an unchanged
 *   update or a clock frame leaves the page untouched.
 *
 * What these tests prove:
 *   - A new text is written; the same text again leaves the element's text node as it was.
 *
 * What these tests deliberately do not cover:
 *   - What each graphic writes; their own view tests.
 */
import { describe, expect, it } from 'vitest';

import { writeTextIfChanged } from './textInPlace.js';

describe('writeTextIfChanged', () => {
  it('writes a new text, and leaves the same text untouched', () => {
    // Arrange: the clock's time cell showing 1:00:00.
    const timeCell = document.createElement('span');
    timeCell.textContent = '1:00:00';
    const textNodeBefore = timeCell.firstChild;

    // Act: a frame writes the same second, then the next one.
    writeTextIfChanged(timeCell, '1:00:00');
    const textNodeAfterTheSameSecond = timeCell.firstChild;
    writeTextIfChanged(timeCell, '1:00:01');

    // Assert: the same second touched nothing; the next is written.
    expect(textNodeAfterTheSameSecond, 'the same text must leave the node as it was').toBe(
      textNodeBefore,
    );
    expect(timeCell.textContent, 'a new text is written').toBe('1:00:01');
  });
});
