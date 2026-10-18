/**
 * No control page code sends a graphic up without an item (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-37 everything on air or in preview comes from an item: the page
 *   takes and previews items (takeItem, takeNext, previewItem, takePreview, macros), and
 *   "Edição rápida" only changes what is already up. The server no longer knows the two
 *   commands that put a graphic up with hand-typed data, `takeGraphic` and
 *   `previewGraphic`, and the shared command type no longer lets code build them. This
 *   guard keeps a stray string from bringing one back by another road (a cast, a JSON
 *   text, a test helper copied into page code).
 *
 * What these tests prove:
 *   - No source file of the control page outside the tests holds either command's name
 *     as a quoted string, the way a command's `type` is written.
 *
 * What these tests deliberately do not cover:
 *   - Test files and test-support files, which may name the commands to prove they are
 *     gone.
 *   - Mentions in comments written without quotes (`takeGraphic` in backticks), which
 *     explain history and send nothing.
 *   - That the server refuses the commands; packages/shared's command.test.ts does.
 */
import { describe, expect, it } from 'vitest';

// Every source file of the page, as text, by its path; tests and test support left out.
// Vite reads them at the start of the run (`?raw` hands back the file's text), so the
// guard needs no file system of its own and sees exactly what the page is built from.
const pageSourceTextsByPath: Record<string, string> = import.meta.glob(
  ['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../**/*.testSupport.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
);

// A command name in single or double quotes: how a `type` is written in code or JSON.
const quotedRemovedCommandName = /['"](takeGraphic|previewGraphic)['"]/;

describe('the control page and the commands removed in BAJAOVRLAY-37', () => {
  it('names neither takeGraphic nor previewGraphic as a command anywhere in its code', () => {
    // Arrange: every source file of the page, tests left out.
    const pageSourcePaths = Object.keys(pageSourceTextsByPath);

    // Act: keep the files in which either name appears in quotes.
    const filesNamingARemovedCommand = pageSourcePaths.filter((sourcePath) =>
      quotedRemovedCommandName.test(pageSourceTextsByPath[sourcePath] ?? ''),
    );

    // Assert: there are source files to look at, and none of them names those commands.
    expect(pageSourcePaths.length, 'the guard must actually find the page code').toBeGreaterThan(
      50,
    );
    expect(
      filesNamingARemovedCommand,
      'everything on air comes from an item: no page code may send takeGraphic or previewGraphic',
    ).toEqual([]);
  });
});
