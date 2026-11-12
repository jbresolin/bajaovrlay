/**
 * The list of the browser tests' ports matches the files (scripts)
 *
 * What this module is for:
 *   scripts/browserTestPorts.js is the one list of ports the port-offset check reads
 *   (BAJAOVRLAY-72): it refuses an offset that moves any of them onto a port Windows holds.
 *   Each config and e2e helper still writes its own port, as `5217 +
 *   portOffsetOfTheBrowserTests`, so a new graphic could add a port the list does not know,
 *   and the check would let through an offset that moves it onto 5357. This test reads
 *   every TypeScript file under apps/ and packages/ and fails when the list and the files
 *   disagree.
 *
 * What these tests prove:
 *   - Every `<port> + portOffsetOfTheBrowserTests` in the repository is on the list with
 *     its file, and every row of the list is written in its file.
 *   - The reading finds a port in the shapes the files write it, and nothing else.
 *
 * What these tests deliberately do not cover:
 *   - Whether two packages share a port: uniqueDevPorts.test.ts (configs only).
 *   - Which offsets are refused: portOffsetSafety.test.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { browserTestPorts } from './browserTestPorts.js';

const repoRootFolder = fileURLToPath(new URL('..', import.meta.url));
// Folders that hold installed or built copies, never a package's own file.
const foldersNotToLookIn = ['node_modules', 'dist', 'test-results', 'playwright-report'];

// `const previewPort = 5217 + portOffsetOfTheBrowserTests;`, also inside String(…).
const portMovedByTheOffsetPattern = /(\d+) \+ portOffsetOfTheBrowserTests/g;

/** Every port a file's text writes as moved by the offset, in the order written. */
function findPortsMovedByTheOffset(fileText: string): number[] {
  const ports: number[] = [];
  for (const match of fileText.matchAll(portMovedByTheOffsetPattern)) {
    ports.push(Number(match[1]));
  }
  return ports;
}

/** Every .ts file under `folder`, skipping installed and built copies. */
function findTypeScriptFiles(folder: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory() && !foldersNotToLookIn.includes(entry.name)) {
      files.push(...findTypeScriptFiles(path));
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(path);
    }
  }
  return files;
}

/** "5217 packages/graphics/intermission-board/playwright.config.ts", sorted, one per use. */
function readPortsWrittenInTheRepository(): string[] {
  const files = [
    ...findTypeScriptFiles(join(repoRootFolder, 'apps')),
    ...findTypeScriptFiles(join(repoRootFolder, 'packages')),
  ];
  const portsAndFiles: string[] = [];
  for (const file of files) {
    for (const port of findPortsMovedByTheOffset(readFileSync(file, 'utf8'))) {
      portsAndFiles.push(`${String(port)} ${relative(repoRootFolder, file)}`);
    }
  }
  return portsAndFiles.sort();
}

describe('scripts/browserTestPorts.js', () => {
  it('lists every port the browser tests write, with its file, and no other', () => {
    // Arrange: the list, as "port file" lines.
    const portsOnTheList = browserTestPorts
      .map(({ port, file }) => `${String(port)} ${file}`)
      .sort();

    // Act: read every port the repository's files write as moved by the offset.
    const portsInTheFiles = readPortsWrittenInTheRepository();

    // Assert: the same lines on both sides.
    expect(
      portsOnTheList,
      'add, move or remove the port in scripts/browserTestPorts.js as in the file',
    ).toEqual(portsInTheFiles);
  });

  it('is read from the files, not found empty', () => {
    // Arrange: nothing beyond the repository itself.

    // Act: read the ports written in the files.
    const portsInTheFiles = readPortsWrittenInTheRepository();

    // Assert: the intermission board's port, the one that hit 5357, is among them, so
    // the test above is not passing because both sides are empty.
    expect(portsInTheFiles, "the intermission board's preview port").toContain(
      '5217 packages/graphics/intermission-board/playwright.config.ts',
    );
  });
});

describe('findPortsMovedByTheOffset', () => {
  const files = [
    // A graphic's playwright.config.ts.
    {
      name: 'reads the preview port of a graphic',
      fileText: 'const previewPort = 5217 + portOffsetOfTheBrowserTests;',
      expectedPorts: [5217],
    },
    // The control page's playwright.config.ts wraps it in String().
    {
      name: 'reads a port written inside String()',
      fileText: 'const controlPagePort = String(5188 + portOffsetOfTheBrowserTests);',
      expectedPorts: [5188],
    },
    // A Vite dev port is not moved by the offset and is not a browser test's port.
    {
      name: "leaves out a Vite config's dev port",
      fileText: 'export default defineConfig({ server: { port: 5216, strictPort: true } });',
      expectedPorts: [],
    },
    // A comment naming ports in prose is not a port.
    {
      name: 'leaves out ports named in a comment',
      fileText: "// Away from every other browser test's ports (5176–5225).",
      expectedPorts: [],
    },
  ];

  it.each(files)('$name', ({ fileText, expectedPorts }) => {
    // Arrange: the file text of this row.

    // Act: read the ports it moves by the offset.
    const ports = findPortsMovedByTheOffset(fileText);

    // Assert: exactly the row's ports.
    expect(ports, 'the ports the text writes as moved by the offset').toEqual(expectedPorts);
  });
});
