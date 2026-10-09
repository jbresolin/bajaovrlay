/**
 * The testing-style example stays true (apps/server)
 *
 * What this module is for:
 *   docs/testing-style.md shows the /health test file as the template every test
 *   copies, and promises that the copy in the docs is identical to the real file.
 *
 * What these tests prove:
 *   - The code block in docs/testing-style.md and healthRoute.test.ts are identical,
 *     so a change to one without the other fails CI instead of quietly drifting.
 *
 * What these tests deliberately do not cover:
 *   - Whether other test files follow the style; that is a review judgement.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const testingStyleGuidePath = new URL('../../../../../docs/testing-style.md', import.meta.url);
const realHealthTestPath = new URL('./healthRoute.test.ts', import.meta.url);

/** Returns the body of the last ```ts code block in a Markdown document. */
function readLastTypeScriptCodeBlock(markdown: string): string {
  const blockStartMarker = '```ts\n';
  const blockEndMarker = '\n```';
  const blockStart = markdown.lastIndexOf(blockStartMarker) + blockStartMarker.length;
  const blockEnd = markdown.indexOf(blockEndMarker, blockStart);
  return markdown.slice(blockStart, blockEnd + 1);
}

describe('docs/testing-style.md', () => {
  it('shows exactly the real /health test file as its complete example', () => {
    // Arrange: read the style guide and the real test file from disk.
    const testingStyleGuide = readFileSync(testingStyleGuidePath, 'utf8');
    const realHealthTest = readFileSync(realHealthTestPath, 'utf8');

    // Act: cut the complete example out of the guide (its last TypeScript block).
    const exampleInGuide = readLastTypeScriptCodeBlock(testingStyleGuide);

    // Assert: the example and the real file are the same, character for character.
    expect(
      exampleInGuide,
      'docs/testing-style.md must show healthRoute.test.ts exactly as it is',
    ).toBe(realHealthTest);
  });
});
